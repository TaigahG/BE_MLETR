// services/blockchainMonitorService.js
const {Web3} = require('web3');
const DocumentManagementABI = require('../contracts/DocumentManagement.json');
const Document = require('../models/Document');
const Transfer = require('../models/Transfer');
const DocumentHistory = require('../models/DocumentHistory');
const documentHistoryService = require('./documentHistoryService');

class BlockchainMonitorService {
    constructor() {
        this.web3 = new Web3(process.env.BLOCKCHAIN_PROVIDER);
        
        this.documentManagementContract = new this.web3.eth.Contract(
            DocumentManagementABI.abi,
            process.env.DOCUMENT_MANAGEMENT_CONTRACT_ADDRESS
        );
        
        // Block processing state
        this.lastProcessedBlock = 0;
        this.isMonitoring = false;
    }
    
    // Start monitoring blockchain events
    async startMonitoring() {
        if (this.isMonitoring) return;
        
        this.isMonitoring = true;
        
        try {
            // Get last processed block from DB or start from current block
            const currentBlock = await this.web3.eth.getBlockNumber();
            this.lastProcessedBlock = currentBlock - 1000; // Start from 1000 blocks ago or use stored value
            
            console.log(`Starting blockchain monitor from block ${this.lastProcessedBlock}`);
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Start block processor
            this.processBlocks();
        } catch (error) {
            console.error('Failed to start blockchain monitoring:', error);
            this.isMonitoring = false;
        }
    }
    
    // Set up event listeners for new events
    setupEventListeners() {
        // Listen for DocumentCreated events
        this.documentManagementContract.events.DocumentCreated({
            fromBlock: 'latest'
        })
        .on('data', async (event) => {
            await this.handleDocumentCreatedEvent(event);
        })
        .on('error', (error) => {
            console.error('DocumentCreated event error:', error);
        });
        
        // Listen for DocumentVerified events
        this.documentManagementContract.events.DocumentVerified({
            fromBlock: 'latest'
        })
        .on('data', async (event) => {
            await this.handleDocumentVerifiedEvent(event);
        })
        .on('error', (error) => {
            console.error('DocumentVerified event error:', error);
        });
        
        // Listen for DocumentTransferred events
        this.documentManagementContract.events.DocumentTransferred({
            fromBlock: 'latest'
        })
        .on('data', async (event) => {
            await this.handleDocumentTransferredEvent(event);
        })
        .on('error', (error) => {
            console.error('DocumentTransferred event error:', error);
        });
    }
    
    // Process past blocks to catch up
    async processBlocks() {
        try {
            const currentBlock = await this.web3.eth.getBlockNumber();
            
            if (currentBlock <= this.lastProcessedBlock) {
                // Schedule next check
                setTimeout(() => this.processBlocks(), 15000);
                return;
            }
            
            console.log(`Processing blocks ${this.lastProcessedBlock + 1} to ${currentBlock}`);
            
            // Get past events in batches
            const batchSize = 1000;
            let fromBlock = this.lastProcessedBlock + 1;
            
            while (fromBlock <= currentBlock) {
                const toBlock = Math.min(fromBlock + batchSize - 1, currentBlock);
                
                // Process DocumentCreated events
                const createdEvents = await this.documentManagementContract.getPastEvents('DocumentCreated', {
                    fromBlock,
                    toBlock
                });
                
                for (const event of createdEvents) {
                    await this.handleDocumentCreatedEvent(event);
                }
                
                // Process DocumentVerified events
                const verifiedEvents = await this.documentManagementContract.getPastEvents('DocumentVerified', {
                    fromBlock,
                    toBlock
                });
                
                for (const event of verifiedEvents) {
                    await this.handleDocumentVerifiedEvent(event);
                }
                
                // Process DocumentTransferred events
                const transferredEvents = await this.documentManagementContract.getPastEvents('DocumentTransferred', {
                    fromBlock,
                    toBlock
                });
                
                for (const event of transferredEvents) {
                    await this.handleDocumentTransferredEvent(event);
                }
                
                fromBlock = toBlock + 1;
            }
            
            // Update last processed block
            this.lastProcessedBlock = currentBlock;
            
            // Schedule next check
            setTimeout(() => this.processBlocks(), 15000);
        } catch (error) {
            console.error('Error processing blocks:', error);
            // Retry after a delay
            setTimeout(() => this.processBlocks(), 30000);
        }
    }
    
