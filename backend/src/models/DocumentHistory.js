const mongoose = require('mongoose');

const DocumentHistorySchema = new mongoose.Schema({
    document: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
        required: true
    },
    action: {
        type: String,
        enum: ['CREATE', 'ACTIVATE', 'VERIFY', 'TRANSFER', 'REVOKE', 'UPDATE'],
        required: true
    },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    transactionHash: {
        type: String
    },
    blockchainId: {
        type: String
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed
    }
}, { 
    timestamps: true 
});

DocumentHistorySchema.index({ document: 1, createdAt: -1 });

module.exports = mongoose.model('DocumentHistory', DocumentHistorySchema);