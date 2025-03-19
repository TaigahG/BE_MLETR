const {Web3} = require('web3');
const DocumentManagementABI = require('../contracts/DocumentManagement.json');

class BlockchainConfig {
    constructor() {
        this.networks = {
            'xdc_mainnet': 'https://rpc.xdcrpc.com',
            'xdc_testnet': 'https://rpc.apothem.network'
        };
    }

    getWeb3Provider(network = 'xdc_testnet') {
        return new Web3(new Web3.providers.HttpProvider(this.networks[network]));
    }

    getContractInstance(web3, contractAddress) {
        return new web3.eth.Contract(DocumentManagementABI, contractAddress);
    }
}

module.exports = new BlockchainConfig();
