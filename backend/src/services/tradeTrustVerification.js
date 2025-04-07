// backend/src/services/tradeTrustVerificationService.js
const { verify } = require('@tradetrust-tt/tt-verify');
const BlockchainService = require('./blockchainService');

class TradeTrustVerificationService {
  async verifyDocument(documentData) {
    try {
      const isOAFormat = documentData.version === 'https://schema.openattestation.com/2.0/schema.json';
      
      if(!isOAFormat) {
        throw new Error('Invalid document format. Expected OpenAttestation format.');
      }


      const verificationResults = await verify(documentData);
      const isDocumentValid = verificationResults.every(result => result.status === "VALID");
      
      const documentHash = document.signature?.targetHash || documentData.documentHash;
      
      let blockchainVerification = false;
      if (documentHash) {
        blockchainVerification = await BlockchainService.verifyDocumentOnBlockchain(documentHash);
      }
      
      const documentIntegrity = verificationResults.find(r => r.type === "DOCUMENT_INTEGRITY");
      
      return {
        verified: isDocumentValid && blockchainVerification,
        onBlockchain: blockchainVerification,
        inDtabase: true,
        details: verificationResults
      };
    } catch (error) {
      console.error('TradeTrust verification error:', error);
      return {
        verified: false,
        error: error.message
      };
    }
  }
  
  async verifyDocumentHash(documentHash) {
    try {
      const blockchainVerification = await BlockchainService.verifyDocumentOnBlockchain(documentHash);
      
      return {
        verified: blockchainVerification,
        onBlockchain: blockchainVerification
      };
    } catch (error) {
      console.error('Document hash verification error:', error);
      return {
        verified: false,
        error: error.message
      };
    }
  }
}

module.exports = new TradeTrustVerificationService();