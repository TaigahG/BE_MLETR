// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./TokenRegistry.sol";
import "./TitleEscrowFactory.sol";


contract DocumentTransferManager is AccessControl {
    bytes32 public constant DOCUMENT_CREATOR_ROLE = keccak256("DOCUMENT_CREATOR_ROLE");
    bytes32 public constant DOCUMENT_VERIFIER_ROLE = keccak256("DOCUMENT_VERIFIER_ROLE");
    bytes32 public constant DOCUMENT_MANAGER_ROLE = keccak256("DOCUMENT_MANAGER_ROLE");
    
    TokenRegistry public tokenRegistry;
    TitleEscrowFactory public escrowFactory;
    
    mapping(string => address) private _escrowByDocumentHash;
    
    event DocumentCreated(uint256 indexed tokenId, string documentHash, address escrow);
    event DocumentTransferred(uint256 indexed tokenId, string documentHash, address from, address to);
    
    constructor(address _tokenRegistry, address _escrowFactory) {
        tokenRegistry = TokenRegistry(_tokenRegistry);
        escrowFactory = TitleEscrowFactory(_escrowFactory);
        
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(DOCUMENT_CREATOR_ROLE, msg.sender);
        _setupRole(DOCUMENT_VERIFIER_ROLE, msg.sender);
        _setupRole(DOCUMENT_MANAGER_ROLE, msg.sender);
    }
    

    function createTransferableDocument(string memory documentHash, address beneficiary, address holder) public onlyRole(DOCUMENT_CREATOR_ROLE) returns (uint256) {
        uint256 tokenId = tokenRegistry.mint(address(this), documentHash);
        
        address escrow = escrowFactory.createTitleEscrow(
            address(tokenRegistry),
            beneficiary,
            holder,
            tokenId
        );
        
        _escrowByDocumentHash[documentHash] = escrow;
        tokenRegistry.safeTransferFrom(address(this), escrow, tokenId);
        

        emit DocumentCreated(tokenId, documentHash, escrow);
        
        return tokenId;
    }

    function getEscrowByDocumentHash(string memory documentHash) public view returns (address) {
        return _escrowByDocumentHash[documentHash];
    }
    

    function getDocumentOwnership(string memory documentHash) public view returns (address beneficiary, address holder) {
        address escrow = _escrowByDocumentHash[documentHash];
        require(escrow != address(0), "Document not found");
        


        TitleEscrow titleEscrow = TitleEscrow(escrow);
        return (titleEscrow.beneficiary(), titleEscrow.holder());
    }
    
    function isValidDocument(string memory documentHash) public view returns (bool) {
        uint256 tokenId = tokenRegistry.getTokenIdByDocHash(documentHash);
        if (tokenId == 0) return false;
        
        return tokenRegistry.isValidDocument(tokenId);
    }
}