    // Handle DocumentCreated events
    async handleDocumentCreatedEvent(event) {
        try {
            const { documentId, creator, category } = event.returnValues;
            
            // Check if we already have this document in our database
            const existingDocument = await Document.findOne({ blockchainId: documentId });
            
            if (existingDocument) {
                // Update existing document if needed
                if (existingDocument.status === 'Draft') {
                    existingDocument.status = 'Active';
                    existingDocument.transactionHash = event.transactionHash;
                    existingDocument.blockNumber = event.blockNumber;
                    await existingDocument.save();
                    
                    // Record in history
                    await documentHistoryService.recordDocumentActivation(
                        existingDocument._id,
                        existingDocument.creator,
                        event.transactionHash
                    );
                    
                    console.log(`Updated document ${documentId} status to Active`);
                }
            } else {
                console.log(`Found new document ${documentId} on blockchain that's not in our database`);
                // Optionally create a record for tracking purposes or alert admins
            }
        } catch (error) {
            console.error(`Error handling DocumentCreated event for document ${event.returnValues.documentId}:`, error);
        }
    }
    
    // Handle DocumentVerified events
    async handleDocumentVerifiedEvent(event) {
        try {
            const { documentId, verifier } = event.returnValues;
            
            const document = await Document.findOne({ blockchainId: documentId });
            
            if (!document) {
                console.log(`Document ${documentId} not found in database for verification event`);
                return;
            }
            
            // Update document status if not already verified
            if (document.status !== 'Verified') {
                document.status = 'Verified';
                document.verificationTransactionHash = event.transactionHash;
                document.verificationBlockNumber = event.blockNumber;
                document.verificationTimestamp = new Date();
                
                await document.save();
                
                // Record in history
                await documentHistoryService.recordDocumentVerification(
                    document._id,
                    document.verifiedBy || document.creator, // Use verifiedBy if available, otherwise fallback to creator
                    event.transactionHash
                );
                
                console.log(`Updated document ${documentId} status to Verified`);
            }
        } catch (error) {
            console.error(`Error handling DocumentVerified event for document ${event.returnValues.documentId}:`, error);
        }
    }
    
    // Handle DocumentTransferred events
    async handleDocumentTransferredEvent(event) {
        try {
            const { documentId, from, to } = event.returnValues;
            
            const document = await Document.findOne({ blockchainId: documentId });
            
            if (!document) {
                console.log(`Document ${documentId} not found in database for transfer event`);
                return;
            }
            
            // Update document with transfer details
            document.status = 'Transferred';
            document.transferTransactionHash = event.transactionHash;
            document.transferBlockNumber = event.blockNumber;
            
            // Find user ID by wallet address if possible
            // This is simplified - you need to implement the actual lookup
            const toUserId = await this.findUserByWalletAddress(to);
            if (toUserId && !document.endorsementChain.includes(toUserId)) {
                document.endorsementChain.push(toUserId);
            }
            
            await document.save();
            
            // Record in history
            if (toUserId) {
                await documentHistoryService.recordDocumentTransfer(
                    document._id,
                    document.creator, // Assuming creator is transferring, adjust as needed
                    toUserId,
                    event.transactionHash
                );
            }
            
            console.log(`Updated document ${documentId} status to Transferred`);
            
            // Also update any pending transfers
            const pendingTransfers = await Transfer.find({
                document: document._id,
                status: 'Pending'
            });
            
            for (const transfer of pendingTransfers) {
                transfer.status = 'Completed';
                transfer.blockchainTransactionHash = event.transactionHash;
                await transfer.save();
                
                console.log(`Updated transfer ${transfer._id} status to Completed`);
            }
        } catch (error) {
            console.error(`Error handling DocumentTransferred event for document ${event.returnValues.documentId}:`, error);
        }
    }
    
    // Helper method to find a user by wallet address
    async findUserByWalletAddress(walletAddress) {
        try {
            const User = require('../models/User');
            const user = await User.findOne({ walletAddress });
            return user ? user._id : null;
        } catch (error) {
            console.error('Error finding user by wallet address:', error);
            return null;
        }
    }
    
    // Stop monitoring
    stopMonitoring() {
        this.isMonitoring = false;
        console.log('Blockchain monitoring stopped');
    }
}

module.exports = new BlockchainMonitorService();