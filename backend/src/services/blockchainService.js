const { Web3 } = require('web3');
const DocumentRegistryABI = require('../contracts/DocumentRegistry.json');
const DocumentManagementABI = require('../contracts/DocumentManagement.json');
const { events } = require('../models/User');
const Document = require('../models/Document');
const User = require('../models/User');

class BlockchainService {
    constructor() {
        this.web3 = new Web3(process.env.BLOCKCHAIN_PROVIDER);

        this.pendingTransactions = new Map();
        this.lastUsedNonce = null;
        this.nonceInitialized = false;

        if (process.env.BLOCKCHAIN_PRIVATE_KEY) {
            try {
                const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY.startsWith('0x') 
                    ? process.env.BLOCKCHAIN_PRIVATE_KEY 
                    : '0x' + process.env.BLOCKCHAIN_PRIVATE_KEY;
                
                this.account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
                
                this.web3.eth.accounts.wallet.add(this.account);
                
                console.log('Blockchain account initialized:', this.account.address);
            } catch (error) {
                console.error('Failed to initialize blockchain account:', error);
                throw new Error('Invalid blockchain private key configuration');
            }
        } else {
            console.error('No BLOCKCHAIN_PRIVATE_KEY provided');
            throw new Error('Missing blockchain private key configuration');
        }


        this.gasPrice = null;
        this.updateGasPrice();

        this.documentRegistryContract = new this.web3.eth.Contract(
            DocumentRegistryABI.abi, 
            process.env.DOCUMENT_REGISTRY_CONTRACT_ADDRESS
        );

        if (!process.env.DOCUMENT_MANAGEMENT_CONTRACT_ADDRESS) {
            throw new Error('DOCUMENT_MANAGEMENT_CONTRACT_ADDRESS is not defined in environment variables');
        }

        this.documentManagementContract = new this.web3.eth.Contract(
            DocumentManagementABI.abi, 
            process.env.DOCUMENT_MANAGEMENT_CONTRACT_ADDRESS
        );

        // this.checkRoles().catch(error => {
        //     console.error('Error during role check:', error);
        // });
    }


    async initializedNonce(){
        try{
            if(!this.account){
                throw new Error('No account to initialize nonce for');
            }
            const currentNonce = await this.web3.eth.getTransactionCount(this.account.address, 'pending');
            this.lastUsedNonce = Number(currentNonce)-1;
            this.nonceInitialized = true;
            console.log(`Initialized nonce counter to ${this.lastUsedNonce}`);
            return currentNonce;
        }catch(error){
            console.error('Error initializing nonce:', error);
            throw error;
        }
    }

    async getNonce() {
        if (!this.nonceInitialized) {
            await this.initializedNonce();
        }
        const currentNonce = await this.web3.eth.getTransactionCount(this.account.address, 'pending');
        const currentNonceNumber = Number(currentNonce);
        this.lastUsedNonce = Math.max(this.lastUsedNonce + 1, currentNonceNumber);

        console.log(`Current nonce for ${this.account.address}: ${this.lastUsedNonce}`);
        return this.lastUsedNonce;
    }
    async listenForDocumentEvents() {
        this.documentManagementContract.events.DocumentCreated({
        fromBlock: 'latest'
        })
        .on('data', async (event) => {
        const { documentId, creator, category } = event.returnValues;
        console.log(`Document ${documentId} created by ${creator}`);
        
        await this.processDocumentCreatedEvent(documentId, creator, category, event);
        })

        this.documentManagementContract.events.DocumentVerified({
            fromBlock: 'latest'
        })
        .on('data', async (event) => {
            const { documentId, creator, category } = event.returnValues;
            console.log(`Document ${documentId} created by ${creator}`);
            
            await this.processDocumentCreatedEvent(documentId, creator, category, event);
        })

    }
  
  async processDocumentCreatedEvent(documentId, creator, category, event) {
    try {
      const document = await Document.findOne({ 
        blockchainId: documentId,
        'metadata.creator': creator 
      });
      
      if (document) {
        document.status = 'Active';
        document.transactionHash = event.transactionHash;
        document.blockNumber = event.blockNumber;
        await document.save();
        
        console.log(`Updated document ${documentId} status to Active`);
      } else {
        console.log(`Document ${documentId} created on blockchain but not found in database`);
      }
    } catch (error) {
      console.error(`Error processing DocumentCreated event for document ${documentId}:`, error);
    }
  }

