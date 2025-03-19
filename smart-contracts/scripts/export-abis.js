const fs = require('fs');
const path = require('path');

function exportABIs() {
  const contractNames = ['DocumentRegistry', 'DocumentManagement'];
  
  // Create directories if they don't exist
  const backendContractDir = path.join(__dirname, '..', 'backend', 'src', 'contracts');
  const frontendContractDir = path.join(__dirname, '..', 'frontend', 'src', 'contracts');

  // Ensure directories exist
  [backendContractDir, frontendContractDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Export ABIs
  contractNames.forEach(contractName => {
    const artifactPath = path.join(
      __dirname, 
      '..', 
      'smart-contracts', 
      `artifacts/contracts/${contractName}.sol/${contractName}.json`
    );

    try {
      const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
      
      // Export to backend
      const backendABIPath = path.join(backendContractDir, `${contractName}.json`);
      fs.writeFileSync(backendABIPath, JSON.stringify(artifact.abi, null, 2));

      // Export to frontend
      const frontendABIPath = path.join(frontendContractDir, `${contractName}.json`);
      fs.writeFileSync(frontendABIPath, JSON.stringify(artifact.abi, null, 2));

      console.log(`Exported ABI for ${contractName}`);
    } catch (error) {
      console.error(`Error exporting ABI for ${contractName}:`, error);
    }
  });
}

exportABIs();
