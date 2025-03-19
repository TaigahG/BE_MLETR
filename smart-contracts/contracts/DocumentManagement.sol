// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./DocumentRegistry.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract DocumentManagement is DocumentRegistry, ReentrancyGuard {
    // Events
    event DocumentCreated(
        uint256 indexed documentId, 
        address indexed creator, 
        DocumentCategory category
    );

    event DocumentTransferred(
        uint256 indexed documentId, 
        address indexed from, 
        address indexed to
    );

    event DocumentVerified(
        uint256 indexed documentId, 
        address verifier
    );

    // Document Creation Function
    function createDocument(
        DocumentCategory _category,
        bytes32 _documentHash,
        uint256 _expiryDate
    ) external onlyRole(DOCUMENT_CREATOR_ROLE) nonReentrant returns (uint256) {
        // Generate unique document ID
        uint256 documentId = uint256(keccak256(
            abi.encodePacked(block.timestamp, msg.sender, _documentHash)
        ));

        // Create document metadata
        _documents[documentId] = DocumentMetadata({
            id: documentId,
            category: _category,
            status: DocumentStatus.Draft,
            creator: msg.sender,
            currentHolder: msg.sender,
            documentHash: _documentHash,
            createdAt: block.timestamp,
            expiryDate: _expiryDate
        });

        // Emit document creation event
        emit DocumentCreated(documentId, msg.sender, _category);

        return documentId;
    }

    // Document Transfer Function
    function transferDocument(
        uint256 _documentId, 
        address _newHolder
    ) external onlyRole(DOCUMENT_TRANSFERRER_ROLE) nonReentrant {
        // Retrieve document
        DocumentMetadata storage doc = _getDocument(_documentId);

        // Validate transferability
        require(
            doc.category == DocumentCategory.Transferable, 
            "Document not transferable"
        );

        require(
            doc.status == DocumentStatus.Active || 
            doc.status == DocumentStatus.Verified, 
            "Invalid document status"
        );

        // Update document details
        address previousHolder = doc.currentHolder;
        doc.currentHolder = _newHolder;
        doc.status = DocumentStatus.Transferred;

        // Update endorsement chain
        _documentEndorsementChain[_documentId].push(_newHolder);

        // Emit transfer event
        emit DocumentTransferred(_documentId, previousHolder, _newHolder);
    }

    // Document Verification Function
    function verifyDocument(
        uint256 _documentId
    ) external onlyRole(DOCUMENT_VERIFIER_ROLE) nonReentrant {
        // Retrieve document
        DocumentMetadata storage doc = _getDocument(_documentId);

        // Update document status
        doc.status = DocumentStatus.Verified;

        // Emit verification event
        emit DocumentVerified(_documentId, msg.sender);
    }

    // Implement supportsInterface
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        virtual 
        override(DocumentRegistry) 
        returns (bool) 
    {
        return DocumentRegistry.supportsInterface(interfaceId);
    }
}
