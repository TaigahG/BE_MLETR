// backend/src/models/Document.js
const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema({
    blockchainId: {
        type: String,
        required: false,
        unique: false
    },
    transactionHash: {
        type: String,
        required: false,
    },
    blockNumber: {
        type: Number,
        required: false,
    },
    documentType: {
        type: String,
        enum: ['Transferable', 'Verifiable'],
        required: true
    },
    documentFormat: {
        type: String,
        enum: ['OpenAttestation', 'Legacy', 'Custom'],
        default: 'OpenAttestation'
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
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['Draft', 'Active', 'Verified', 'Transferred', 'Revoked', 'PendingVerification', 'PendingTransfer', 'Error'],
        default: 'Draft'
    },
    endorsementChain: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    expiryDate: {
        type: Date
    },
    verificationDetails: {
        documentIntegrity: {
            type: Boolean,
            default: null
        },
        issuerIdentity: {
            type: Boolean,
            default: null
        },
        didVerified: {
            type: Boolean,
            default: null
        },
        dnsVerified: {
            type: Boolean,
            default: null
        },
        onBlockchain: {
            type: Boolean,
            default: null
        },
        revoked: {
            type: Boolean,
            default: false
        },
        lastVerified: {
            type: Date
        }
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
    },
    lastVerificationAttempt: {
        type: Date
    },
    verificationErrors: [String]
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

DocumentSchema.methods.updateVerificationDetails = async function(verificationData) {
    this.verificationDetails = {
        ...this.verificationDetails,
        ...verificationData,
        lastVerified: new Date()
    };
    
    // Update status based on verification results
    if (verificationData.revoked) {
        this.status = 'Revoked';
    } else if (this.verificationDetails.documentIntegrity && 
               this.verificationDetails.issuerIdentity && 
               this.verificationDetails.onBlockchain) {
        this.status = 'Verified';
    }
    
    await this.save();
    return this;
};

// Add index for faster lookups
DocumentSchema.index({ documentHash: 1 });
DocumentSchema.index({ creator: 1 });
DocumentSchema.index({ status: 1 });

module.exports = mongoose.model('Document', DocumentSchema);