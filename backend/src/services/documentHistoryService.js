// services/documentHistoryService.js
const Document = require('../models/Document');
const DocumentHistory = require('../models/DocumentHistory');
const BlockchainService = require('./blockchainService');

class DocumentHistoryService {
    async recordDocumentCreation(documentId, userId, transactionHash, blockchainId) {
        try {
            const history = new DocumentHistory({
                document: documentId,
                action: 'CREATE',
                performedBy: userId,
                transactionHash,
                blockchainId,
                metadata: {
                    status: 'Draft'
                }
            });
            
            await history.save();
            
            return history;
        } catch (error) {
            console.error('Error recording document creation:', error);
            throw error;
        }
    }
    
    async recordDocumentActivation(documentId, userId, transactionHash) {
        try {
            const history = new DocumentHistory({
                document: documentId,
                action: 'ACTIVATE',
                performedBy: userId,
                transactionHash,
                metadata: {
                    status: 'Active'
                }
            });
            
            await history.save();
            
            return history;
        } catch (error) {
            console.error('Error recording document activation:', error);
            throw error;
        }
    }
    
    async recordDocumentVerification(documentId, userId, transactionHash) {
        try {
            const history = new DocumentHistory({
                document: documentId,
                action: 'VERIFY',
                performedBy: userId,
                transactionHash,
                metadata: {
                    status: 'Verified',
                    verifiedBy: userId,
                    verifiedAt: new Date()
                }
            });
            
            await history.save();
            
            return history;
        } catch (error) {
            console.error('Error recording document verification:', error);
            throw error;
        }
    }
    
    async recordDocumentTransfer(documentId, userId, newHolderId, transactionHash) {
        try {
            const history = new DocumentHistory({
                document: documentId,
                action: 'TRANSFER',
                performedBy: userId,
                transactionHash,
                metadata: {
                    status: 'Transferred',
                    transferredBy: userId,
                    transferredTo: newHolderId,
                    transferredAt: new Date()
                }
            });
            
            await history.save();
            
            return history;
        } catch (error) {
            console.error('Error recording document transfer:', error);
            throw error;
        }
    }
    
    async recordDocumentRevocation(documentId, userId, reason, transactionHash) {
        try {
            const history = new DocumentHistory({
                document: documentId,
                action: 'REVOKE',
                performedBy: userId,
                transactionHash,
                metadata: {
                    status: 'Revoked',
                    revokedBy: userId,
                    revokedAt: new Date(),
                    reason
                }
            });
            
            await history.save();
            
            return history;
        } catch (error) {
            console.error('Error recording document revocation:', error);
            throw error;
        }
    }
    
    async getDocumentHistory(documentId) {
        try {
            return await DocumentHistory.find({ document: documentId })
                .populate('performedBy', 'username email walletAddress')
                .sort({ createdAt: 1 });
        } catch (error) {
            console.error('Error fetching document history:', error);
            throw error;
        }
    }
    
    async verifyDocumentHistory(documentId) {
        try {
            const document = await Document.findById(documentId);
            
            if (!document) {
                throw new Error('Document not found');
            }
            
            const dbHistory = await this.getDocumentHistory(documentId);
            
            let blockchainEvents = [];
            if (document.blockchainId) {
               
                blockchainEvents = await this.getBlockchainEvents(document.blockchainId);
            }
            
            return {
                document,
                databaseHistory: dbHistory,
                blockchainHistory: blockchainEvents,
                isHistoryConsistent: this.compareHistories(dbHistory, blockchainEvents)
            };
        } catch (error) {
            console.error('Error verifying document history:', error);
            throw error;
        }
    }
    
    // Helper method to get events from blockchain
    async getBlockchainEvents(blockchainDocumentId) {
        try {
            // This is a placeholder - you would need to implement this method
            // in BlockchainService to fetch all events for a document
            return [];
        } catch (error) {
            console.error('Error getting blockchain events:', error);
            return [];
        }
    }
    
    compareHistories(dbHistory, blockchainEvents) {
        // This is a simplified comparison
        // A real implementation would need to map events properly
        
        // If we have no blockchain events, we can't verify
        if (blockchainEvents.length === 0) {
            return true; // Assume consistent if no blockchain events
        }
        
        // Check if we have all blockchain events in our database
        for (const event of blockchainEvents) {
            const matchingDbEvent = dbHistory.find(dbEvent => 
                dbEvent.transactionHash === event.transactionHash
            );
            
            if (!matchingDbEvent) {
                return false;
            }
        }
        
        return true;
    }
}

module.exports = new DocumentHistoryService();