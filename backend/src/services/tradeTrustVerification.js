const { verify } = require('@tradetrust-tt/tt-verify');
const BlockchainService = require('./blockchainService');

class TradeTrustVerificationService {
  async verifyDocument(documentData) {
    try {
      const isOAFormat = documentData.version === 'https://schema.openattestation.com/2.0/schema.json';
      
      if(!isOAFormat) {
        throw new Error('Invalid document format. Expected OpenAttestation format.');
      }
      
      const documentHash = document.signature?.targetHash || documentData.documentHash;
      if(!documentHash){
        throw new Error('Document hash not found. Cannot verify document on blockchain.');
      }

      const document = await Document.findOne({ hash: documentHash });
      const inDatabase = !!document;
      
      let blockchainVerification = false;
      
      try{
        blockchainVerification = await BlockchainService.verifyDocumentOnBlockchain(documentHash);
      } catch (error) {
        console.error('Blockchain verification error:', error);
      }

      let verificationResults = [];
      try{
        verificationResults = await verify(documentData);
      }catch (error) {
        console.error('Trade trust verification error:', error);
      }
            
      return {
        verified: inDatabase || blockchainVerification,
        onBlockchain: blockchainVerification,
        inDatabase: inDatabase,
        documentDetails: document ? {
          id: document._id,
          status: document.status,
          documentType: document.documentType,
          creator: document.creator,
          createdAt: document.createdAt
        } : null,
        tradeTrustVerification: verificationResults
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