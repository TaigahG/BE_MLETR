const mongoose = require('mongoose');

const VerificationLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  documentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document',
    required: false // Might not be in our database
  },
  documentHash: {
    type: String,
    required: true
  },
  successful: {
    type: Boolean,
    required: true
  },
  verificationDetails: {
    type: mongoose.Schema.Types.Mixed,
    required: false
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Add indexes for better performance
VerificationLogSchema.index({ userId: 1, timestamp: -1 });
VerificationLogSchema.index({ documentHash: 1 });
VerificationLogSchema.index({ documentId: 1 });
VerificationLogSchema.index({ timestamp: -1 });

module.exports = mongoose.model('VerificationLog', VerificationLogSchema);