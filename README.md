# ZK Ownership

> This is highly experimental contracts not recommended for production.

## Project overview

The user address is typically set on contracts like NFT owner, smart wallet owner (guardian), or service owner in the majority of use cases. The address of a target is visible on the chain, making it simple to attack.

A single private key can be used to administer several contracts with ZK-Ownership, which employs ZKP to conceal the user address of the contract.

By using a private key off-chain, users can produce the proof and interact with contracts by submitting the evidence for validation. The ZKP verification contract should be used in place of the user address on the contract. People won't understand the significance of different contracts.

---

## Install dependencies

- Run `yarn` at the top level to install npm dependencies (`snarkjs` and `circomlib`).
- Also need `circom` version `>= 2.0.2` and `< 2.0.9` on your system. Installation instructions [here](https://docs.circom.io/getting-started/installation/).
  - [Circom-ecdsa](https://github.com/0xPARC/circom-ecdsa) is the library used by ZK-OWNERSHIP to validate ECDSA signatures. But circom-ecdsa does not support versions higher than 2.0.9
- Need to download a Powers of Tau file with `2^21` constraints and copy it into the `circuits` subdirectory of the project, with the name `pot21_final.ptau`. You can download and copy Powers of Tau files from the Hermez trusted setup from [this repository](https://github.com/iden3/snarkjs#7-prepare-phase-2).

---

## Building keys and witness generation files
