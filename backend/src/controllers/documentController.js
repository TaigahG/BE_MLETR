const Document = require('../models/Document');
const queueService = require('../services/queueService');
const documentHistoryService = require('../services/documentHistoryService');
const BlockchainService = require('../services/blockchainService')
const TradeTrustVerificationService = require('../services/tradeTrustVerification');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const multer = require('multer');
const archiver = require('archiver');

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = path.join(__dirname, '../uploads');
        
        fs.mkdir(uploadDir, { recursive: true })
            .then(() => cb(null, uploadDir))
            .catch(err => cb(err));
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedFileTypes = ['.csv', '.json', '.tt'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedFileTypes.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only CSV, JSON, and TT files are allowed.'), false);
    }
};

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 
    },
    fileFilter: fileFilter
});

class DocumentController {
    uploadFile() {
        return upload.single('file');
    }
    
    async handleFileUpload(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({ 
                    error: 'No file uploaded' 
                });
            }
            
            const filePath = req.file.path;
            let metadata = {};
            
            const fileExt = path.extname(req.file.originalname).toLowerCase();
            
            if (fileExt === '.json') {
                try {
                    const fileContent = await fs.readFile(filePath, 'utf8');
                    metadata = JSON.parse(fileContent);
                } catch (parseError) {
                    return res.status(400).json({ 
                        error: 'Invalid JSON file' 
                    });
                }
            } else if (fileExt === '.csv') {
                try {
                    const fileContent = await fs.readFile(filePath, 'utf8');
                    
                    const lines = fileContent.split('\\n');
                    const headers = lines[0].split(',');
                    const data = [];
                    
                    for (let i = 1; i < lines.length; i++) {
                        if (lines[i].trim()) {
                            const values = lines[i].split(',');
                            const row = {};
                            
                            for (let j = 0; j < headers.length; j++) {
                                row[headers[j].trim()] = values[j] ? values[j].trim() : '';
                            }
                            
                            data.push(row);
                        }
                    }
                    
                    metadata = { headers, data };
                } catch (parseError) {
                    return res.status(400).json({ 
                        error: 'Invalid CSV file' 
                    });
                }
            } else if (fileExt === '.tt') {
                metadata = { 
                    fileName: req.file.originalname,
                    fileSize: req.file.size,
                    filePath: req.file.path
                };
            }
            
