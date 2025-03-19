const Document = require('../models/Document');
const queueService = require('../services/queueService');
const documentHistoryService = require('../services/documentHistoryService');
const crypto = require('crypto');

class DocumentController {
    async createDocument(req, res) {
        try {
            const { documentType, metadata } = req.body;
            const creator = req.user._id;

            const documentHash = crypto.createHash('sha256')
                .update(JSON.stringify(metadata))
                .digest('hex');

            const blockchainDocumentData = {
                category: documentType === 'Transferable' ? 0 : 1,
                documentHash,
                expiryDate: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
            };

            const document = new Document({
                documentType,
                creator,
                metadata,
                documentHash,
                status: 'Draft'
            });

            await document.save();

            await documentHistoryService.recordDocumentCreation(
                document._id,
                creator,
                null, 
                null  
            );

            const job = await queueService.addDocumentCreation(
                blockchainDocumentData, 
                document._id
            );

            res.status(201).json({
                message: 'Document creation initiated',
                document,
                job: {
                    id: job.id,
                    statusCheckEndpoint: `/api/documents/job-status/creation/${job.id}`
                }
            });
        } catch (error) {
            console.error('Document creation error:', error);
            res.status(500).json({ 
                error: error.message,
                code: 'SERVER_ERROR'
            });
        }
    }

    async verifyDocument(req, res) {
        try {
            const { documentId } = req.params;
            const userId = req.user._id;
            
            const document = await Document.findById(documentId);
            
            if (!document) {
                return res.status(404).json({ 
                    error: 'Document not found',
                    code: 'DOCUMENT_NOT_FOUND' 
                });
            }
            
            if (document.status === 'Verified') {
                return res.status(400).json({
                    error: 'Document is already verified',
                    code: 'ALREADY_VERIFIED'
                });
            }

            const job = await queueService.addDocumentVerification(
                documentId,
                userId
            );
            
            document.status = 'PendingVerification';
            await document.save();

            res.json({
                message: 'Document verification initiated',
                document,
                job: {
                    id: job.id,
                    statusCheckEndpoint: `/api/documents/job-status/verification/${job.id}`
                }
            });
        } catch (error) {
            console.error('Document verification error:', error);
            res.status(500).json({ 
                error: error.message,
                code: 'SERVER_ERROR'
            });
        }
    }

    // Transfer Document with queue
    async transferDocument(req, res) {
        try {
            const { documentId } = req.params;
            const { newHolder } = req.body;
            const userId = req.user._id;

            if (!newHolder) {
                return res.status(400).json({
                    error: 'New holder address is required',
                    code: 'MISSING_HOLDER_ADDRESS'
                });
            }

            const document = await Document.findById(documentId);
            
            if (!document) {
                return res.status(404).json({ 
                    error: 'Document not found',
                    code: 'DOCUMENT_NOT_FOUND'
                });
            }

            // Check if document is transferable
            if (document.documentType !== 'Transferable') {
                return res.status(400).json({ 
                    error: 'Document is not transferable',
                    code: 'NON_TRANSFERABLE_DOCUMENT'
                });
            }

            // Check if user is document owner or in endorsement chain
            if (document.creator.toString() !== userId.toString() && 
                !document.endorsementChain.includes(userId.toString())) {
                return res.status(403).json({ 
                    error: 'You do not have permission to transfer this document',
                    code: 'UNAUTHORIZED_TRANSFER'
                });
            }

            // Add transfer job to queue
            const job = await queueService.addDocumentTransfer(
                documentId,
                newHolder,
                userId
            );
            
            // Update status to pending transfer
            document.status = 'PendingTransfer';
            await document.save();

            res.json({
                message: 'Document transfer initiated',
                document,
                job: {
                    id: job.id,
                    statusCheckEndpoint: `/api/documents/job-status/transfer/${job.id}`
                }
            });
        } catch (error) {
            console.error('Document transfer error:', error);
            res.status(500).json({ 
                error: error.message,
                code: 'SERVER_ERROR' 
            });
        }
    }
    
    // Get job status
    async getJobStatus(req, res) {
        try {
            const { queueName, jobId } = req.params;
            
            if (!['creation', 'verification', 'transfer'].includes(queueName)) {
                return res.status(400).json({
                    error: 'Invalid queue name',
                    code: 'INVALID_QUEUE'
                });
            }

            const jobStatus = await queueService.getJobStatus(queueName, jobId);
            
            res.json({
                jobId,
                status: jobStatus.state,
                progress: jobStatus.progress,
                result: jobStatus.result,
                error: jobStatus.error,
                attempts: jobStatus.attemptsMade
            });
        } catch (error) {
            console.error('Job status error:', error);
            res.status(500).json({ 
                error: error.message,
                code: 'SERVER_ERROR' 
            });
        }
    }
    
    // Get document details
    async getDocumentDetails(req, res) {
        try {
            const { documentId } = req.params;
            
            const document = await Document.findById(documentId)
                .populate('creator', 'username email walletAddress')
                .populate('verifiedBy', 'username email walletAddress');
            
            if (!document) {
                return res.status(404).json({ 
                    error: 'Document not found',
                    code: 'DOCUMENT_NOT_FOUND'
                });
            }
            
            res.json({
                document
            });
        } catch (error) {
            console.error('Get document details error:', error);
            res.status(500).json({ 
                error: error.message,
                code: 'SERVER_ERROR'
            });
        }
    }
    
    // Get documents by user
    async getUserDocuments(req, res) {
        try {
            const userId = req.user._id;
            
            const documents = await Document.find({
                $or: [
                    { creator: userId },
                    { endorsementChain: userId }
                ]
            }).sort({ createdAt: -1 });
            
            res.json({
                count: documents.length,
                documents
            });
        } catch (error) {
            console.error('Get user documents error:', error);
            res.status(500).json({ 
                error: error.message,
                code: 'SERVER_ERROR'
            });
        }
    }

// Add this method to DocumentController:
async getDocumentHistory(req, res) {
    try {
        const { documentId } = req.params;
        
        const document = await Document.findById(documentId);
        
        if (!document) {
            return res.status(404).json({ 
                error: 'Document not found',
                code: 'DOCUMENT_NOT_FOUND'
            });
        }
        
        // Check if user has permission to view this document
        const userId = req.user._id;
        const isCreator = document.creator.toString() === userId.toString();
        const isInChain = document.endorsementChain.includes(userId);
        const isAdmin = req.user.role === 'admin';
        
        if (!isCreator && !isInChain && !isAdmin) {
            return res.status(403).json({
                error: 'You do not have permission to view this document history',
                code: 'UNAUTHORIZED_ACCESS'
            });
        }
        
        const history = await documentHistoryService.getDocumentHistory(documentId);
        
        res.json({
            document,
            history
        });
    } catch (error) {
        console.error('Get document history error:', error);
        res.status(500).json({ 
            error: error.message,
            code: 'SERVER_ERROR'
        });
    }
}
}

module.exports = new DocumentController();