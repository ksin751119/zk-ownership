// SPDX-License-Identifier: MIT
pragma solidity 0.8.10;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {IVerifier} from "./IVerifier.sol";
import "hardhat/console.sol";

/// @title The fund action task executor
contract ZkOwnership {
    using Address for address;

    uint256 public nonce;
    uint256 private pubkeyHash;

    IVerifier public verifier;

    struct ProofsRelated {
        uint256[2] a;
        uint256[2][2] b;
        uint256[2] c;
        bool isValid;
    }

    constructor(IVerifier verifier_, uint256 pubkeyHash_) {
        verifier = verifier_;
        pubkeyHash = pubkeyHash_;
    }

    // / @notice Task execution function, will charge execution fee first.
    // / @param tokensIn_ The list of tokens used in execution.
    // / @param amountsIn_ The amount of tokens used in execution.
    // / @param tos_ The address of action.
    // / @param configs_ The configurations of executing actions.
    // / @param datas_ The action datas.
    // / @return The address of dealing asset list.
    // / inheritdoc ITaskExecutor, DelegateCallAction, AssetQuotaAction, DealingAssetAction.
    function execWithProof(
        uint256[8] memory proof_,
        address to_,
        bytes calldata execData_
    ) external payable {
        console.log("pubkeyHash", pubkeyHash);
        console.log("to_", to_);
        console.logBytes(execData_);
        console.log("nonce", nonce);

        bytes32 msgHash = keccak256(abi.encodePacked(nonce, to_, execData_));

        console.log("msgHash:");
        console.logBytes32(msgHash);

        uint256[5] memory input;
        bytes16 halfL = bytes16(msgHash);
        bytes16 halfR = bytes16(uint128(uint256(msgHash)));
        input[0] = pubkeyHash;
        input[1] = uint256(uint64(bytes8(uint64(uint128(halfR)))));
        input[2] = uint256(uint64(bytes8(halfR)));
        input[3] = uint256(uint64(bytes8(uint64(uint128(halfL)))));
        input[4] = uint256(uint64(bytes8(halfL)));

        console.log("input[0] ", input[0]);
        console.log("input[1] ", input[1]);
        console.log("input[2] ", input[2]);
        console.log("input[3] ", input[3]);
        console.log("input[4] ", input[4]);

        require(
            verifier.verifyProof(
                [proof_[0], proof_[1]],
                [[proof_[2], proof_[3]], [proof_[4], proof_[5]]],
                [proof_[6], proof_[7]],
                input
            ),
            "Verify proof fail."
        );

        // Execute action by call
        to_.functionCallWithValue(execData_, msg.value, "execWithProof: low-level call with value failed");
    }

    function _unpackProof(uint256[8] memory proof_)
        internal
        pure
        returns (
            uint256[2] memory,
            uint256[2][2] memory,
            uint256[2] memory
        )
    {
        return ([proof_[0], proof_[1]], [[proof_[2], proof_[3]], [proof_[4], proof_[5]]], [proof_[6], proof_[7]]);
    }
}
