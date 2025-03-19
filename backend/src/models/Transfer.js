const mongoose = require('mongoose');

const TransferSchema = new mongoose.Schema({
    document: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
        required: true
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    recipient: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed', 'Rejected'],
        default: 'Pending'
    },
    transferDetails: {
        type: mongoose.Schema.Types.Mixed
    },
    blockchainTransactionHash: {
        type: String
    }
}, { 
    timestamps: true 
});

module.exports = mongoose.model('Transfer', TransferSchema);
