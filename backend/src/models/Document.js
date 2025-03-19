// Enhanced Document.js model
const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
    blockchainId: {
        type: String,
        required: true,
        unique: true
    },
    transactionHash: {
        type: String,
        required: true
    },
    blockNumber: {
        type: Number,
        required: true
    },
    documentType: {
        type: String,
        enum: ['Transferable', 'Verifiable'],
        required: true
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    documentHash: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['Draft', 'Active', 'Verified', 'Transferred', 'Revoked'],
        default: 'Draft'
    },
    endorsementChain: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    expiryDate: {
        type: Date
    },
    verificationTransactionHash: {
        type: String
    },
    verificationBlockNumber: {
        type: Number
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    verifiedAt: {
        type: Date
    },
    transferTransactionHash: {
        type: String
    },
    transferBlockNumber: {
        type: Number
    },
    revocationTransactionHash: {
        type: String
    },
    revocationBlockNumber: {
        type: Number
    },
    revokedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    revokedAt: {
        type: Date
    }
}, { 
    timestamps: true 
});

DocumentSchema.virtual('isExpired').get(function() {
    if (!this.expiryDate) return false;
    return new Date() > this.expiryDate;
});

DocumentSchema.methods.verifyHash = function(metadata) {
    const crypto = require('crypto');
    const calculatedHash = crypto.createHash('sha256')
        .update(JSON.stringify(metadata))
        .digest('hex');
    return calculatedHash === this.documentHash;
};

module.exports = mongoose.model('Document', DocumentSchema);