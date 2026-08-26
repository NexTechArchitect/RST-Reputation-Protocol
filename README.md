<div align="center">

# 🛡️ ERC-5484 On-Chain Reputation System

### Soulbound Identity · Dynamic NFT Medals · UUPS Upgradeable Engine

[![License](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Stack](https://img.shields.io/badge/Stack-Solidity_%7C_Foundry-blueviolet.svg)](https://getfoundry.sh)
[![Network](https://img.shields.io/badge/Network-Sepolia_Testnet-blue.svg)](https://sepolia.etherscan.io/)
[![Standard](https://img.shields.io/badge/Standard-ERC--5484_Soulbound-orange.svg)](https://eips.ethereum.org/EIPS/eip-5484)
[![Live](https://img.shields.io/badge/Live-Vercel-brightgreen.svg)](https://rst-reputation-protocol.vercel.app/)

<p align="center">
  <br>
  <b>A fully on-chain reputation protocol built on ERC-5484 Soulbound Tokens.</b><br>
  <i>Wallet behaviour tracked on-chain. Score evolves. Medal art upgrades automatically. No IPFS dependency.</i>
  <br>
</p>

<br>

<p align="center">
  <a href="https://rst-reputation-protocol.vercel.app/">🌐 Live Demo</a> •
  <a href="https://github.com/NexTechArchitect">💻 Source Code</a> •
  <a href="https://sepolia.etherscan.io/address/0x9c77Ce31a110e360d62e4eF8B1F4cf8576F70F46">🔗 ReputationToken</a> •
  <a href="https://sepolia.etherscan.io/address/0x4eFC1adc7Dd594C4bB04865B6dCc5101392FaBD8">🔗 Engine Proxy</a> •
  <a href="https://sepolia.etherscan.io/address/0xd53320CDEF6f3DfA54436D2806e765d6d6bD98b6">🔗 ReputationVault</a>
</p>

</div>

## 🦅 Executive Summary

On-chain identity is broken. Wallets are anonymous. There is no way to distinguish a DeFi power user from a fresh wallet. This protocol fixes that.

The ERC-5484 Reputation System assigns every wallet a Soulbound Token, non-transferable, non-mintable by the holder, that reflects their on-chain behaviour score. As the wallet performs positive actions (DAO votes, loan repayments, airdrop holding), their score rises and their medal art upgrades automatically with no re-mint required.

The scoring engine is UUPS upgradeable so logic can evolve as the protocol matures. The token contract is intentionally immutable because SBT ownership records are the ground truth of on-chain identity and must be permanent.

## 📑 Table of Contents

1. [🌐 Frontend App](#-frontend-app)
2. [🏛️ Architecture](#-architecture)
3. [✅ Deployed Contracts](#-deployed-contracts)
4. [🎖️ Reputation Tiers & Medal System](#-reputation-tiers--medal-system)
5. [⚙️ Scoring Actions](#-scoring-actions)
6. [🧩 Smart Contract Breakdown](#-smart-contract-breakdown)
7. [🧪 Testing Strategy](#-testing-strategy)
8. [🚀 Local Setup](#-local-setup)

### Features

Live reputation dashboard pulls real-time score, tier, voting power, and loan access directly from contracts. Dynamic SBT medal display decodes and renders on-chain SVG from `tokenURI()` with no IPFS involved. All vault actions are wired up: `castVote`, `submitProposal`, `mintNFT`, `takeLoan`, `repayLoan`, `claimAirdrop`, `settleAirdrop`, all executable from the UI. Live cooldown bars show per-action countdown timers updating every second. A 30-day airdrop progress bar gives a visual hold tracker with early-settle warning. The animated tier showcase auto-cycles through all 5 tiers with cinematic morph transitions. Scroll-reveal sections use intersection observer based animations, and the particle canvas background carries comet trails matching the landing page.

### Key Design Decisions

| Decision | Rationale |
|---|---|
| Token is **immutable** | SBT ownership is ground truth — upgradeability would allow silent record tampering |
| Engine is **UUPS upgradeable** | Scoring logic must evolve; token state must not |
| **On-chain SVG** medals | Zero IPFS dependency — token lives as long as Ethereum |
| **Dynamic metadata** | `tokenURI()` reads live score from engine — medal upgrades on score change, no re-mint |
| **`_mint` not `_safeMint`** | SBTs have no receiver contract — `onERC721Received` is meaningless and adds reentrancy surface |
| **`_update()` override** | Exhaustively blocks all OZ transfer paths in one hook |

## ✅ Deployed Contracts

All contracts deployed and verified on Ethereum Sepolia Testnet.

| Contract | Address | Etherscan |
|---|---|---|
| **ReputationToken** | `0x9c77Ce31a110e360d62e4eF8B1F4cf8576F70F46` | [🔎 View](https://sepolia.etherscan.io/address/0x9c77Ce31a110e360d62e4eF8B1F4cf8576F70F46) |
| **ReputationEngine (Impl)** | `0xC81532619d5fB4728932A43A77Bfea04c3df5957` | [🔎 View](https://sepolia.etherscan.io/address/0xC81532619d5fB4728932A43A77Bfea04c3df5957) |
| **ReputationEngine (Proxy)** | `0x4eFC1adc7Dd594C4bB04865B6dCc5101392FaBD8` | [🔎 View](https://sepolia.etherscan.io/address/0x4eFC1adc7Dd594C4bB04865B6dCc5101392FaBD8) |
| **ReputationVault** | `0xd53320CDEF6f3DfA54436D2806e765d6d6bD98b6` | [🔎 View](https://sepolia.etherscan.io/address/0xd53320CDEF6f3DfA54436D2806e765d6d6bD98b6) |

Interact with the proxy address only, never the implementation directly.

## 🎖️ Reputation Tiers & Medal System

Every wallet's SBT displays a dynamic on-chain SVG medal that reflects their current tier. No IPFS. No centralized server. The medal art is generated entirely in Solidity and upgrades automatically as score increases.

| Tier | Score Range | Medal Design | Voting Power | Loan Limit |
|---|---|---|---|---|
| **Unranked** | 0 – 99 | Grey hexagon + `?` | 0.5× | None |
| **Bronze** 🥉 | 100 – 299 | Copper circle + 6-point star | 1× | 20% of collateral |
| **Silver** 🥈 | 300 – 599 | Silver circle + 5-point star | 1.5× | 40% of collateral |
| **Gold** 🥇 | 600 – 849 | Gold circle + crown + gems | 2× | 60% of collateral |
| **Platinum** 💎 | 850 – 1000 | Platinum ring + diamond | 3× | 80% of collateral |

## ⚙️ Scoring Actions

Actions are recorded through the ReputationVault. Each action maps to a signed score delta enforced by the `ReputationMath` library. Raw deltas are never exposed, only the `Action` enum is accessible to callers.

| Action | Function | Score Delta | Cooldown |
|---|---|---|---|
| DAO Vote | `castVote()` | **+10** | 12 hours |
| DAO Proposal | `submitProposal()` | **+25** | 24 hours |
| Loan Repaid | `repayLoan()` | **+30** | None (natural gate) |
| Loan Defaulted | `markDefault()` | **−50** | None (owner only) |
| Airdrop Held 30d | `settleAirdrop()` | **+15** | None (natural gate) |
| Airdrop Dumped | `settleAirdrop()` | **−20** | None (natural gate) |
| NFT Minted | `mintNFT()` | **+5** | 12 hours |

Score is always clamped to [0, 1000]. Underflow and overflow are impossible by design.

## 🧩 Smart Contract Breakdown

```
src/
├── ReputationToken.sol       # ERC-5484 SBT — immutable, transfer-locked
├── ReputationEngine.sol      # UUPS scoring engine — issues SBTs, tracks scores
├── ReputationVault.sol       # Action simulator — user entry point
├── interfaces/
│   ├── IReputationToken.sol  # Full error + event surface for callers
│   └── IReputationEngine.sol # CEI order + reentrancy requirements documented
└── libraries/
    ├── ReputationMath.sol    # Pure math — Action enum, score clamping, tier resolution
    └── ReputationSVG.sol     # On-chain SVG medal generator — 5 tier designs
```

### ReputationMath Library — Audit Highlights

Enum-gated deltas mean arbitrary `int256` deltas are never exposed, only `Action` enum variants can mutate scores. Overflow guards in `_applyDelta()` have early-exit checks for extreme deltas, future-proofing against new high-magnitude actions. The single guard pattern calls `_assertValidScore()` once per public entry point, while `_resolveTierUnchecked()` avoids a double-guard in `tierName()`. Being a pure library, there is zero reentrancy surface.

### Security Invariants

| Invariant | Enforced By |
|---|---|
| One SBT per wallet | `s_walletToToken[to] != 0` check in `issue()` |
| Engine address immutable post-deploy | `setEngine()` reverts with `EngineAlreadySet` on second call |
| Transfer always reverts | `_update()` override — catches all OZ paths |
| Score always in [0, 1000] | `ReputationMath.applyAction()` — clamped by design |
| All storage writes before external calls | Strict CEI in `recordAction()` and all Vault functions |
| No re-entrancy | `nonReentrant` on all state-changing engine + vault functions |
| SBT auto-issued on first action | `token.issue()` called last in CEI — after all storage writes |

## 🧪 Testing Strategy

The project uses a 4-layer testing approach with Foundry.

```
test/
├── unit/
│   ├── ReputationMathTest.t.sol    # Score math, tier resolution, delta clamping
│   ├── ReputationTokenTest.t.sol   # SBT issuance, transfer lock, burn, ERC-5484
│   ├── ReputationEngineTest.t.sol  # recordAction CEI, auth, score updates
│   └── ReputationVaultTest.t.sol   # All actions, cooldowns, loan/airdrop lifecycle
├── integration/
│   └── ReputationFlowTest.t.sol    # Full lifecycle: Unranked → Bronze → Gold
└── fuzz/
    └── FuzzReputation.t.sol        # Score bounds, loan math, SBT uniqueness
```

### Frontend

```bash
cd web3-app
npm install
npm run dev
# → http://localhost:3000
```

<div align="center">

**Engineered by [NexTech Architect](https://github.com/NexTechArchitect)**

[🌐 Live Demo](https://rst-reputation-protocol.vercel.app/) · [Connect on 𝕏](https://x.com/itZ_AmiT0)

*Smart Contract Developer · Solidity · Foundry · Web3 Engineering*

</div>