            res.status(200).json({
                message: 'File uploaded successfully',
                file: {
                    originalName: req.file.originalname,
                    filename: req.file.filename,
                    size: req.file.size,
                    mimetype: req.file.mimetype,
                    path: req.file.path
                },
                metadata
            });
        } catch (error) {
            console.error('File upload error:', error);
            res.status(500).json({ 
                error: error.message || 'File upload failed' 
            });
        }
    }
    
    async createDocument(req, res) {
        try {
            const { type, metadata, fileName } = req.body;
            
            if (!type || !metadata) {
                return res.status(400).json({ 
                    error: 'Document type and metadata are required' 
                });
            }

                        
            const creator = req.user._id;

            const documentHash = crypto.createHash('sha256')
                .update(JSON.stringify(metadata))
                .digest('hex');

            const document = new Document({
                documentType: type,
                creator,
                metadata,
                fileName: fileName || 'Untitled Document',
                documentHash,
                status: 'Draft',
                // Blockchain fields will be updated after blockchain transaction
                // blockchainId: null,
                // transactionHash: null,
                // blockNumber: null
            });

            await document.save();

            await documentHistoryService.recordDocumentCreation(
                document._id,
                creator,
                null, 
                null  
            );

            const blockchainDocumentData = {
                category: type === 'Transferable' ? 0 : 1,
                documentHash,
                expiryDate: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 
            };

            const job = await queueService.addDocumentCreation(
                blockchainDocumentData, 
                document._id
            );

            res.status(201).json({
                message: 'Document creation initiated',
                document,
                job: {
                    id: job.id,
                    statusCheckEndpoint: `/api/v1/documents/job-status/creation/${job.id}`
                }
            });
        } catch (error) {
            console.error('Document creation error:', error);
            res.status(500).json({ 
                error: error.message || 'Document creation failed' 
            });
        }
    }

    async verifyDocument(req, res) {
        try {
            const { documentId } = req.params;
            const { documentHash } = req.body;
            const userId = req.user._id;
            
            const document = await Document.findById(documentId);
            
            if (!document) {
                return res.status(404).json({ 
                    error: 'Document not found',
                    code: 'DOCUMENT_NOT_FOUND' 
                });
            }
            
            if (documentHash && documentHash !== document.documentHash) {
                return res.status(400).json({
                    error: 'Document hash does not match',
                    code: 'HASH_MISMATCH'
                });
            }
            
            if (document.status === 'Verified') {
                return res.status(200).json({
                    verified: true,
                    message: 'Document is already verified',
                    document
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
                    statusCheckEndpoint: `/api/v1/documents/job-status/verification/${job.id}`
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

            if (document.documentType !== 'Transferable') {
                return res.status(400).json({ 
                    error: 'Document is not transferable',
                    code: 'NON_TRANSFERABLE_DOCUMENT'
                });
            }

            if (document.creator.toString() !== userId.toString() && 
                !document.endorsementChain.includes(userId.toString())) {
                return res.status(403).json({ 
                    error: 'You do not have permission to transfer this document',
                    code: 'UNAUTHORIZED_TRANSFER'
                });
            }

            const job = await queueService.addDocumentTransfer(
                documentId,
                newHolder,
                userId
            );
            
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

    async getJobStatus(req, res) {
        try {
            const { queueName, jobId } = req.params;
            
            if (!['creation', 'verification', 'transfer'].includes(queueName)) {
                return res.status(400).json({
                    error: 'Invalid queue name'
                });
            }

            const jobStatus = await queueService.getJobStatus(queueName, jobId);
            
            res.json({
                jobId,
                state: jobStatus.state,
                progress: jobStatus.progress,
                result: jobStatus.result,
                error: jobStatus.failedReason,
                attempts: jobStatus.attemptsMade
            });
        } catch (error) {
            console.error('Job status error:', error);
            res.status(500).json({ 
                error: error.message || 'Failed to get job status' 
            });
        }
    }
    
    async downloadDocument(req, res) {
        try {
            const { documentId } = req.params;
            
            const document = await Document.findById(documentId);

            console.log('Document:', document);
            
            if (!document) {
                return res.status(404).json({ 
                    error: 'Document not found' 
                });
            }
            
            if (document.creator.toString() !== req.user._id.toString() && 
                !document.endorsementChain.includes(req.user._id.toString())) {
                return res.status(403).json({ 
                    error: 'You do not have permission to download this document' 
                });
            }

            
            const documentData = {
                documentType: document.documentType,
                documentHash: document.documentHash,
                metadata: document.metadata,
                createdAt: document.createdAt,
                creator: req.user._id,
                blockchainId: document.blockchainId,
                transactionHash: document.transactionHash
            };

            console.log('Document data:', documentData);
            
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="${document.fileName || 'document'}.tt"`);

            console.log('Sending document data:', documentData);
            
            res.send(JSON.stringify(documentData, null, 2));
            console.log('Document sent successfully');
        } catch (error) {
            console.error('Document download error:', error);
            res.status(500).json({ 
                error: error.message || 'Document download failed' 
            });
        }
    }
    
    async downloadAllDocuments(req, res) {
        try {
            const documents = await Document.find({
                $or: [
                    { creator: req.user._id },
                    { endorsementChain: req.user._id }
                ]
            });
            
            if (!documents.length) {
                return res.status(404).json({ 
                    error: 'No documents found' 
                });
            }
            
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', 'attachment; filename="documents.zip"');
            
            const archive = archiver('zip', { zlib: { level: 9 } });
            archive.pipe(res);
            
            for (const document of documents) {
                const ttContent = JSON.stringify({
                    documentType: document.documentType,
                    documentHash: document.documentHash,
                    metadata: document.metadata,
                    createdAt: document.createdAt,
                    creator: req.user._id,
                    blockchainId: document.blockchainId,
                    transactionHash: document.transactionHash
                }, null, 2);
                
                archive.append(Buffer.from(ttContent), { 
                    name: `${document.fileName || 'document-' + document._id}.tt` 
                });
            }
            
            await archive.finalize();
        } catch (error) {
            console.error('Download all documents error:', error);
            res.status(500).json({ 
                error: error.message || 'Failed to download all documents' 
            });
        }
    }
    
    async getDocumentDetails(req, res) {
        try {
            const { documentId } = req.params;
            
            const document = await Document.findById(documentId)
                .populate('creator', 'username email walletAddress')
                .populate('verifiedBy', 'username email walletAddress');
            
            if (!document) {
                return res.status(404).json({ 
                    error: 'Document not found' 
                });
            }
            
            res.json({
                document
            });
        } catch (error) {
            console.error('Get document details error:', error);
            res.status(500).json({ 
                error: error.message || 'Failed to get document details' 
            });
        }
    }
    
    async getUserDocuments(req, res) {
        try {
            const userId = req.user._id;
            
            const documents = await Document.find({
                $or: [
                    { creator: userId },
                    { endorsementChain: userId }
                ]
            })
            .sort({ createdAt: -1 })
            .populate('creator', 'username email')
            .populate('verifiedBy', 'username email');
            
            res.json({
                count: documents.length,
                documents
            });
        } catch (error) {
            console.error('Get user documents error:', error);
            res.status(500).json({ 
                error: error.message || 'Failed to get user documents' 
            });
        }
    }

    async getDocumentHistory(req, res) {
        try {
            const { documentId } = req.params;
            
            const document = await Document.findById(documentId);
            
            if (!document) {
                return res.status(404).json({ 
                    error: 'Document not found' 
                });
            }
            
            const userId = req.user._id;
            const isCreator = document.creator.toString() === userId.toString();
            const isInChain = document.endorsementChain.includes(userId);
            
            if (!isCreator && !isInChain) {
                return res.status(403).json({
                    error: 'You do not have permission to view this document history'
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
                error: error.message || 'Failed to get document history' 
            });
        }
    }

    async verifyTradeTrustDocument(req, res) {
        console.log('TradeTrust verification request received');
        
        try {
        const { documentData, documentHash } = req.body;
        
        if (!documentData && !documentHash) {
            return res.status(400).json({
            error: 'Document data or hash is required',
            code: 'MISSING_DATA'
            });
        }
        
        let verificationResult = {
            verified: false,
            onBlockchain: false,
            inDatabase: false,
            didVerified: false,
            dnsVerified: false,
            revoked: false,
            issuer: null,
            currentHolder: null,
            expiryDate: null,
            isExpired: false,
            details: {}
        };
        
        if (documentData) {
            verificationResult = await TradeTrustVerificationService.verifyDocument(documentData);
            
            // Check if document is in our database
            const documentHashToCheck = documentData.signature?.targetHash || documentHash;
            const document = documentHashToCheck
            ? await Document.findOne({ documentHash: documentHashToCheck.replace(/^0x/, '') })
            : null;
            
            verificationResult.inDatabase = !!document;
            
            if (document) {
            verificationResult.document = {
                id: document._id,
                status: document.status,
                documentType: document.documentType,
                creator: document.creator,
                transactionHash: document.transactionHash,
                blockchainId: document.blockchainId,
                createdAt: document.createdAt
            };
            
            if (document.blockchainId) {
                const blockchainStatus = await BlockchainService.verifyDocumentOnBlockchain(documentHashToCheck);
                
                verificationResult = {
                ...verificationResult,
                onBlockchain: blockchainStatus.exists,
                issuer: blockchainStatus.issuer,
                currentHolder: blockchainStatus.currentHolder,
                expiryDate: blockchainStatus.expiryDate,
                isExpired: blockchainStatus.isExpired,
                revoked: blockchainStatus.isRevoked
                };
            }
            
            await document.updateVerificationDetails({
                documentIntegrity: verificationResult.details.documentIntegrity || false,
                issuerIdentity: verificationResult.details.issuerIdentity || false,
                didVerified: verificationResult.didVerified || false,
                dnsVerified: verificationResult.dnsVerified || false,
                onBlockchain: verificationResult.onBlockchain || false,
                revoked: verificationResult.revoked || false
            });
            }
        } else if (documentHash) {
            const isOnBlockchain = await BlockchainService.verifyDocumentOnBlockchain(documentHash);
            const document = await Document.findOne({
            documentHash: documentHash.replace(/^0x/, '')
            });
            
            verificationResult = {
            verified: isOnBlockchain.exists && !isOnBlockchain.isRevoked,
            onBlockchain: isOnBlockchain.exists,
            inDatabase: !!document,
            revoked: isOnBlockchain.isRevoked,
            issuer: isOnBlockchain.issuer,
            currentHolder: isOnBlockchain.currentHolder,
            expiryDate: isOnBlockchain.expiryDate,
            isExpired: isOnBlockchain.isExpired
            };
            
            if (document) {
            verificationResult.document = {
                id: document._id,
                status: document.status,
                documentType: document.documentType,
                creator: document.creator,
                transactionHash: document.transactionHash,
                blockchainId: document.blockchainId,
                createdAt: document.createdAt
            };
            }
        }
        
        await this.logVerificationAttempt({
            userId: req.user._id,
            documentId: verificationResult.document?.id,
            documentHash: documentHash || documentData?.signature?.targetHash,
            successful: verificationResult.verified,
            result: verificationResult
        });
        
        return res.json(verificationResult);
        } catch (error) {
        console.error('TradeTrust verification error:', error);
        res.status(500).json({ 
            error: error.message || 'Verification failed',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            code: 'SERVER_ERROR'
        });
        }
    }
  
  async logVerificationAttempt(data) {
    try {
      const VerificationLog = require('../models/VerificationLog');
      await VerificationLog.create({
        userId: data.userId,
        documentId: data.documentId,
        documentHash: data.documentHash,
        successful: data.successful,
        verificationDetails: data.result,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error logging verification attempt:', error);
      // Non-blocking - continue even if logging fails
    }
  }

async transferTransferableDocument(req, res) {
    try {
      const { documentId } = req.params;
      const { newBeneficiary, newHolder } = req.body;
      const userId = req.user._id;
      
      if (!newBeneficiary || !newHolder) {
        return res.status(400).json({
          error: 'New beneficiary and holder addresses are required',
          code: 'MISSING_PARAMETERS'
        });
      }
      
      if (!this.web3.utils.isAddress(newBeneficiary) || !this.web3.utils.isAddress(newHolder)) {
        return res.status(400).json({
          error: 'Invalid Ethereum addresses provided',
          code: 'INVALID_ADDRESSES'
        });
      }
      
      const document = await Document.findById(documentId);
      
      if (!document) {
        return res.status(404).json({
          error: 'Document not found',
          code: 'DOCUMENT_NOT_FOUND'
        });
      }
      
      if (document.documentType !== 'Transferable') {
        return res.status(400).json({
          error: 'Document is not transferable',
          code: 'NON_TRANSFERABLE_DOCUMENT'
        });
      }
      
 
      if (document.creator.toString() !== userId.toString() &&
          !document.endorsementChain.includes(userId)) {
        return res.status(403).json({
          error: 'You do not have permission to transfer this document',
          code: 'UNAUTHORIZED_TRANSFER'
        });
      }
      
      const job = await queueService.addDocumentTransfer(
        documentId,
        {
          newBeneficiary,
          newHolder
        },
        userId
      );
      
      document.status = 'PendingTransfer';
      await document.save();
      
      res.json({
        message: 'Document transfer initiated',
        document,
        job: {
          id: job.id,
          statusCheckEndpoint: `/api/v1/documents/job-status/transfer/${job.id}`
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
  
  async getDocumentOwnership(req, res) {
    try {
      const { documentId } = req.params;
      
      const document = await Document.findById(documentId);
      
      if (!document) {
        return res.status(404).json({
          error: 'Document not found',
          code: 'DOCUMENT_NOT_FOUND'
        });
      }
      
      if (document.documentType !== 'Transferable') {
        return res.status(400).json({
          error: 'Document is not transferable',
          code: 'NON_TRANSFERABLE_DOCUMENT'
        });
      }
      
      // Check if user has permission to view
      const userId = req.user._id;
      if (document.creator.toString() !== userId.toString() &&
          !document.endorsementChain.includes(userId)) {
        return res.status(403).json({
          error: 'You do not have permission to view this document ownership',
          code: 'UNAUTHORIZED_ACCESS'
        });
      }
      
      let ownershipInfo;
      
      if (document.blockchainId) {
        try {
            ownershipInfo = await BlockchainService.getDocumentOwnership(
                document.documentHash,
                document.blockchainId
            );
        } catch (blockchainError) {
            console.error('Error getting ownership from blockchain:', blockchainError);
            return res.status(500).json({
                error: 'Failed to retrieve document ownership from blockchain',
                code: 'BLOCKCHAIN_ERROR'
            });
        }
        } else {
            ownershipInfo = {
                beneficiary: document.creator,
                holder: document.creator
            };
        }

        res.json({
            document: {
                id: document._id,
                documentType: document.documentType,
                documentHash: document.documentHash,
                status: document.status
            },
            ownership: ownershipInfo
        });
        } catch (error) {
            console.error('Get document ownership error:', error);
            res.status(500).json({
                error: error.message,
                code: 'SERVER_ERROR'
            });
        }
    }

}

module.exports = new DocumentController();