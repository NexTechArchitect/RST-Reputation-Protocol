-include .env

.PHONY: all test clean deploy help install snapshot format coverage test-unit test-integration test-fuzz

DEFAULT_ANVIL_KEY := 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

help:
	@echo "-----------------------------------------------------------------"
	@echo "            🛡️ RST REPUTATION PROTOCOL MAKEFILE 🛡️             "
	@echo "-----------------------------------------------------------------"
	@echo "Usage:"
	@echo "  make build            : Compile contracts"
	@echo "  make clean            : Clean artifacts"
	@echo "  make format           : Auto-format Solidity code"
	@echo "  make snapshot         : Generate gas snapshot"
	@echo "-----------------------------------------------------------------"
	@echo "                       TESTING SUITE                             "
	@echo "-----------------------------------------------------------------"
	@echo "  make test             : Run ALL tests"
	@echo "  make test-unit        : Run only unit tests"
	@echo "  make test-integration : Run only integration tests"
	@echo "  make test-fuzz        : Run only fuzz tests (10k runs)"
	@echo "  make coverage         : Generate test coverage report"
	@echo "-----------------------------------------------------------------"
	@echo "                    DEPLOYMENT (SEPOLIA)                         "
	@echo "-----------------------------------------------------------------"
	@echo "  make deploy-sepolia   : Deploy Token, Engine, Proxy & Vault"
	@echo "  make verify-contracts : Verify contracts on Etherscan"
	@echo "-----------------------------------------------------------------"
	@echo "                   ON-CHAIN INTERACTIONS                         "
	@echo "-----------------------------------------------------------------"
	@echo "  make check-score      : View Reputation Report (Needs .env)"
	@echo "  make cast-vote        : Simulate DAO Vote (+10 Score)"
	@echo "  make take-loan        : Open a simulated loan"
	@echo "  make repay-loan       : Repay loan (+30 Score)"
	@echo "  make claim-airdrop    : Claim airdrop (Starts 30-day timer)"
	@echo "  make mint-nft         : Mint NFT (+5 Score)"
	@echo "-----------------------------------------------------------------"

# --- SETUP & TOOLS ---

all: clean install build

# Install dependencies
install:; forge install

# Update dependencies
update:; forge update

# Compile contracts
build:; forge build

# Clean artifacts
clean:; forge clean

# Generate Gas Snapshot
snapshot:; forge snapshot

# Format Code
format:; forge fmt

# --- TESTING ---

test:
	forge test -vv

test-unit:
	forge test --match-path test/unit/* -vv

test-integration:
	forge test --match-path test/integration/* -vv

test-fuzz:
	forge test --match-path test/fuzz/* --fuzz-runs 10000 -vv

coverage:
	forge coverage

# --- DEPLOYMENT ARGS (SEPOLIA) ---
# Automatically loads RPC and Key from .env
NETWORK_ARGS := --rpc-url $(SEPOLIA_RPC_URL) --private-key $(PRIVATE_KEY) --broadcast -vvvv
VERIFY_ARGS := --verify --etherscan-api-key $(ETHERSCAN_API_KEY)

# --- DEPLOYMENT ---

deploy-sepolia:
	@echo "Deploying RST Protocol to Sepolia..."
	@forge script script/DeployReputation.s.sol:DeployReputation $(NETWORK_ARGS)

deploy-verify-sepolia:
	@echo "Deploying and Verifying RST Protocol on Sepolia..."
	@forge script script/DeployReputation.s.sol:DeployReputation $(NETWORK_ARGS) $(VERIFY_ARGS)

# --- VERIFICATION HELPERS (Manual) ---

verify-token:
	forge verify-contract --chain sepolia --watch $(SEPOLIA_TOKEN) src/ReputationToken.sol:ReputationToken $(VERIFY_ARGS)

verify-engine:
	forge verify-contract --chain sepolia --watch $(SEPOLIA_ENGINE_IMPL) src/ReputationEngine.sol:ReputationEngine $(VERIFY_ARGS)

verify-vault:
	forge verify-contract --chain sepolia --watch $(SEPOLIA_VAULT) src/ReputationVault.sol:ReputationVault $(VERIFY_ARGS)

# --- POST DEPLOYMENT INTERACTIONS (Requires Addresses in .env) ---

check-score:
	@echo "Fetching Reputation Score for $(DEPLOYER_ADDRESS)..."
	@forge script script/Interactions.s.sol:CheckScore --sig "run(address,address)" $(SEPOLIA_ENGINE_PROXY) $(DEPLOYER_ADDRESS) --rpc-url $(SEPOLIA_RPC_URL) -vv

cast-vote:
	@echo "Casting Vote via Vault..."
	@forge script script/Interactions.s.sol:CastVote --sig "run(address)" $(SEPOLIA_VAULT) $(NETWORK_ARGS)

take-loan:
	@echo "Taking a loan of 100 ether..."
	@forge script script/Interactions.s.sol:TakeLoan --sig "run(address,uint256)" $(SEPOLIA_VAULT) 100000000000000000000 $(NETWORK_ARGS)

repay-loan:
	@echo "Repaying loan..."
	@forge script script/Interactions.s.sol:RepayLoan --sig "run(address)" $(SEPOLIA_VAULT) $(NETWORK_ARGS)

claim-airdrop:
	@echo "Claiming 500 ether airdrop..."
	@forge script script/Interactions.s.sol:ClaimAirdrop --sig "run(address,uint256)" $(SEPOLIA_VAULT) 500000000000000000000 $(NETWORK_ARGS)

mint-nft:
	@echo "Minting NFT..."
	@forge script script/Interactions.s.sol:MintNFT --sig "run(address)" $(SEPOLIA_VAULT) $(NETWORK_ARGS)