import ReputationTokenFile from './abis/ReputationToken.json';
import ReputationEngineFile from './abis/ReputationEngine.json';
import ReputationVaultFile from './abis/ReputationVault.json';

export const CONTRACTS = {
    RST_TOKEN: {
        address: "0x9c77Ce31a110e360d62e4eF8B1F4cf8576F70F46" as `0x${string}`,
        abi: ReputationTokenFile.abi, 
    },
    RST_ENGINE: {
        address: "0x4eFC1adc7Dd594C4bB04865B6dCc5101392FaBD8" as `0x${string}`,
        abi: ReputationEngineFile.abi,
    },
    RST_VAULT: {
        address: "0xd53320CDEF6f3DfA54436D2806e765d6d6bD98b6" as `0x${string}`,
        abi: ReputationVaultFile.abi,
    }
} as const;

export const DEPLOYER_ADDRESS = "0x023c6911c69b6c0E70A76C27b23fe1A32b08Bf98" as `0x${string}`;