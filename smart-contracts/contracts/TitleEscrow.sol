// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

contract TitleEscrow is Ownable{
    IERC721 public tokenRegistry;
    address public beneficiary;
    address public holder;
    uint256 public tokenId;
    bool public isSurrendered;

    event BeneficiaryTransferred(address indexed oldBeneficiary, address indexed newBeneficiary);
    event HolderTransferred(address indexed oldHolder, address indexed newHolder);
    event TitleSurrendered();
    event TitleClaimed(address indexed claimer);

    constructor(address _tokenRegistry, address _beneficiary, address _holder, uint256 _tokenId){
        tokenRegistry = IERC721(_tokenRegistry);
        beneficiary = _beneficiary;
        holder = _holder;
        tokenId = _tokenId;
        isSurrendered = false;


        transferOwnership(_beneficiary);
    }

    modifier onlyBeneficiary(){
        require(msg.sender == beneficiary, "Caller is not the beneficiary");
        _;
    }

    modifier onlyHolder() {
        require(msg.sender == holder, "Caller is not the holder");
        _;
    }

    function transferBeneficiary(address newBeneficiary) public onlyBeneficiary{

        require(newBeneficiary != address(0),  "New beneficiary cannot be zero address");

        emit BeneficiaryTransferred(beneficiary, newBeneficiary);
        
        beneficiary = newBeneficiary;

        transferOwnership(newBeneficiary);
    }

    function transferHolder(address newHolder) public onlyHolder{

        require(newHolder != address(0),  "New holder cannot be zero address");
        emit HolderTransferred(holder, newHolder);

        holder = newHolder;


    }

    function transferOwnership(address newBeneficiary, address newHolder) public {
        require(msg.sender == beneficiary && msg.sender == holder, "Only when beneficiary and holder are the same");
        transferBeneficiary(newBeneficiary);
        transferHolder(newHolder);
    }


    function endorseTransfer(address newBeneficiary, address newHolder) public{
        require(msg.sender == beneficiary && msg.sender == holder, "Only when beneficiary and holder are the same");
        require(!isSurrendered, "Document has been surrendered");

        emit BeneficiaryTransferred(beneficiary, newBeneficiary);
        emit HolderTransferred(holder, newHolder);

        beneficiary = newBeneficiary;
        holder = newHolder;

        transferOwnership(newBeneficiary);

    }

    function surrender() public onlyBeneficiary onlyHolder {
        require(!isSurrendered, "Title already surrendered");
        isSurrendered = true;
        
        tokenRegistry.transferFrom(address(this), tokenRegistry.ownerOf(tokenId), tokenId);
        
        emit TitleSurrendered();
    }


    function claim(address newBeneficiary, address newHolder) public{
        require(!isSurrendered, "title isn't surrendered yet");
        
        beneficiary = newBeneficiary;
        holder = newHolder;
        isSurrendered = false;

        emit TitleClaimed(msg.sender);

    }




}