    async updateGasPrice() {
        try{
        this.gasPrice = await this.web3.eth.getGasPrice();
        this.gasPrice = Math.floor(parseInt(this.gasPrice) * 1.1)

        setTimeout(() => this.updateGasPrice(), 10*60*1000);
        } catch (error) {
            this.gasPrice = this.web3.utils.toWei('10', 'gwei');
        }
    }

    async getSenderAccounts() {
        // If we've set up an account from private key, use it
        if (this.account) {
            return this.account.address;
        }

        // Otherwise, try to get accounts from connected provider
        const accounts = await this.web3.eth.getAccounts();

        if (!accounts || accounts.length === 0) {
            throw new Error('No accounts found in the connected blockchain provider');
        }

        return accounts[0];
    }


    // async checkRoles() {
    //     try {
    //         if (!this.account) {
    //             console.warn('No account to check roles for');
    //             return;
    //         }
            
    //         const address = this.account.address;
            
    //         const DOCUMENT_CREATOR_ROLE = await this.documentManagementContract.methods.DOCUMENT_CREATOR_ROLE().call();
            
    //         const hasCreatorRole = await this.documentManagementContract.methods.hasRole(
    //             DOCUMENT_CREATOR_ROLE, 
    //             address
    //         ).call();
            
    //         if (hasCreatorRole) {
    //             console.log(`Account ${address} has DOCUMENT_CREATOR_ROLE`);
    //         } else {
    //             console.warn(`Account ${address} is missing DOCUMENT_CREATOR_ROLE`);
    //             console.warn('Document creation on blockchain will fail due to missing role');
    //         }
    //     } catch (error) {
    //         console.error('Error checking roles:', error);
    //     }
    // }
        

    async createDocument(documentData) {
        try{

            console.log('Creating document on blockchain:', documentData);

            if (!this.account) {
                throw new Error('No blockchain account configured');
            }

            console.log('Account:', this.account.address);

            const sender = await this.getSenderAccounts();
            const expiryDate = BigInt(documentData.expiryDate);

            const nonce = await this.getNonce();

            const gasEstimate = await this.documentManagementContract.methods.createDocument(
                documentData.category,
                this.web3.utils.sha3(documentData.documentHash),
                expiryDate
            ).estimateGas({ from: sender });

            const gasToUse = BigInt(Math.floor(Number(gasEstimate) * 1.2));
            const gasPriceBigInt = BigInt(this.gasPrice);

            console.log(`Sending transaction with nonce ${nonce}, gas ${gasToUse.toString()}, gasPrice ${gasPriceBigInt.toString()}`);

            const result = await this.documentManagementContract.methods.createDocument(
                documentData.category,
                this.web3.utils.sha3(documentData.documentHash),
                expiryDate
            ).send({
                from: sender,
                gas: gasToUse.toString(),
                gasPrice: gasPriceBigInt.toString(),
                nonce: nonce
            })

            const documentCreatedEvent = result.events.DocumentCreated;
            console.log("DocEV: ",documentCreatedEvent)
            if(!documentCreatedEvent) {
                throw new Error('Document creation transaction did not emit DocumentCreated event');
            }
            return {
                documentId: documentCreatedEvent.returnValues.documentId,
                transactionHash: result.transactionHash,
                blockNumber: Number(result.blockNumber)
            };
        }
        catch(error){
            if (error.message.includes('nonce too low')) {
                console.error('Nonce error detected. Current nonce tracking may be incorrect.');
                this.nonceInitialized = false;
            }
            console.error('Document creation error:', error);
            throw new Error(`Document creation failed: ${error.message}`);
        }
    }

    async transferDocument(documentId, newHolder) {

        try{
            const sender = await this.getSenderAccounts();

            if(!this.web3.utils.isAddress(newHolder)) {
                throw new Error('Invalid new holder address');
            }
            const gasEstimate = await this.documentManagementContract.methods
            .transferDocument(documentId, newHolder)
            .estimateGas({ from: sender });

            const result = await this.documentManagementContract.methods
            .transferDocument(documentId, newHolder)
            .send({
                from: sender,
                gas: Math.floor(gasEstimate * 1.2),
                gasPrice: this.gasPrice
            });

            return{
                transactionHash: result.transactionHash,
                blockNumber: Number(result.blockNumber),
                events: result.events
            }
        }catch(error){
            console.error('Blockchain document transfer failed:', error);
            throw new Error(`Blockchain error: ${error.message}`);
        }
    }

