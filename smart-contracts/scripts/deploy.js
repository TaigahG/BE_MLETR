const hre = require("hardhat");

async function main() {
  // Get contract factories
  const DocumentRegistry = await hre.ethers.getContractFactory("DocumentRegistry");
  const DocumentManagement = await hre.ethers.getContractFactory("DocumentManagement");

  // Deploy DocumentRegistry
  const documentRegistry = await DocumentRegistry.deploy();
  await documentRegistry.deployed();
  console.log("DocumentRegistry deployed to:", documentRegistry.address);

  // Deploy DocumentManagement
  const documentManagement = await DocumentManagement.deploy();
  await documentManagement.deployed();
  console.log("DocumentManagement deployed to:", documentManagement.address);
}

// Hardhat recommended pattern for deployment scripts
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
