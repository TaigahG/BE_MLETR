// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";


contract TokenRegistry is ERC721, AccessControl {
    using Counters for Counters.Counter;
    
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    
    Counters.Counter private _tokenIdCounter;
    
    struct DocumentData {
        string documentHash;
        address issuer;
        uint256 issuedAt;
        bool revoked;
    }

    mapping (uint256 => DocumentData) private _documents;
    mapping (string => uint256) private _tokenByDocumentHash;

    event documentMinted(uint256 indexed tokenId, string documentHash, address issuer);
    event documentRevoked(uint256 indexed tokenId, string documentHash);

    constructor(string memory name, string memory symbol) ERC721(name,symbol){
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _setupRole(MINTER_ROLE, msg.sender);
    }

    function mint(address to, string memory documentHash) public onlyRole(MINTER_ROLE) returns(uint256){
        require(_tokenByDocumentHash[documentHash] == 0, "Document already minted");

        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();

        _safeMint(to, tokenId);

        _documents[tokenId] = DocumentData({
            documentHash: documentHash,
            issuer: to,
            issuedAt: block.timestamp,
            revoked: false
        });
        
        _tokenByDocumentHash[documentHash] = tokenId;

        emit documentMinted(tokenId, documentHash, msg.sender);

        return tokenId;
    }

    function revoke(uint256 tokenId) public{
        require(_exists(tokenId), "Token doesn't exist");
        require(hasRole(MINTER_ROLE, msg.sender) || msg.sender == _documents[tokenId].issuer, "Not Authorized");
        require(!_documents[tokenId].revoked, "Document has already revoked");

        _documents[tokenId].revoked = true;

        emit documentRevoked(tokenId, _documents[tokenId].documentHash);
    }

    function getTokenIdByDocHash(string memory documentHash) public view returns(uint256){
        return _tokenByDocumentHash[documentHash];
    }

    function getDocumentData(uint256 tokenId) public view returns (DocumentData memory){
        require(_exists(tokenId), "Token doesn't exist");
        return _documents[tokenId];
    }

    function isValidDocument(uint256 tokenId) public view returns (bool){
        return _exists(tokenId) && !_documents[tokenId].revoked;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
    
    function _exists(uint256 tokenId) internal view override returns (bool) {
        return _documents[tokenId].issuedAt > 0;
    }


}