    async verifyDocument(documentId, documentHash){
        try{
            const sender = await this.getSenderAccounts();

            const gasEstimate = await this.documentManagementContract.methods
            .verifyDocument(documentId)
            .estimateGas({ from: sender });

            const result = await this.documentManagementContract.methods
            .verifyDocument(documentId)
            .send({
                from: sender,
                gas: Math.floor(gasEstimate * 1.2),
                gasPrice: this.gasPrice
            })

            return{
                transactionHash: result.transactionHash,
                blockNumber: Number(result.blockNumber),
                events: result.events
            }

        }catch(error){
            
            console.error('Blockchain document verification failed:', error);
            throw new Error(`Blockchain error: ${error.message}`);
        }
    }

async verifyDocumentOnBlockchain(documentHash) {
    try {
      const formattedHash = documentHash.startsWith('0x') 
        ? documentHash 
        : '0x' + documentHash;
      
      const Document = require('../models/Document');
      const document = await Document.findOne({ documentHash: formattedHash.substring(2) });
      
      // If found in db, check status on blockchain
      if (document && document.blockchainId) {
        try {
          const documentData = await this.documentManagementContract.methods
            .getDocument(document.blockchainId)
            .call();
          
          return {
            exists: true,
            blockchainId: document.blockchainId,
            status: this.mapBlockchainStatus(documentData.status),
            issuer: documentData.creator,
            currentHolder: documentData.currentHolder,
            expiryDate: new Date(Number(documentData.expiryDate) * 1000),
            isExpired: Number(documentData.expiryDate) * 1000 < Date.now(),
            isRevoked: documentData.status === '4' // Assuming 4 is revoked status
          };
        } catch (error) {
          console.error('Error getting document from blockchain:', error);
          return { exists: false, error: 'Error fetching from blockchain' };
        }
      }
      
      // If not found in db or no blockchainId, search blockchain events
      try {
        const events = await this.documentManagementContract.getPastEvents('DocumentCreated', {
          filter: {
            documentHash: formattedHash
          },
          fromBlock: 0,
          toBlock: 'latest'
        });
        
        if (events.length > 0) {
          // Document exists on blockchain but might not be in our database
          const event = events[0];
          const documentId = event.returnValues.documentId;
          
          // Get full document data from blockchain
          const documentData = await this.documentManagementContract.methods
            .getDocument(documentId)
            .call();
          
          return {
            exists: true,
            blockchainId: documentId,
            status: this.mapBlockchainStatus(documentData.status),
            issuer: documentData.creator,
            currentHolder: documentData.currentHolder,
            expiryDate: new Date(Number(documentData.expiryDate) * 1000),
            isExpired: Number(documentData.expiryDate) * 1000 < Date.now(),
            isRevoked: documentData.status === '4'
          };
        }
        
        return { exists: false };
      } catch (error) {
        console.error('Error searching blockchain for document:', error);
        return { exists: false, error: 'Blockchain search error' };
      }
    } catch (error) {
      console.error('Error verifying document on blockchain:', error);
      return { exists: false, error: error.message };
    }
  }
  
  // Helper method to check document revocation
  async checkDocumentRevocation(documentHash) {
    try {
      const blockchainStatus = await this.verifyDocumentOnBlockchain(documentHash);
      return blockchainStatus.isRevoked === true;
    } catch (error) {
      console.error('Error checking document revocation:', error);
      return false;
    }
  }
  
  // Helper to map numeric blockchain status to readable status
  mapBlockchainStatus(statusCode) {
    const statusMap = {
      '0': 'Draft',
      '1': 'Active',
      '2': 'Verified',
      '3': 'Transferred',
      '4': 'Revoked'
    };
    
    return statusMap[statusCode] || 'Unknown';
  }

