const { verify } = require('@tradetrust-tt/tt-verify');
const BlockchainService = require('./blockchainService');
const {Resolver} = require('did-resolver');
const { getResolver } = require('web-did-resolver');
const dnsVerificationService = require('./dnsVerificationService');

class TradeTrustVerificationService {
  constructor() {
    // Initialize DID resolver
    this.didResolver = new Resolver(getResolver());
  }
  async verifyDocument(documentData) {

    try {
      const isOAFormat = documentData.version === 'https://schema.openattestation.com/2.0/schema.json';
      
      if(!isOAFormat) {
        throw new Error('Invalid document format. Expected OpenAttestation format.');
      }

      const verifyResult = await verify(documentData);

      //extract issuer DID
      const issuerDid = this.extractIssuerDid(documentData);

      //verify issuer DID
      let verifyDid = {status: "INVALID", name: "ISSUER_DID"};
      if(issuerDid){
        verifyDid = await this.verifyDid(issuerDid)
      }
      
      
      const documentHash = document.signature?.targetHash || documentData.documentHash;
      let blockchainVerification = false;
      if(!documentHash){
        blockchainVerification = await BlockchainService.verifyDocumentOnBlockchain(documentHash)
      }

      const isRevoked = await this.checkRevocation(documentHash)

      const dnsLocation = dnsVerificationService.extractDnsFromDocument(documentData)
      let dnsVerification = { status: "SKIPPED", name: "DNS_TXT" };
      if (dnsLocation && documentHash) {
        const expectedRecord = DnsVerificationService.formatOpenAttestationDnsRecord(documentHash);
        const dnsResult = await DnsVerificationService.verifyDnsTxt(dnsLocation, expectedRecord);
        
        dnsVerification = {
          status: dnsResult.verified ? "VALID" : "INVALID",
          name: "DNS_TXT",
          location: dnsLocation,
          reason: dnsResult.verified ? undefined : "DNS-TXT record not found"
        };
      }

      const isValid = verifyResult.every(result => result.status === "VALID")
                      && blockchainVerification
                      && verifyDid.status === "VALID"
                      &&(dnsVerification.status === "VALID" || dnsVerification.status === "SKIPPED")
                      && !isRevoked

    
      return {
        verified: isValid,
        onBlockchain: blockchainVerification,
        didVerified: verifyDid.status === "VALID",
        revoked: isRevoked,
        details: {
            documentIntegrity: verifyResult.find(r => r.type === "DOCUMENT_INTEGRITY")?.status === "VALID",
            issueIdentity: verifyResult.find(r => r.type === "ISSUER_IDENTITY")?.status === "VALID",
            didVerifcation: verifyDid,
            documentStatus: verifyResult.find(r => r.type === "DOCUMENT_STATUS")?.status === "VALID",
            allChecks: verifyResult
        }
      };



      // const document = await Document.findOne({ hash: documentHash });
      // const inDatabase = !!document;
      
      // let blockchainVerification = false;
      
      // try{
      //   blockchainVerification = await BlockchainService.verifyDocumentOnBlockchain(documentHash);
      // } catch (error) {
      //   console.error('Blockchain verification error:', error);
      // }

      // let verificationResults = [];
      // try{
      //   verificationResults = await verify(documentData);
      // }catch (error) {
      //   console.error('Trade trust verification error:', error);
      // }
            
      // return {
      //   verified: inDatabase || blockchainVerification,
      //   onBlockchain: blockchainVerification,
      //   inDatabase: inDatabase,
      //   documentDetails: document ? {
      //     id: document._id,
      //     status: document.status,
      //     documentType: document.documentType,
      //     creator: document.creator,
      //     createdAt: document.createdAt
      //   } : null,
      //   tradeTrustVerification: verificationResults
      // };
    } catch (error) {
      console.error('TradeTrust verification error:', error);
      return {
        verified: false,
        error: error.message,
        details: {
          errorStack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }
      };
    }
  }

  extractIssuerDid(documentData){
    try{
      const issuer = documentData.data?.issuers?.[0];
      if(issuer?.identityProof?.type === 'DID' && issuer?.id){
        return issuer.id;
      }
      return null
    }
    catch(error){
      console.error('Error extracting issuer DID:', error);
      return null;    
    }
  }

  async verifyDid(did){
    try{
      const didResolution = await this.didResolver.resolve(did);
      if(!didResolution || !didResolution.didDocument){
        return { status: "INVALID", name: "ISSUER_DID", reason: "Could not resolve DID" };
      }

      return { status: "VALID", name: "ISSUER_DID"};
    }
    catch(error){
      console.error('DID verification error:', error);
      return { 
        status: "INVALID", 
        name: "ISSUER_DID", 
        reason: error.message 
      };
    }
  }
  
  async checkRevocation(documentHash){
    try{
      const revocationStatus = await this.blockchainVerification.checkDocumentRevocation(documentHash)
      return revocationStatus
    }catch(e){
      console.error('Error checking revocation status:', error);
      return false
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