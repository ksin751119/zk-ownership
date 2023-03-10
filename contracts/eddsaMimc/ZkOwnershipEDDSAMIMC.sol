// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IEDDSAMIMCVerifier} from "./IEDDSAMIMCVerifier.sol";

/// @title The fund action task executor
contract ZkOwnershipEDDSAMIMC {
    using Address for address;

    uint256 public nonce;
    uint256 public pubkeyX;
    uint256 public pubkeyY;
    IEDDSAMIMCVerifier public immutable verifier;

    struct ProofsRelated {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
    }

    constructor(
        IEDDSAMIMCVerifier verifier_,
        uint256 pubkeyX_,
        uint256 pubkeyY_
    ) {
        verifier = verifier_;
        pubkeyX = pubkeyX_;
        pubkeyY = pubkeyY_;
    }

    // / @notice Task execution function, will charge execution fee first.
    // / @param proof_ The zk proof of ownership hash.
    // / @param to_ The address of external contract.
    // / @param execData_ The execution data of contract.
    function execWithProof(
        uint256[8] memory proof_,
        address to_,
        bytes calldata execData_,
        uint256 value_
    ) external payable {
        ProofsRelated memory proof = _unpackProof(proof_);

        // Get public input
        uint256[6] memory input = _getPublicInput(to_, execData_, value_);

        // Verify proof
        require(verifier.verifyProof(proof.a, proof.b, proof.c, input), "Verify proof fail.");

        // Execute action by call
        to_.functionCallWithValue(execData_, value_, "execWithProof: low-level call with value failed");

        nonce++;
    }

    // @notice set pubkey of EDDSA. Update only by address(this)
    // @param pubkeyX_ New zk proof of pubkeyX.
    // @param pubkeyY_ New zk proof of pubkeyY.
    function setPubkey(uint256 newPubkeyX_, uint256 newPubkeyY_) external payable {
        require(msg.sender == address(this), "Not permitted");
        pubkeyX = newPubkeyX_;
        pubkeyY = newPubkeyY_;
    }

    receive() external payable {}

    // ----------------
    // --- Internal ---
    // ----------------

    function _unpackProof(uint256[8] memory proof_) internal pure returns (ProofsRelated memory) {
        return
            ProofsRelated({
                a: [proof_[0], proof_[1]],
                b: [[proof_[2], proof_[3]], [proof_[4], proof_[5]]],
                c: [proof_[6], proof_[7]]
            });
    }

    function _getPublicInput(
        address to_,
        bytes calldata execData_,
        uint256 value_
    ) internal view returns (uint256[6] memory) {
        bytes32 msgHash = keccak256(abi.encodePacked(nonce, to_, execData_, value_));
        bytes16 halfL = bytes16(msgHash);
        bytes16 halfR = bytes16(uint128(uint256(msgHash)));

        uint256[6] memory input;
        input[0] = pubkeyX;
        input[1] = pubkeyY;
        input[2] = uint256(uint64(bytes8(uint64(uint128(halfR)))));
        input[3] = uint256(uint64(bytes8(halfR)));
        input[4] = uint256(uint64(bytes8(uint64(uint128(halfL)))));
        input[5] = uint256(uint64(bytes8(halfL)));
        return input;
    }
}
