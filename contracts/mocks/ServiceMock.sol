// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @notice The registry database for Furucombo
contract ServiceMock is Ownable {
    uint256 public value;

    constructor(address owner_) {
        transferOwnership(owner_);
    }

    function setValue(uint256 value_) external payable onlyOwner {
        value = value_;
    }
}
