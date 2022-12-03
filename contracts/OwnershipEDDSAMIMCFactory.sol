// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {CREATE3} from "solmate/src/utils/CREATE3.sol";
import {ZkOwnershipEDDSAMIMC} from "./eddsaMimc/ZkOwnershipEDDSAMIMC.sol";

/// @notice Factory for deploying ZkOwnershipEDDSAMIMC contracts to deterministic addresses via CREATE3
contract OwnershipEDDSAMIMCFactory {
    event NewOwnership(address);

    function deploy(
        bytes32 salt_,
        address verifier_,
        uint256 pubkeyX_,
        uint256 pubkeyY_
    ) external payable returns (address deployed) {
        // hash salt with the deployer address to give each deployer its own namespace
        bytes32 salt = keccak256(abi.encodePacked(msg.sender, salt_));

        bytes memory creationCode = abi.encodePacked(
            type(ZkOwnershipEDDSAMIMC).creationCode,
            abi.encode(verifier_, pubkeyX_, pubkeyY_)
        );
        address ownership = CREATE3.deploy(salt, creationCode, msg.value);
        emit NewOwnership(ownership);
        return ownership;
        // return CREATE3.deploy(salt, creationCode, msg.value);
    }

    function getDeployed(address deployer, bytes32 salt) external view returns (address deployed) {
        // hash salt with the deployer address to give each deployer its own namespace
        salt = keccak256(abi.encodePacked(deployer, salt));
        return CREATE3.getDeployed(salt);
    }
}
