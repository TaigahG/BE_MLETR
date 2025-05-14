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
        console.log(`Processing document creation job for document ${documentId}`);
        console.log('Document data:', documentData);

        const blockchainResponse = await BlockchainService.createDocument(documentData);
        console.log('Blockchain response:', blockchainResponse);
        
        const document = await Document.findByIdAndUpdate(documentId, {
            blockchainId: blockchainResponse.documentId,       
            transactionHash: blockchainResponse.transactionHash, 
            blockNumber: Number(blockchainResponse.blockNumber),       
            status: 'Active'                              
        }, { new: true });

        console.log("document queue: ", document)

        console.log(`Document ${documentId} updated with blockchain data`);
        
        return {document, blockchainResponse};
    } catch (error) {
        console.error(`Error in document creation job for document ${documentId}:`, error);
        
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
            verificationBlockNumber: Number(verificationResult.blockNumber),
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
    const { documentId, newBeneficiary, newHolder, userId } = job.data;
    
    try {
      const document = await Document.findById(documentId);
      
      if (!document) {
        throw new Error('Document not found');
      }
      
      if (document.documentType !== 'Transferable') {
        throw new Error('Document is not transferable');
      }
      
      const transferResult = await BlockchainService.transferDocumentOwnership(
        document.documentHash,
        newBeneficiary,
        newHolder
      );
      
      document.status = 'Transferred';
      document.transferTransactionHash = transferResult.transactionHash;
      document.transferBlockNumber = Number(transferResult.blockNumber);
      
      // Add the new holder to the endorsement chain if they're not already there
      // In a real implementation, you'd store the wallet address and map it to user IDs
      // For now, we're just adding the current user
      if (!document.endorsementChain.includes(userId)) {
        document.endorsementChain.push(userId);
      }
      
      await document.save();
      
      // Create document history record
      await documentHistoryService.recordDocumentTransfer(
        document._id,
        userId,
        userId, // In a real implementation, this would be the new holder's user ID
        transferResult.transactionHash
      );
      
      return {
        transferResult,
        document
      };
    } catch (error) {
      console.error('Document transfer queue error:', error);
      
      if (documentId) {
        try {
          await Document.findByIdAndUpdate(documentId, {
            status: 'Error',
            transferError: error.message
          });
        } catch (updateError) {
          console.error('Error updating document status:', updateError);
        }
      }
      
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