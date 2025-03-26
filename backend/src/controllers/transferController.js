const Transfer = require('../models/Transfer');
const Document = require('../models/Document');
const BlockchainService = require('../services/blockchainService');

class TransferController {
    async initiateTransfer(req, res) {
        try {
            const { documentId, recipient } = req.body;
            const sender = req.user._id;

            const document = await Document.findById(documentId);
            if (!document) {
                return res.status(404).json({ error: 'Document not found' });
            }

            if (document.documentType !== 'Transferable') {
                return res.status(400).json({ error: 'Document is not transferable' });
            }

            const transfer = new Transfer({
                document: documentId,
                sender,
                recipient,
                status: 'Pending'
            });

            await transfer.save();

            await BlockchainService.initiateDocumentTransfer(
                document.blockchainId, 
                sender, 
                recipient
            );

            res.status(201).json({
                message: 'Transfer initiated successfully',
                transfer
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async approveTransfer(req, res) {
        try {
            const { transferId } = req.params;
            const recipient = req.user._id;

            const transfer = await Transfer.findById(transferId)
                .populate('document')
                .populate('sender')
                .populate('recipient');

            if (!transfer) {
                return res.status(404).json({ error: 'Transfer not found' });
            }

            if (transfer.recipient.toString() !== recipient.toString()) {
                return res.status(403).json({ error: 'Unauthorized transfer approval' });
            }

            await BlockchainService.transferDocument(
                transfer.document.blockchainId, 
                recipient
            );

            transfer.status = 'Completed';
            await transfer.save();

            const document = transfer.document;
            document.endorsementChain.push(recipient);
            document.status = 'Transferred';
            await document.save();

            res.json({
                message: 'Transfer approved successfully',
                transfer
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async rejectTransfer(req, res) {
        try {
            const { transferId } = req.params;
            const recipient = req.user._id;

            const transfer = await Transfer.findById(transferId)
                .populate('recipient');

            if (!transfer) {
                return res.status(404).json({ error: 'Transfer not found' });
            }

            if (transfer.recipient.toString() !== recipient.toString()) {
                return res.status(403).json({ error: 'Unauthorized transfer rejection' });
            }

            transfer.status = 'Rejected';
            await transfer.save();

            res.json({
                message: 'Transfer rejected successfully',
                transfer
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }

    async getTransferHistory(req, res) {
        try {
            const { documentId } = req.params;

            const transfers = await Transfer.find({ document: documentId })
                .populate('sender')
                .populate('recipient')
                .populate('document')
                .sort({ createdAt: -1 });

            res.json({
                message: 'Transfer history retrieved successfully',
                transfers
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    }
}

module.exports = new TransferController();
