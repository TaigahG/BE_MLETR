// scripts/deploy.js
const hre = require("hardhat");

async function main() {
  // Deploy Access Control
  const AccessControl = await hre.ethers.getContractFactory("DocumentAccessControl");
  const accessControl = await AccessControl.deploy();
  await accessControl.deployed();
  console.log("AccessControl deployed to:", accessControl.address);

  // Deploy Document Registry
  const DocumentRegistry = await hre.ethers.getContractFactory("DocumentRegistry");
  const documentRegistry = await DocumentRegistry.deploy();
  await documentRegistry.deployed();
  console.log("DocumentRegistry deployed to:", documentRegistry.address);

  // Deploy Document Management
  const DocumentManagement = await hre.ethers.getContractFactory("DocumentManagement");
  const documentManagement = await DocumentManagement.deploy();
  await documentManagement.deployed();
  console.log("DocumentManagement deployed to:", documentManagement.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
