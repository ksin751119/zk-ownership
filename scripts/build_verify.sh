#!/bin/bash
set -e

PHASE1=../pot/pot$2_final.ptau
BUILD_DIR=../build
CIRCUIT_NAME=$1


if [ -f "$PHASE1" ]; then
    echo "Found Phase 1 ptau file"
else
    echo "No Phase 1 ptau file found. Exiting..."
    exit 1
fi

if [ ! -d "$BUILD_DIR" ]; then
    echo "No build directory found. Creating build directory..."
    mkdir -p "$BUILD_DIR"
fi

echo "****COMPILING CIRCUIT****"
start=`date +%s`
set -x
circom ../circuits/"$CIRCUIT_NAME".circom --r1cs --wasm --sym --c --wat --output "$BUILD_DIR"
{ set +x; } 2>/dev/null
end=`date +%s`
echo "DONE ($((end-start))s)"


echo "****GENERATING ZKEY 0****"
start=`date +%s`
npx snarkjs groth16 setup "$BUILD_DIR"/"$CIRCUIT_NAME".r1cs "$PHASE1" "$BUILD_DIR"/"$CIRCUIT_NAME"_0.zkey
end=`date +%s`
echo "DONE ($((end-start))s)"

echo "****CONTRIBUTE TO THE PHASE 2 CEREMONY****"
start=`date +%s`
echo "test" | npx snarkjs zkey contribute "$BUILD_DIR"/"$CIRCUIT_NAME"_0.zkey "$BUILD_DIR"/"$CIRCUIT_NAME"_1.zkey --name="1st Contributor Name"
end=`date +%s`
echo "DONE ($((end-start))s)"

echo "****GENERATING FINAL ZKEY****"
start=`date +%s`
npx snarkjs zkey beacon "$BUILD_DIR"/"$CIRCUIT_NAME"_1.zkey "$BUILD_DIR"/"$CIRCUIT_NAME".zkey 0102030405060708090a0b0c0d0e0f101112231415161718221a1b1c1d1e1f 10 -n="Final Beacon phase2"
end=`date +%s`
echo "DONE ($((end-start))s)"

echo "****VERIFYING FINAL ZKEY****"
start=`date +%s`
npx snarkjs zkey verify "$BUILD_DIR"/"$CIRCUIT_NAME".r1cs "$PHASE1" "$BUILD_DIR"/"$CIRCUIT_NAME".zkey
end=`date +%s`
echo "DONE ($((end-start))s)"

echo "** Exporting vkey"
start=`date +%s`
npx snarkjs zkey export verificationkey "$BUILD_DIR"/"$CIRCUIT_NAME".zkey "$BUILD_DIR"/"$CIRCUIT_NAME"_vkey.json
end=`date +%s`
echo "DONE ($((end-start))s)"

# Generate verifier contract
echo "** BUILD VERIFIER CONTRACT **"
start=`date +%s`
snarkjs zkey export solidityverifier "$BUILD_DIR"/"$CIRCUIT_NAME".zkey ../contracts/$3Verifier.sol
end=`date +%s`
echo "DONE ($((end-start))s)"


# Change Solidity compiler version and contract name
echo "** MODIFT VERIFIER CONTRACT COMPLIER VERSION**"
start=`date +%s`
sed -i '' 's/0.6.11;/0.8.10;\n\n/' "../contracts/$3Verifier.sol"
sed -i '' "s/contract Verifier {/contract $3Verifier {/" "../contracts/$3Verifier.sol"
yarn prettify
end=`date +%s`
echo "DONE ($((end-start))s)"

# Copy all the required files to the public directory
echo "** COPY ALL REQUIRED FILES TO PUBLIC DIRECTORY**"
start=`date +%s`
cp "$BUILD_DIR"/"$CIRCUIT_NAME".zkey "../public"/"$CIRCUIT_NAME".zkey
cp "$BUILD_DIR"/"$CIRCUIT_NAME"_vkey.json "../public"/"$CIRCUIT_NAME"_vkey.json
cp "$BUILD_DIR/$1_js/$1.wasm" "../public/$1.wasm"
end=`date +%s`
echo "DONE ($((end-start))s)"
