#!/bin/bash
ABI_DIR="./src/constants/abis"
mkdir -p $ABI_DIR
echo "🚀 Extracting ABIs for RST Protocol..."
forge inspect ReputationToken abi > "$ABI_DIR/ReputationToken.json"
forge inspect ReputationEngine abi > "$ABI_DIR/ReputationEngine.json"
forge inspect ReputationVault abi > "$ABI_DIR/ReputationVault.json"
echo "✅ ABIs exported to $ABI_DIR"
