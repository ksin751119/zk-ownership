// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {IECDSAVerifier} from "./IECDSAVerifier.sol";

/// @title The fund action task executor
contract ZkOwnershipECDSA {
    using Address for address;
    using ECDSA for bytes32;

    uint256 public nonce;
    uint256 public pubkeyHash;
    IECDSAVerifier public immutable verifier;

    struct ProofsRelated {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
    }

    constructor(IECDSAVerifier verifier_, uint256 pubkeyHash_) {
        verifier = verifier_;
        pubkeyHash = pubkeyHash_;
    }

    // / @notice Task execution function, will charge execution fee first.
    // / @param proof_ The zk proof of ownership hash.
    // / @param to_ The address of external contract.
    // / @param execData_ The execution data of contract.
    function execWithProof(
        uint256[8] memory proof_,
        address to_,
        bytes calldata execData_
    ) external payable {
        ProofsRelated memory proof = _unpackProof(proof_);

        // Get public input
        uint256[5] memory input = _getPublicInput(to_, execData_);

        // Verify proof
        require(verifier.verifyProof(proof.a, proof.b, proof.c, input), "Verify proof fail.");

        // Execute action by call
        to_.functionCallWithValue(execData_, msg.value, "execWithProof: low-level call with value failed");

        nonce++;
    }

    // @notice set pubkey hash. Update only by address(this)
    // @param pubkeyHash_ New zk proof of ownership hash.
    function setPubkeyHash(uint256 pubkeyHash_) external payable {
        require(msg.sender == address(this), "Not permitted");
        pubkeyHash = pubkeyHash_;
    }

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

    function _getPublicInput(address to_, bytes calldata execData_) internal view returns (uint256[5] memory) {
        bytes32 msgHash = keccak256(abi.encodePacked(nonce, to_, execData_)).toEthSignedMessageHash();
        uint256[5] memory input;
        bytes16 halfL = bytes16(msgHash);
        bytes16 halfR = bytes16(uint128(uint256(msgHash)));
        input[0] = pubkeyHash;
        input[1] = uint256(uint64(bytes8(uint64(uint128(halfR)))));
        input[2] = uint256(uint64(bytes8(halfR)));
        input[3] = uint256(uint64(bytes8(uint64(uint128(halfL)))));
        input[4] = uint256(uint64(bytes8(halfL)));
        return input;
    }
}
