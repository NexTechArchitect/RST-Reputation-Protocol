// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {ERC1967Proxy}    from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {HelperConfig}    from "./HelperConfig.s.sol";
import {ReputationToken}  from "../src/ReputationToken.sol";
import {ReputationEngine} from "../src/ReputationEngine.sol";
import {ReputationVault}  from "../src/ReputationVault.sol";

/// @title  DeployReputation
/// @notice Deploys the full Reputation System in correct dependency order.
///
/// @dev    DEPLOYMENT ORDER
///         ──────────────────
///         1. ReputationToken   (immutable ERC-5484 SBT)
///         2. ReputationEngine  (UUPS logic implementation — not used directly)
///         3. ERC1967Proxy      (the proxy that users interact with)
///         4. engine.initialize (sets owner + binds token)
///         5. token.setEngine   (one-time lock — engine address becomes immutable)
///         6. ReputationVault   (action simulator — points to proxy)
///         7. engine.setAuthorizedCaller(vault) (vault can now record actions)
///
///         IMPORTANT: After step 5, setEngine() can never be called again.
///         Verify all addresses before running on mainnet.

contract DeployReputation is Script {

    /*//////////////////////////////////////////////////////////////
                            STRUCTS
    //////////////////////////////////////////////////////////////*/

    struct DeployedContracts {
        ReputationToken  token;
        ReputationEngine engineImpl;
        address          engineProxy;
        ReputationVault  vault;
    }

    /*//////////////////////////////////////////////////////////////
                            RUN
    //////////////////////////////////////////////////////////////*/

    function run() external returns (DeployedContracts memory deployed) {
        HelperConfig config = new HelperConfig();
        (address deployer, uint256 deployerKey, , string memory networkName) = config.activeConfig();

        console.log("=== REPUTATION SYSTEM DEPLOYMENT ===");
        console.log("Network  :", networkName);
        console.log("Deployer :", deployer);
        console.log("Chain ID :", block.chainid);
        console.log("=====================================");

        vm.startBroadcast(deployerKey);

        // ── Step 1: Deploy Token (immutable) ─────────────────────
        ReputationToken token = new ReputationToken(deployer);
        console.log("[1/7] ReputationToken     :", address(token));

        // ── Step 2: Deploy Engine implementation ─────────────────
        // This is the logic contract — users should NEVER interact with it directly.
        ReputationEngine engineImpl = new ReputationEngine();
        console.log("[2/7] ReputationEngine    :", address(engineImpl));

        // ── Step 3: Deploy ERC1967 Proxy ─────────────────────────
        // Encode the initialize() call to be executed atomically on proxy deploy.
        bytes memory initData = abi.encodeWithSelector(
            ReputationEngine.initialize.selector,
            address(token),
            deployer
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(engineImpl), initData);
        address engineProxy = address(proxy);
        console.log("[3/7] Engine Proxy        :", engineProxy);
        console.log("[4/7] engine.initialize() : called atomically in proxy deploy");

        // ── Step 5: Set engine on token (ONE-TIME, irreversible) ──
        // After this call, the token's engine address is permanently locked.
        // Verify engineProxy address carefully before proceeding.
        token.setEngine(engineProxy);
        console.log("[5/7] token.setEngine()   : engine locked =", engineProxy);

        // ── Step 6: Deploy Vault ──────────────────────────────────
        ReputationVault vault = new ReputationVault(engineProxy, deployer);
        console.log("[6/7] ReputationVault     :", address(vault));

        // ── Step 7: Authorize vault in engine ────────────────────
        ReputationEngine(engineProxy).setAuthorizedCaller(address(vault), true);
        console.log("[7/7] vault authorized    : vault can now record actions");

        vm.stopBroadcast();

        deployed = DeployedContracts({
            token:       token,
            engineImpl:  engineImpl,
            engineProxy: engineProxy,
            vault:       vault
        });

        console.log("");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("Token       :", address(token));
        console.log("Engine Impl :", address(engineImpl));
        console.log("Engine Proxy:", engineProxy);
        console.log("Vault       :", address(vault));
        console.log("===========================");
    }
}
