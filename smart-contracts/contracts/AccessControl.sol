// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract DocumentAccessControl is AccessControl {
    // Roles for different levels of access
    bytes32 public constant DOCUMENT_CREATOR_ROLE = keccak256("DOCUMENT_CREATOR_ROLE");
    bytes32 public constant DOCUMENT_VERIFIER_ROLE = keccak256("DOCUMENT_VERIFIER_ROLE");
    bytes32 public constant DOCUMENT_MANAGER_ROLE = keccak256("DOCUMENT_MANAGER_ROLE");
    bytes32 public constant DOCUMENT_TRANSFERRER_ROLE = keccak256("DOCUMENT_TRANSFERRER_ROLE");

    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(DOCUMENT_CREATOR_ROLE, msg.sender);
        _setupRole(DOCUMENT_VERIFIER_ROLE, msg.sender);
        _setupRole(DOCUMENT_MANAGER_ROLE, msg.sender);
        _setupRole(DOCUMENT_TRANSFERRER_ROLE, msg.sender);
    }

    // Role management functions
    function grantCreatorRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(DOCUMENT_CREATOR_ROLE, account);
    }

    function grantVerifierRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(DOCUMENT_VERIFIER_ROLE, account);
    }

    function grantManagerRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(DOCUMENT_MANAGER_ROLE, account);
    }

    function grantTransferrerRole(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        grantRole(DOCUMENT_TRANSFERRER_ROLE, account);
    }
}
