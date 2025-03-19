// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract DocumentRegistry is AccessControl {
    // Document Categories
    enum DocumentCategory {
        Transferable,
        Verifiable
    }

    // Document Statuses
    enum DocumentStatus {
        Draft,
        Active,
        Verified,
        Transferred,
        Revoked
    }

    // Document Metadata Structure
    struct DocumentMetadata {
        uint256 id;
        DocumentCategory category;
        DocumentStatus status;
        address creator;
        address currentHolder;
        bytes32 documentHash;
        uint256 createdAt;
        uint256 expiryDate;
    }

    // Roles
    bytes32 public constant DOCUMENT_CREATOR_ROLE = keccak256("DOCUMENT_CREATOR_ROLE");
    bytes32 public constant DOCUMENT_VERIFIER_ROLE = keccak256("DOCUMENT_VERIFIER_ROLE");
    bytes32 public constant DOCUMENT_TRANSFERRER_ROLE = keccak256("DOCUMENT_TRANSFERRER_ROLE");

    // Mappings
    mapping(uint256 => DocumentMetadata) internal _documents;
    mapping(uint256 => address[]) internal _documentEndorsementChain;

    // Constructor
    constructor() {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(DOCUMENT_CREATOR_ROLE, msg.sender);
        _setupRole(DOCUMENT_VERIFIER_ROLE, msg.sender);
        _setupRole(DOCUMENT_TRANSFERRER_ROLE, msg.sender);
    }

    // Internal function to get document
    function _getDocument(uint256 documentId) internal view returns (DocumentMetadata storage) {
        require(_documents[documentId].id != 0, "Document does not exist");
        return _documents[documentId];
    }

    // Implement supportsInterface
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        virtual 
        override(AccessControl) 
        returns (bool) 
    {
        return AccessControl.supportsInterface(interfaceId);
    }
}
