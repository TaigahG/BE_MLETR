const Document = require('../models/Document');
const BlockchainService = require('./blockchainService');

class DocumentService {
    async createDocument(documentData, user) {
        try {
            const documentHash = this.generateDocumentHash(documentData);

            const blockchainDocumentData = {
                category: documentData.documentType === 'Transferable' ? 0 : 1,
                documentType: 0, // Default document type
                documentHash,
                expiryDate: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
                metadataKeys: Object.keys(documentData.metadata).map(key => 
                    Buffer.from(key, 'utf8')
                ),
                metadataValues: Object.values(documentData.metadata).map(value => 
                    Buffer.from(JSON.stringify(value), 'utf8')
                )
            };

=            const blockchainId = await BlockchainService.createDocument(blockchainDocumentData);

            const document = new Document({
                blockchainId,
                documentType: documentData.documentType,
                creator: user._id,
                metadata: documentData.metadata,
                documentHash,
                status: 'Draft'
            });

            await document.save();

            return document;
        } catch (error) {
            throw new Error(`Document creation failed: ${error.message}`);
        }
    }

    async getDocumentById(documentId) {
        return await Document.findById(documentId)
            .populate('creator')
            .populate('endorsementChain');
    }

    async getUserDocuments(userId) {
        return await Document.find({
            $or: [
                { creator: userId },
                { endorsementChain: userId }
            ]
        }).populate('creator');
    }

    generateDocumentHash(documentData) {
        const crypto = require('crypto');
        return crypto.createHash('sha256')
            .update(JSON.stringify(documentData.metadata))
            .digest('hex');
    }
}

module.exports = new DocumentService();
