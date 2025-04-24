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


    async verifyDocumentOnBlockchain(documentHash, userId, res) {
        function stringToUint8Array(str) {
            const encoder = new TextEncoder();
            return encoder.encode(str);
          }
        try {
            if(!documentHash){
                throw new Error('Document hash not provided');
            }
            const formattedHash = documentHash.startsWith('0x') 
                ? documentHash 
                : '0x' + documentHash;
            
            console.log("formatted documents: ", formattedHash);

            const document = await Document.findOne({documentHash: documentHash.replace('/0x/', '')});

            console.log(`Document status before checking is  '${document.status}' verified by ${userId}`)


            if(document){
                console.log("found document with hash: ", document)

                if(document.status === 'Verified'){
                    console.log(`Document already verified by ${document.verifiedBy}`);
                    return true;
                }

                if(document.blockchainId && document.transactionHash){
                    await Document.findByIdAndUpdate(document.id,{
                        status: 'Verified',
                        verifiedBy: userId,
                        verifiedAt: new Date()
                    })
                    console.log(`Document status after checking is '${document.status}' verified by ${userId}`)
                    return true;
                }
            }
            
            try{
                const documentEvents = await this.documentManagementContract.getPastEvents('DocumentCreated', {
                    filter: {
                        documentHash: formattedHash
                    },
                    fromBlock: 0,
                    toBlock: 'latest'
                });

                for(const events in documentEvents){
                    if(events.returnValues.documentId && events.returnValues.documentHash === formattedHash){
                        return true;
                    }
                }
            }catch(err){
                console.error('Error querying blockchain events:', queryError);
            }

           
            return false;
        } catch (error) {
            console.error('Error verifying document on blockchain:', error);
            return false;
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