  async transferTransferableDocument(documentHash, newBeneficiary, newHolder) {
    try {
      const tokenId = await this.tokenRegistryContract.methods
        .getTokenIdByDocumentHash(documentHash)
        .call();
      
      if (!tokenId || tokenId === '0') {
        throw new Error('Document not found in token registry');
      }
      
      const escrowAddress = await this.documentTransferManagerContract.methods
        .getEscrowByDocumentHash(documentHash)
        .call();
      
      if (!escrowAddress) {
        throw new Error('Title escrow not found for document');
      }
      
      const titleEscrowContract = new this.web3.eth.Contract(
        TitleEscrowABI,
        escrowAddress
      );
      
      const beneficiary = await titleEscrowContract.methods.beneficiary().call();
      const holder = await titleEscrowContract.methods.holder().call();
      
      if (beneficiary.toLowerCase() !== this.account.address.toLowerCase() || 
          holder.toLowerCase() !== this.account.address.toLowerCase()) {
        throw new Error('Only the current beneficiary and holder can transfer the document');
      }
      
      const gasEstimate = await titleEscrowContract.methods
        .endorseTransfer(newBeneficiary, newHolder)
        .estimateGas({ from: this.account.address });
        
      const result = await titleEscrowContract.methods
        .endorseTransfer(newBeneficiary, newHolder)
        .send({
          from: this.account.address,
          gas: Math.floor(gasEstimate * 1.2),
          gasPrice: this.gasPrice
        });
        
      return {
        transactionHash: result.transactionHash,
        blockNumber: Number(result.blockNumber),
        events: result.events,
        escrowAddress
      };
    } catch (error) {
      console.error('Error transferring transferable document:', error);
      throw new Error(`Blockchain transfer error: ${error.message}`);
    }
  }
  
  async createTransferableDocument(documentData) {
    try {
      const { documentHash } = documentData;
      
      if (!documentHash) {
        throw new Error('Document hash is required');
      }
      
      // Generate token ID and mint the token
      const tokenId = await this.tokenRegistryContract.methods
        .mint(this.account.address, documentHash)
        .send({
          from: this.account.address,
          gas: 500000,
          gasPrice: this.gasPrice
        });
      
      // Create a title escrow for the document
      const titleEscrowAddress = await this.documentTransferManagerContract.methods
        .createTransferableDocument(
          documentHash,
          this.account.address, // Initial beneficiary
          this.account.address  // Initial holder
        )
        .send({
          from: this.account.address,
          gas: 1000000,
          gasPrice: this.gasPrice
        });
      
      return {
        tokenId,
        titleEscrowAddress,
        beneficiary: this.account.address,
        holder: this.account.address
      };
    } catch (error) {
      console.error('Error creating transferable document:', error);
      throw new Error(`Blockchain error: ${error.message}`);
    }
  }
    async getDocumentOwnership(documentHash, blockchainId) {
        try {
          // First check if the document exists in DocumentTransferManager
          const escrowAddress = await this.documentTransferManagerContract.methods
            .getEscrowByDocumentHash(documentHash)
            .call();
          
          if (!escrowAddress || escrowAddress === '0x0000000000000000000000000000000000000000') {
            // If not in the transfer manager, check the token registry directly
            const tokenId = await this.tokenRegistryContract.methods
              .getTokenIdByDocumentHash(documentHash)
              .call();
            
            if (!tokenId || tokenId === '0') {
              throw new Error('Document not found in token registry');
            }
            
            // Get the owner from the token registry
            const owner = await this.tokenRegistryContract.methods
              .ownerOf(tokenId)
              .call();
            
            return {
              beneficiary: owner,
              holder: owner,
              escrowAddress: null,
              isInEscrow: false
            };
          }
          
          // If in escrow, get the current beneficiary and holder
          const titleEscrowContract = new this.web3.eth.Contract(
            TitleEscrowABI,
            escrowAddress
          );
          
          const beneficiary = await titleEscrowContract.methods.beneficiary().call();
          const holder = await titleEscrowContract.methods.holder().call();
          const isSurrendered = await titleEscrowContract.methods.isSurrendered().call();
          
          return {
            beneficiary,
            holder,
            escrowAddress,
            isInEscrow: true,
            isSurrendered
          };
        } catch (error) {
          console.error('Error getting document ownership:', error);
          throw new Error(`Blockchain error: ${error.message}`);
        }
      }
      
