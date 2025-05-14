const dns = require('dns').promises;

class DnsVerificationService {
  async verifyDnsTxt(domain, expectedRecord) {
    try {
      if (!domain || !expectedRecord) {
        return { verified: false, error: 'Missing domain or expected record' };
      }
      
      const records = await dns.resolveTxt(domain);
      const flatRecords = records.flat();
      
      const foundRecord = flatRecords.some(record => 
        record.includes(expectedRecord)
      );
      
      return {
        verified: foundRecord,
        domain,
        records: flatRecords
      };
    } catch (error) {
      console.error(`DNS verification error for ${domain}:`, error);
      return {
        verified: false,
        domain,
        error: error.message
      };
    }
  }

  formatOpenAttestationDnsRecord(documentHash) {
    return `openatts net=ethereum netId=51 addr=${documentHash}`;
  }

  extractDnsFromDocument(documentData) {
    try {
      const issuer = documentData.data?.issuers?.[0];
      if (issuer?.identityProof?.type === "DNS-TXT" && 
          issuer?.identityProof?.location) {
        return issuer.identityProof.location;
      }
      return null;
    } catch (error) {
      console.error('Error extracting DNS from document:', error);
      return null;
    }
  }
}

module.exports = new DnsVerificationService();