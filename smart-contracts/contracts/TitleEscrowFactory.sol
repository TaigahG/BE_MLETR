// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./TitleEscrow.sol";


contract TitleEscrowFactory{
    event TitleEscrowCreated(address indexed escrow, address tokenRegistry, address beneficiary, address holder, uint256 tokenId);


    function createTitleEscrow(address tokenRegistry, address beneficiary, address holder, uint256 tokenId) public returns(address){

        TitleEscrow escrow = new TitleEscrow(tokenRegistry, beneficiary, holder, tokenId);

        emit TitleEscrowCreated(address(escrow), tokenRegistry, beneficiary, holder, tokenId);

        return address(escrow);

    }
}
