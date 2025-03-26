const { Web3 } = require('web3');
const DocumentRegistryABI = require('../contracts/DocumentRegistry.json');
const DocumentManagementABI = require('../contracts/DocumentManagement.json');
const { events } = require('../models/User');

class BlockchainService {
    constructor() {
        this.web3 = new Web3(process.env.BLOCKCHAIN_PROVIDER);

        // if (process.env.BLOCKCHAIN_PRIVATE_KEY) {
        //     try {
        //         this.account = this.web3.eth.accounts.privateKeyToAccount(
        //             process.env.BLOCKCHAIN_PRIVATE_KEY.startsWith('0x') 
        //                 ? process.env.BLOCKCHAIN_PRIVATE_KEY 
        //                 : '0x' + process.env.BLOCKCHAIN_PRIVATE_KEY
        //         );
                
        //         this.web3.eth.accounts.wallet.add(this.account);
        //         console.log('Blockchain account initialized:', this.account.address);
        //     } catch (error) {
        //         console.error('Failed to initialize blockchain account:', error);
        //     }
        // } else {
        //     console.warn('No BLOCKCHAIN_PRIVATE_KEY provided');
        // }


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

        if(this.account){
            return this.account.address;
        }

        const accounts = await this.web3.eth.getAccounts();

        if(!accounts || accounts.length === 0) {
            throw new Error('No accounts found');
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
    

}

module.exports = new BlockchainService();
