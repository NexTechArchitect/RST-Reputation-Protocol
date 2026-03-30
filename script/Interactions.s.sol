// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {HelperConfig}     from "./HelperConfig.s.sol";
import {ReputationEngine} from "../src/ReputationEngine.sol";
import {ReputationVault}  from "../src/ReputationVault.sol";
import {ReputationToken}  from "../src/ReputationToken.sol";

/// @title  Interactions
/// @notice Cast scripts for interacting with deployed contracts.
///
/// @dev    USAGE EXAMPLES
///         ───────────────
///         # Cast a vote
///         forge script script/Interactions.s.sol:CastVote \
///             --sig "run(address)" <VAULT_ADDRESS> \
///             --rpc-url $SEPOLIA_RPC_URL --broadcast
///
///         # Check score
///         forge script script/Interactions.s.sol:CheckScore \
///             --sig "run(address,address)" <ENGINE_PROXY> <WALLET> \
///             --rpc-url $SEPOLIA_RPC_URL

// ─────────────────────────────────────────────────────────────────
//  DAO ACTIONS
// ─────────────────────────────────────────────────────────────────

contract CastVote is Script {
    function run(address vault) external {
        HelperConfig config = new HelperConfig();
        (address deployer, uint256 deployerKey, ,) = config.activeConfig();
        vm.startBroadcast(deployerKey);

        ReputationVault(vault).castVote();
        console.log("Vote cast for:", deployer);
        console.log("Next vote available in 12 hours");

        vm.stopBroadcast();
    }
}

contract SubmitProposal is Script {
    function run(address vault) external {
        HelperConfig config = new HelperConfig();
        (address deployer, uint256 deployerKey, ,) = config.activeConfig();
        vm.startBroadcast(deployerKey);

        ReputationVault(vault).submitProposal();
        console.log("Proposal submitted for:", deployer);
        console.log("Next proposal available in 24 hours");

        vm.stopBroadcast();
    }
}

// ─────────────────────────────────────────────────────────────────
//  LENDING ACTIONS
// ─────────────────────────────────────────────────────────────────

contract TakeLoan is Script {
    function run(address vault, uint256 amount) external {
        HelperConfig config = new HelperConfig();
        (, uint256 deployerKey, ,) = config.activeConfig();
        vm.startBroadcast(deployerKey);

        ReputationVault(vault).takeLoan(amount);
        console.log("Loan opened. Amount:", amount);
        console.log("Repay to earn +30 score. Default = -50 score.");

        vm.stopBroadcast();
    }
}

contract RepayLoan is Script {
    function run(address vault) external {
        HelperConfig config = new HelperConfig();
        (, uint256 deployerKey, ,) = config.activeConfig();
        vm.startBroadcast(deployerKey);

        ReputationVault(vault).repayLoan();
        console.log("Loan repaid. Score +30 recorded.");

        vm.stopBroadcast();
    }
}

contract MarkDefault is Script {
    function run(address vault, address wallet) external {
        HelperConfig config = new HelperConfig();
        (, uint256 deployerKey, ,) = config.activeConfig();
        vm.startBroadcast(deployerKey);

        ReputationVault(vault).markDefault(wallet);
        console.log("Loan defaulted for wallet:", wallet);
        console.log("Score -50 recorded.");

        vm.stopBroadcast();
    }
}

// ─────────────────────────────────────────────────────────────────
//  AIRDROP ACTIONS
// ─────────────────────────────────────────────────────────────────

contract ClaimAirdrop is Script {
    function run(address vault, uint256 amount) external {
        HelperConfig config = new HelperConfig();
        (, uint256 deployerKey, ,) = config.activeConfig();
        vm.startBroadcast(deployerKey);

        ReputationVault(vault).claimAirdrop(amount);
        console.log("Airdrop claimed. Amount:", amount);
        console.log("Hold for 30 days then settleAirdrop() for +15 score.");
        console.log("Settle early = -20 score (paper hands).");

        vm.stopBroadcast();
    }
}

contract SettleAirdrop is Script {
    function run(address vault) external {
        HelperConfig config = new HelperConfig();
        (address deployer, uint256 deployerKey, ,) = config.activeConfig();
        vm.startBroadcast(deployerKey);

        bool held = ReputationVault(vault).isAirdropHeld(deployer);
        console.log("Held 30 days?", held ? "YES (+15)" : "NO (-20)");

        ReputationVault(vault).settleAirdrop();
        console.log("Airdrop settled.");

        vm.stopBroadcast();
    }
}

// ─────────────────────────────────────────────────────────────────
//  NFT ACTION
// ─────────────────────────────────────────────────────────────────

contract MintNFT is Script {
    function run(address vault) external {
        HelperConfig config = new HelperConfig();
        (, uint256 deployerKey, ,) = config.activeConfig();
        vm.startBroadcast(deployerKey);

        ReputationVault(vault).mintNFT();
        console.log("NFT minted. Score +5 recorded.");
        console.log("Next mint available in 12 hours.");

        vm.stopBroadcast();
    }
}

// ─────────────────────────────────────────────────────────────────
//  VIEW / CHECK SCRIPTS
// ─────────────────────────────────────────────────────────────────

contract CheckScore is Script {
    function run(address engineProxy, address wallet) external view {
        ReputationEngine engine = ReputationEngine(engineProxy);

        uint256 score  = engine.getScore(wallet);
        string memory tier   = engine.getTierName(wallet);
        uint256 voting = engine.getVotingMultiplier(wallet);
        uint256 loan   = engine.getLoanLimitBps(wallet);
        uint256 actions = engine.getActionCount(wallet);
        uint256 lastAt = engine.getLastActionAt(wallet);

        console.log("=== REPUTATION REPORT ===");
        console.log("Wallet  :", wallet);
        console.log("Score   :", score, "/ 1000");
        console.log("Tier    :", tier);
        console.log("Voting  :", voting, "bps (10000 = 1x)");
        console.log("Loan    :", loan,   "bps (0 = no credit)");
        console.log("Actions :", actions);
        console.log("Last act:", lastAt);
        console.log("=========================");
    }
}

contract CheckVaultState is Script {
    function run(address vault, address wallet) external view {
        ReputationVault v = ReputationVault(vault);

        uint256 loan      = v.getActiveLoan(wallet);
        uint256 airdropAt = v.getAirdropClaimTime(wallet);
        uint256 airdropAmt = v.getAirdropAmount(wallet);
        bool    held      = v.isAirdropHeld(wallet);
        uint256 nextVote  = v.getNextVoteTime(wallet);
        uint256 nextNft   = v.getNextNftMintTime(wallet);

        console.log("=== VAULT STATE ===");
        console.log("Wallet        :", wallet);
        console.log("Active loan   :", loan);
        console.log("Airdrop time  :", airdropAt);
        console.log("Airdrop amount:", airdropAmt);
        console.log("Airdrop held  :", held ? "YES" : "NO");
        console.log("Next vote at  :", nextVote == 0 ? 0 : nextVote);
        console.log("Next NFT at   :", nextNft  == 0 ? 0 : nextNft);
        console.log("===================");
    }
}

contract AuthorizeVault is Script {
    function run(address engineProxy, address vault) external {
        HelperConfig config = new HelperConfig();
        (, uint256 deployerKey, ,) = config.activeConfig();
        vm.startBroadcast(deployerKey);

        ReputationEngine(engineProxy).setAuthorizedCaller(vault, true);
        console.log("Vault authorized:", vault);

        vm.stopBroadcast();
    }
}
