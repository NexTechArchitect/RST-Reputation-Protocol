// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";

/// @title  HelperConfig
/// @notice Network-aware config — auto-switches between Anvil, Sepolia, Base.
contract HelperConfig is Script {

    /*//////////////////////////////////////////////////////////////
                            STRUCTS
    //////////////////////////////////////////////////////////////*/

    struct NetworkConfig {
        address deployer;
        uint256 deployerKey;
        string  rpcUrl;
        string  networkName;
    }

    /*//////////////////////////////////////////////////////////////
                            CHAIN IDS
    //////////////////////////////////////////////////////////////*/

    uint256 public constant ANVIL_CHAIN_ID   = 31337;
    uint256 public constant SEPOLIA_CHAIN_ID = 11155111;
    uint256 public constant BASE_CHAIN_ID    = 8453;

    /// @dev Default Anvil account #0 — never use on mainnet.
    uint256 public constant ANVIL_DEFAULT_KEY =
        0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
    address public constant ANVIL_DEFAULT_DEPLOYER =
        0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

    /*//////////////////////////////////////////////////////////////
                            STATE
    //////////////////////////////////////////////////////////////*/

    NetworkConfig public activeConfig;

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor() {
        if (block.chainid == SEPOLIA_CHAIN_ID) {
            activeConfig = _getSepoliaConfig();
        } else if (block.chainid == BASE_CHAIN_ID) {
            activeConfig = _getBaseConfig();
        } else {
            activeConfig = _getAnvilConfig();
        }
    }

    /*//////////////////////////////////////////////////////////////
                            CONFIGS
    //////////////////////////////////////////////////////////////*/

    function _getAnvilConfig() private pure returns (NetworkConfig memory) {
        return NetworkConfig({
            deployer:    ANVIL_DEFAULT_DEPLOYER,
            deployerKey: ANVIL_DEFAULT_KEY,
            rpcUrl:      "http://127.0.0.1:8545",
            networkName: "Anvil"
        });
    }

    function _getSepoliaConfig() private view returns (NetworkConfig memory) {
        return NetworkConfig({
            deployer:    vm.envAddress("DEPLOYER_ADDRESS"),
            deployerKey: vm.envUint("PRIVATE_KEY"),
            rpcUrl:      vm.envString("SEPOLIA_RPC_URL"),
            networkName: "Sepolia"
        });
    }

    function _getBaseConfig() private view returns (NetworkConfig memory) {
        return NetworkConfig({
            deployer:    vm.envAddress("DEPLOYER_ADDRESS"),
            deployerKey: vm.envUint("PRIVATE_KEY"),
            rpcUrl:      vm.envString("BASE_RPC_URL"),
            networkName: "Base"
        });
    }
}
