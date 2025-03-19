const Bull = require('bull');

const BlockchainService = require('./blockchainService');
const Document = require('../models/Document');


const documentCreationQueue = new Bull('document-creation', {
    redis: {
        host: process.env.REDIS_HOST || 'localhost', 
        port: process.env.REDIS_PORT || 6379       
    }
});

const documentVerificationQueue = new Bull('document-verification', {
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
    }
});

const documentTransferQueue = new Bull('document-transfer', {
    redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
    }
});


documentCreationQueue.process(async (job) => {
    const { documentData, documentId } = job.data;
    
    try {
       
        const blockchainResponse = await BlockchainService.createDocument(documentData);
        
        await Document.findByIdAndUpdate(documentId, {
            blockchainId: blockchainResponse.documentId,       
            transactionHash: blockchainResponse.transactionHash, 
            blockNumber: blockchainResponse.blockNumber,       
            status: 'Active'                              
        });
        
        return blockchainResponse;
    } catch (error) {
        console.error('Document creation queue error:', error);
        
        await Document.findByIdAndUpdate(documentId, {
            status: 'Error',
            blockchainError: error.message
        });
        
        throw error;
    }
});

documentVerificationQueue.process(async (job) => {
    const { documentId, userId } = job.data;
    
    try {
        const document = await Document.findById(documentId);
        
        if (!document) {
            throw new Error('Document not found');
        }
        
        const verificationResult = await BlockchainService.verifyDocument(
            document.blockchainId,
            document.documentHash
        );
        
        await Document.findByIdAndUpdate(documentId, {
            status: 'Verified',
            verificationTransactionHash: verificationResult.transactionHash,
            verificationBlockNumber: verificationResult.blockNumber,
            verifiedBy: userId,
            verifiedAt: new Date()
        });
        
        return verificationResult;
    } catch (error) {
        console.error('Document verification queue error:', error);
        throw error;
    }
});


documentTransferQueue.process(async (job) => {
   
    const { documentId, newHolder, userId } = job.data;
    
    try {
        
        const document = await Document.findById(documentId);
        
        if (!document) {
            throw new Error('Document not found');
        }
        
        
        const transferResult = await BlockchainService.transferDocument(
            document.blockchainId,
            newHolder
        );
        
      
        const updatedDocument = await Document.findByIdAndUpdate(
            documentId,
            {
                status: 'Transferred',
                transferTransactionHash: transferResult.transactionHash,
                transferBlockNumber: transferResult.blockNumber,
                $push: { endorsementChain: newHolder } 
            },
            { new: true }
        );
        
        return {
            transferResult,
            document: updatedDocument
        };
    } catch (error) {
        console.error('Document transfer queue error:', error);
        throw error;
    }
});

const queueService = {
    addDocumentCreation: async (documentData, documentId) => {
        return await documentCreationQueue.add(
            { documentData, documentId }, 
            { 
                attempts: 3,     
                backoff: 5000   
            }
        );
    },
    
    addDocumentVerification: async (documentId, userId) => {
        return await documentVerificationQueue.add(
            { documentId, userId },
            { attempts: 3, backoff: 5000 }
        );
    },
    
    addDocumentTransfer: async (documentId, newHolder, userId) => {
        return await documentTransferQueue.add(
            { documentId, newHolder, userId },
            { attempts: 3, backoff: 5000 }
        );
    },
    
    getJobStatus: async (queueName, jobId) => {
        let queue;
        
        switch (queueName) {
            case 'creation':
                queue = documentCreationQueue;
                break;
            case 'verification':
                queue = documentVerificationQueue;
                break;
            case 'transfer':
                queue = documentTransferQueue;
                break;
            default:
                throw new Error('Invalid queue name');
        }
        
        const job = await queue.getJob(jobId);
        
        if (!job) {
            throw new Error('Job not found');
        }
        
        const state = await job.getState();
        
        return {
            id: job.id,
            state,
            progress: job.progress(),
            attemptsMade: job.attemptsMade,
            data: job.data,
            result: job.returnvalue,
            error: job.failedReason
        };
    }
};

module.exports = queueService;