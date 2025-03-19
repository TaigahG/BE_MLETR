const axios = require('axios');

class ChainlinkService {
    constructor() {
        this.chainlinkOracleUrl = process.env.CHAINLINK_ORACLE_URL;
    }

    async verifyDocument(documentId, documentData) {
        try {
            const response = await axios.post(`${this.chainlinkOracleUrl}/verify`, {
                documentId,
                documentData
            });

            return {
                verified: response.data.verified,
                details: response.data.details
            };
        } catch (error) {
            console.error('Chainlink verification error:', error);
            throw new Error(`Document verification failed: ${error.message}`);
        }
    }

    async fetchExternalData(dataSource, params) {
        try {
            const response = await axios.get(dataSource, { params });
            return response.data;
        } catch (error) {
            console.error('Chainlink external data fetch error:', error);
            throw new Error(`Data fetch failed: ${error.message}`);
        }
    }

    async requestExternalVerification(documentId, verificationEndpoint) {
        try {
            const response = await axios.post(`${this.chainlinkOracleUrl}/request-verification`, {
                documentId,
                verificationEndpoint
            });

            return {
                requestId: response.data.requestId,
                status: response.data.status
            };
        } catch (error) {
            console.error('Chainlink verification request error:', error);
            throw new Error(`Verification request failed: ${error.message}`);
        }
    }
}

module.exports = new ChainlinkService();
