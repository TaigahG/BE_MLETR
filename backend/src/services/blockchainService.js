const { Web3 } = require('web3');
const DocumentRegistryABI = require('../contracts/DocumentRegistry.json');
const DocumentManagementABI = require('../contracts/DocumentManagement.json');
const { events } = require('../models/User');

class BlockchainService {
    constructor() {
        this.web3 = new Web3(process.env.BLOCKCHAIN_PROVIDER);

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

        this.documentManagementContract = new this.web3.eth.Contract(
            DocumentManagementABI.abi, 
            process.env.DOCUMENT_MANAGEMENT_CONTRACT_ADDRESS
        );

        // this.checkRoles().catch(error => {
        //     console.error('Error during role check:', error);
        // });
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

            const sender = await this.getSenderAccounts();
            const expiryDate = BigInt(documentData.expiryDate);

            const gasEstimate = await this.documentManagementContract.methods.createDocument(
                documentData.category,
                this.web3.utils.sha3(documentData.documentHash),
                expiryDate
            ).estimateGas({ from: sender });

            const gasToUse = BigInt(Math.floor(Number(gasEstimate) * 1.2));
            const gasPriceBigInt = BigInt(this.gasPrice);

            const result = await this.documentManagementContract.methods.createDocument(
                documentData.category,
                this.web3.utils.sha3(documentData.documentHash),
                expiryDate
            ).send({
                from: sender,
                gas: gasToUse.toString(),
                gasPrice: gasPriceBigInt.toString()
            })

            const documentCreatedEvent = result.events.DocumentCreated;
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
            if (!this.web3 || !this.documentManagementContract) {
                console.error('Blockchain service not properly initialized');
                return false;
            }
    
            const formattedHash = documentHash.startsWith('0x') 
                ? documentHash 
                : '0x' + documentHash;
    
            console.log('Formatted hash for blockchain query:', formattedHash);
    
            try {
                const createdEvents = await this.documentManagementContract.getPastEvents('DocumentCreated', {
                    fromBlock: 0,
                    toBlock: 'latest'
                });
                
                console.log(`Found ${createdEvents.length} DocumentCreated events`);
                
                for (const event of createdEvents) {
                    const documentId = event.returnValues.documentId;
                    
                    try {
                        const document = await this.documentManagementContract.methods.documents(documentId).call();
                        
                        // Compare the document hash
                        if (document && 
                            (document.documentHash === formattedHash || 
                             document.documentHash === documentHash.replace('0x', ''))) {
                            console.log(`Document found with ID: ${documentId}`);
                            return true;
                        }
                    } catch (docError) {
                        console.log(`Error fetching document ${documentId}:`, docError.message);
                    }
                }
            } catch (eventsError) {
                console.error('Error searching for document events:', eventsError);
            }
    
            try {
                const verifiedEvents = await this.documentManagementContract.getPastEvents('DocumentVerified', {
                    fromBlock: 0,
                    toBlock: 'latest'
                });
                
                console.log(`Found ${verifiedEvents.length} DocumentVerified events`);
                
                for (const event of verifiedEvents) {
                    const documentId = event.returnValues.documentId;
                    
                    try {
                        const document = await this.documentManagementContract.methods.documents(documentId).call();
                        
                        if (document && 
                            (document.documentHash === formattedHash || 
                             document.documentHash === documentHash.replace('0x', ''))) {
                            console.log(`Verified document found with ID: ${documentId}`);
                            return true;
                        }
                    } catch (docError) {
                        console.log(`Error fetching verified document ${documentId}:`, docError.message);
                        // Continue to the next document
                    }
                }
            } catch (eventsError) {
                console.error('Error searching for verification events:', eventsError);
            }
    
            try {
                const document = await Document.findOne({ documentHash });
                
                if (document && document.blockchainId) {
                    console.log(`Attempting to fetch document with blockchain ID: ${document.blockchainId}`);
                    
                    try {
                        const blockchainDocument = await this.documentManagementContract.methods
                            .documents(document.blockchainId)
                            .call();
                        
                        if (blockchainDocument) {
                            console.log('Found document on blockchain via direct ID lookup');
                            return true;
                        }
                    } catch (directFetchError) {
                        console.error('Error fetching document by ID:', directFetchError);
                    }
                }
            } catch (dbError) {
                console.error('Error fetching document from database:', dbError);
            }
    
            console.log('Document not found on blockchain after all verification attempts');
            return false;
        } catch (error) {
            console.error('Error verifying document on blockchain:', error);
            return false;
        }
    }
    

}

module.exports = new BlockchainService();
