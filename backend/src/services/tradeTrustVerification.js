// backend/src/services/tradeTrustVerificationService.js
const { verify, isValid } = require('@govtechsg/oa-verify');
const { wrapDocument } = require('@govtechsg/open-attestation');
const BlockchainService = require('./blockchainService');

class TradeTrustVerificationService {
  async verifyDocument(documentData) {
    try {
      const isOAFormat = documentData.version === 'https://schema.openattestation.com/2.0/schema.json';
      
      const document = isOAFormat ? documentData : wrapDocument(documentData);
      
      const verificationResults = await verify(document);
      const isDocumentValid = isValid(verificationResults);
      
      const documentHash = document.signature?.targetHash || documentData.documentHash;
      
      let blockchainVerification = false;
      if (documentHash) {
        blockchainVerification = await BlockchainService.verifyDocumentOnBlockchain(documentHash);
      }
      
      const documentIntegrity = verificationResults.find(r => r.type === "DOCUMENT_INTEGRITY");
      
      return {
        verified: isDocumentValid && blockchainVerification,
        documentIntegrity: documentIntegrity?.status === "VALID",
        onBlockchain: blockchainVerification,
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