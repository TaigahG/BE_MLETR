const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DocumentManagement", function () {
    let documentManagement;
    let owner, creator, verifier, manager, transferrer, user;

    // Utility function to create a document
    async function createDocument(contract, creator) {
        const category = 0; // Transferable
        const documentType = 0; // BillOfLading
        const documentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("TestDocument"));
        const expiryDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days from now
        
        const metadataKeys = [
            ethers.utils.formatBytes32String("DocumentNumber"),
            ethers.utils.formatBytes32String("Shipper")
        ];
        const metadataValues = [
            ethers.utils.formatBytes32String("BL001"),
            ethers.utils.toUtf8Bytes("TestShipper")
        ];

        return await contract.connect(creator).registerDocument(
            category, 
            documentType, 
            documentHash, 
            expiryDate, 
            metadataKeys, 
            metadataValues
        );
    }

    beforeEach(async function () {
        // Get signers
        [owner, creator, verifier, manager, transferrer, user] = await ethers.getSigners();

        // Deploy DocumentManagement Contract
        const DocumentManagementFactory = await ethers.getContractFactory("DocumentManagement");
        documentManagement = await DocumentManagementFactory.deploy();
        await documentManagement.deployed();

        // Grant roles
        await documentManagement.grantCreatorRole(creator.address);
        await documentManagement.grantVerifierRole(verifier.address);
        await documentManagement.grantManagerRole(manager.address);
        await documentManagement.grantTransferrerRole(transferrer.address);
    });

    describe("Document Registration", function () {
        it("Should allow creator to register a document", async function () {
            const documentId = await createDocument(documentManagement, creator);
            
            const document = await documentManagement.documents(documentId);
            
            expect(document.creator).to.equal(creator.address);
            expect(document.status).to.equal(1); // Draft status
        });

        it("Should prevent non-creators from registering documents", async function () {
            const category = 0; // Transferable
            const documentType = 0; // BillOfLading
            const documentHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes("TestDocument"));
            const expiryDate = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
            
            const metadataKeys = [ethers.utils.formatBytes32String("DocumentNumber")];
            const metadataValues = [ethers.utils.formatBytes32String("BL001")];

            await expect(
                documentManagement.connect(user).registerDocument(
                    category, 
                    documentType, 
                    documentHash, 
                    expiryDate, 
                    metadataKeys, 
                    metadataValues
                )
            ).to.be.revertedWith(/AccessControl: account .* is missing role/);
        });
    });

    describe("Document Verification", function () {
        let documentId;

        beforeEach(async function () {
            documentId = await createDocument(documentManagement, creator);
        });

        it("Should allow verifier to verify a document", async function () {
            const documentHash = await documentManagement.documents(documentId);
            
            const verificationResult = await documentManagement.connect(verifier).verifyDocument(
                documentId, 
                documentHash.documentHash
            );

            const updatedDocument = await documentManagement.documents(documentId);
            
            expect(updatedDocument.status).to.equal(2); // Verified status
        });

        it("Should prevent non-verifiers from verifying documents", async function () {
            const documentHash = await documentManagement.documents(documentId);

            await expect(
                documentManagement.connect(user).verifyDocument(
                    documentId, 
                    documentHash.documentHash
                )
            ).to.be.revertedWith(/AccessControl: account .* is missing role/);
        });
    });

    describe("Document Transfer", function () {
        let documentId;

        beforeEach(async function () {
            documentId = await createDocument(documentManagement, creator);
            
            // Verify the document first
            const documentHash = await documentManagement.documents(documentId);
            await documentManagement.connect(verifier).verifyDocument(
                documentId, 
                documentHash.documentHash
            );
        });

        it("Should allow transfer of transferable documents", async function () {
            await documentManagement.connect(transferrer).transferDocument(
                documentId, 
                user.address
            );

            const updatedDocument = await documentManagement.documents(documentId);
            
            expect(updatedDocument.currentHolder).to.equal(user.address);
            expect(updatedDocument.status).to.equal(3); // Transferred status
        });

        it("Should prevent transfer of non-transferable documents", async function () {
            // Create a non-transferable document
            const nonTransferableDocId = await createDocument(documentManagement, creator);
            
            await expect(
                documentManagement.connect(transferrer).transferDocument(
                    nonTransferableDocId, 
                    user.address
                )
            ).to.be.revertedWith("Document not transferable");
        });
    });

    describe("Document Metadata", function () {
        let documentId;

        beforeEach(async function () {
            documentId = await createDocument(documentManagement, creator);
        });

        it("Should retrieve document metadata", async function () {
            const metadataKey = ethers.utils.formatBytes32String("DocumentNumber");
            const metadata = await documentManagement.getDocumentMetadata(documentId, metadataKey);
            
            expect(ethers.utils.parseBytes32String(metadata)).to.equal("BL001");
        });
    });

    describe("Document Lifecycle", function () {
        let documentId;

        beforeEach(async function () {
            documentId = await createDocument(documentManagement, creator);
        });

        it("Should check document validity", async function () {
            const isValid = await documentManagement.isDocumentValid(documentId);
            expect(isValid).to.be.true;
        });

        it("Should allow manager to revoke document", async function () {
            await documentManagement.connect(manager).revokeDocument(documentId);
            
            const updatedDocument = await documentManagement.documents(documentId);
            expect(updatedDocument.status).to.equal(4); // Revoked status
        });
    });
});
