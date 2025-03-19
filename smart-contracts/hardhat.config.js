require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("dotenv").config();

const fs = require('fs');
const path = require('path');

// Custom task to export ABIs
task("export-abis", "Exports the ABI of deployed contracts")
  .setAction(async (taskArgs, hre) => {
    const contractNames = ['DocumentRegistry', 'DocumentManagement'];
    
    // Paths for backend and frontend
    const backendContractDir = path.join(__dirname, '..', 'backend', 'src', 'contracts');
    const frontendContractDir = path.join(__dirname, '..', 'frontend', 'src', 'contracts');

    // Ensure directories exist
    [backendContractDir, frontendContractDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    // Export ABIs
    for (const contractName of contractNames) {
      try {
        // Construct artifact path
        const artifactPath = path.join(
          __dirname, 
          `artifacts/contracts/${contractName}.sol/${contractName}.json`
        );

        // Read artifact
        const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
        
        // Export to backend
        const backendABIPath = path.join(backendContractDir, `${contractName}.json`);
        fs.writeFileSync(backendABIPath, JSON.stringify({
          contractName: artifact.contractName,
          abi: artifact.abi,
          bytecode: artifact.bytecode
        }, null, 2));

        // Export to frontend
        const frontendABIPath = path.join(frontendContractDir, `${contractName}.json`);
        fs.writeFileSync(frontendABIPath, JSON.stringify({
          contractName: artifact.contractName,
          abi: artifact.abi,
          bytecode: artifact.bytecode
        }, null, 2));

        console.log(`Exported ABI for ${contractName}`);
      } catch (error) {
        console.error(`Error exporting ABI for ${contractName}:`, error);
      }
    }
  });

// Additional custom task for full deployment
task("deploy-and-export", "Deploys contracts and exports ABIs")
  .setAction(async (taskArgs, hre) => {
    // Compile contracts
    await hre.run('compile');

    // Run deployment script
    await hre.run('run', { script: 'scripts/deploy.js' });

    // Export ABIs
    await hre.run('export-abis');
  });

module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode", "evm.deployedBytecode", "metadata"]
        }
      }
    }
  },
  networks: {
    xdc: {
      url: "https://rpc.xdcrpc.com",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 50
    },
    xdcTestnet: {
      url: "https://rpc.apothem.network",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 51
    }
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
  // Hardhat plugin configurations
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
    currency: "USD"
  }
};
