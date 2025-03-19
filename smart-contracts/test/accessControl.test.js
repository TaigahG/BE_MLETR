const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DocumentAccessControl", function () {
    let accessControl;
    let owner, creator, verifier, manager, transferrer, user;

    beforeEach(async function () {
        // Get signers
        [owner, creator, verifier, manager, transferrer, user] = await ethers.getSigners();

        // Deploy AccessControl Contract
        const AccessControlFactory = await ethers.getContractFactory("DocumentAccessControl");
        accessControl = await AccessControlFactory.deploy();
        await accessControl.deployed();
    });

    describe("Initial Setup", function () {
        it("Should set deployer as default admin", async function () {
            const DEFAULT_ADMIN_ROLE = await accessControl.DEFAULT_ADMIN_ROLE();
            expect(await accessControl.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
        });

        it("Should have predefined roles", async function () {
            const DOCUMENT_CREATOR_ROLE = await accessControl.DOCUMENT_CREATOR_ROLE();
            const DOCUMENT_VERIFIER_ROLE = await accessControl.DOCUMENT_VERIFIER_ROLE();
            const DOCUMENT_MANAGER_ROLE = await accessControl.DOCUMENT_MANAGER_ROLE();
            const DOCUMENT_TRANSFERRER_ROLE = await accessControl.DOCUMENT_TRANSFERRER_ROLE();

            expect(DOCUMENT_CREATOR_ROLE).to.not.be.null;
            expect(DOCUMENT_VERIFIER_ROLE).to.not.be.null;
            expect(DOCUMENT_MANAGER_ROLE).to.not.be.null;
            expect(DOCUMENT_TRANSFERRER_ROLE).to.not.be.null;
        });
    });

    describe("Role Management", function () {
        it("Should allow admin to grant creator role", async function () {
            const DOCUMENT_CREATOR_ROLE = await accessControl.DOCUMENT_CREATOR_ROLE();
            
            await accessControl.grantCreatorRole(creator.address);
            
            expect(await accessControl.hasRole(DOCUMENT_CREATOR_ROLE, creator.address)).to.be.true;
        });

        it("Should allow admin to grant verifier role", async function () {
            const DOCUMENT_VERIFIER_ROLE = await accessControl.DOCUMENT_VERIFIER_ROLE();
            
            await accessControl.grantVerifierRole(verifier.address);
            
            expect(await accessControl.hasRole(DOCUMENT_VERIFIER_ROLE, verifier.address)).to.be.true;
        });

        it("Should prevent non-admin from granting roles", async function () {
            const accessControlAsUser = accessControl.connect(user);
            
            await expect(
                accessControlAsUser.grantCreatorRole(creator.address)
            ).to.be.revertedWith(/AccessControl: account .* is missing role/);
        });

        it("Should allow multiple role assignments", async function () {
            const DOCUMENT_CREATOR_ROLE = await accessControl.DOCUMENT_CREATOR_ROLE();
            const DOCUMENT_VERIFIER_ROLE = await accessControl.DOCUMENT_VERIFIER_ROLE();
            
            await accessControl.grantCreatorRole(creator.address);
            await accessControl.grantVerifierRole(creator.address);
            
            expect(await accessControl.hasRole(DOCUMENT_CREATOR_ROLE, creator.address)).to.be.true;
            expect(await accessControl.hasRole(DOCUMENT_VERIFIER_ROLE, creator.address)).to.be.true;
        });
    });

    describe("Role Validation", function () {
        it("Should validate role assignments", async function () {
            const DEFAULT_ADMIN_ROLE = await accessControl.DEFAULT_ADMIN_ROLE();
            const DOCUMENT_CREATOR_ROLE = await accessControl.DOCUMENT_CREATOR_ROLE();
            
            await accessControl.grantCreatorRole(creator.address);
            
            // Check role assignments
            expect(await accessControl.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
            expect(await accessControl.hasRole(DOCUMENT_CREATOR_ROLE, creator.address)).to.be.true;
            expect(await accessControl.hasRole(DOCUMENT_CREATOR_ROLE, owner.address)).to.be.true;
        });
    });
});