      async transferDocumentOwnership(documentHash, newBeneficiary, newHolder) {
        try {
          // Check if the document exists and is in escrow
          const ownershipInfo = await this.getDocumentOwnership(documentHash);
          
          if (!ownershipInfo.isInEscrow) {
            throw new Error('Document is not in escrow, cannot transfer');
          }
          
          if (ownershipInfo.isSurrendered) {
            throw new Error('Document has been surrendered, cannot transfer');
          }
          
          // Get the escrow contract
          const titleEscrowContract = new this.web3.eth.Contract(
            TitleEscrowABI,
            ownershipInfo.escrowAddress
          );
          
          // Check if the caller is the current beneficiary and holder
          const currentBeneficiary = ownershipInfo.beneficiary;
          const currentHolder = ownershipInfo.holder;
          
          if (currentBeneficiary.toLowerCase() !== this.account.address.toLowerCase() ||
              currentHolder.toLowerCase() !== this.account.address.toLowerCase()) {
            throw new Error('Only the current beneficiary and holder can transfer ownership');
          }
          
          // Transfer ownership
          const gasEstimate = await titleEscrowContract.methods
            .endorseTransfer(newBeneficiary, newHolder)
            .estimateGas({ from: this.account.address });
          
          const result = await titleEscrowContract.methods
            .endorseTransfer(newBeneficiary, newHolder)
            .send({
              from: this.account.address,
              gas: Math.floor(gasEstimate * 1.2),
              gasPrice: this.gasPrice
            });
          
          return {
            transactionHash: result.transactionHash,
            blockNumber: Number(result.blockNumber),
            previousBeneficiary: currentBeneficiary,
            previousHolder: currentHolder,
            newBeneficiary,
            newHolder,
            escrowAddress: ownershipInfo.escrowAddress
          };
        } catch (error) {
          console.error('Error transferring document ownership:', error);
          throw new Error(`Blockchain error: ${error.message}`);
        }
      }
      
      async verifyTransferableDocument(documentHash) {
        try {
          // Check if the document exists in the token registry
          const tokenId = await this.tokenRegistryContract.methods
            .getTokenIdByDocumentHash(documentHash)
            .call();
          
          if (!tokenId || tokenId === '0') {
            return {
              exists: false,
              message: 'Document not found in token registry'
            };
          }
          
          // Check if the document is valid (not revoked)
          const isValid = await this.tokenRegistryContract.methods
            .isValidDocument(tokenId)
            .call();
          
          if (!isValid) {
            return {
              exists: true,
              isValid: false,
              message: 'Document has been revoked'
            };
          }
          
          // Get document data
          const documentData = await this.tokenRegistryContract.methods
            .getDocumentData(tokenId)
            .call();
          
          // Get ownership information
          const ownershipInfo = await this.getDocumentOwnership(documentHash);
          
          return {
            exists: true,
            isValid: true,
            tokenId,
            issuer: documentData.issuer,
            issuedAt: new Date(Number(documentData.issuedAt) * 1000),
            beneficiary: ownershipInfo.beneficiary,
            holder: ownershipInfo.holder,
            isInEscrow: ownershipInfo.isInEscrow,
            escrowAddress: ownershipInfo.escrowAddress
          };
        } catch (error) {
          console.error('Error verifying transferable document:', error);
          throw new Error(`Blockchain error: ${error.message}`);
        }
    }

    // // Add this helper function to your BlockchainService
    // async inspectDocumentEvents() {
    //     try {
    //     console.log('Inspecting document events structure...');
        
    //     // Get some past events
    //     const events = await this.documentManagementContract.getPastEvents('DocumentCreated', {
    //         fromBlock: 0,
    //         toBlock: 'latest',
    //         limit: 5 // Just get a few for inspection
    //     });
        
    //     if (events.length === 0) {
    //         console.log('No document events found.');
    //         return;
    //     }
        
    //     // Log the structure of the first event
    //     console.log('Sample event structure:', JSON.stringify(events[0], (key, value) => 
    //         typeof value === 'bigint' ? value.toString() : value, 2));
        
    //     // For each event, try to get the document data from the contract
    //     for (const event of events) {
    //         const documentId = event.returnValues.documentId;
    //         console.log(`\nDocument ID: ${documentId}`);
            
    //         try {
    //         // This is a placeholder - you'll need to create a method to get document by ID
    //         // if your contract has such a function
    //         const document = await this.documentManagementContract.methods
    //             .documents(documentId) // Assuming there's a public mapping or getter
    //             .call();
                
    //         console.log('Document hash from contract:', document.documentHash);
    //         } catch (error) {
    //         console.log('Could not retrieve document hash from contract:', error.message);
    //         }
    //     }
    //     } catch (error) {
    //     console.error('Error inspecting events:', error);
    //     }
    // }
    

}

module.exports = new BlockchainService();
