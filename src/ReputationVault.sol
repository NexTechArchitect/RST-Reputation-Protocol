// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable}        from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IReputationEngine} from "./interfaces/IReputationEngine.sol";
import {ReputationMath}    from "./libraries/ReputationMath.sol";

/// @title  ReputationVault
/// @author NexTechArchitect
/// @notice Action simulator — users call vault functions to earn / lose
///         reputation score. Vault records each action to the engine.
///
/// @dev    ROLE IN THE SYSTEM
///         ────────────────────
///         Token  (immutable) — holds SBT ownership records
///         Engine (upgradeable) — tracks scores, issues SBTs
///         Vault  (this) — the entry point for user actions
///
///         In production each real protocol (DAO, lending, airdrop) would
///         call engine.recordAction() directly. Vault simulates all of them
///         in one contract for demonstration and testing purposes.

contract ReputationVault is Ownable, ReentrancyGuard {

    /*//////////////////////////////////////////////////////////////
                            ERRORS
    //////////////////////////////////////////////////////////////*/

    error ReputationVault__ZeroAddress();
    error ReputationVault__ZeroAmount();
    error ReputationVault__AlreadyHasActiveLoan();
    error ReputationVault__NoActiveLoan();
    error ReputationVault__NoAirdropToClaim();
    error ReputationVault__AirdropAlreadyClaimed();
    error ReputationVault__CooldownActive(uint256 availableAt);

    /*//////////////////////////////////////////////////////////////
                            EVENTS
    //////////////////////////////////////////////////////////////*/

    event LoanOpened(address indexed wallet, uint256 amount);

    event LoanRepaid(address indexed wallet, uint256 amount);

    event LoanDefaulted(address indexed wallet, uint256 amount);

    event AirdropClaimed(address indexed wallet, uint256 amount, uint256 claimedAt);

    event CooldownReset(
        address indexed wallet,
        ReputationMath.Action action,
        uint256 nextAllowed
    );

    event AirdropSettled(address indexed wallet, bool held, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                            CONSTANTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Minimum time a wallet must hold an airdrop to earn +15.
    ///         If settled before this, wallet earns -20 (dumped).
    uint256 public constant HOLD_PERIOD = 30 days;

    /// @notice Cooldown between consecutive castVote() calls per wallet.
    uint256 public constant VOTE_COOLDOWN     = 12 hours;

    /// @notice Cooldown between consecutive submitProposal() calls per wallet.
    uint256 public constant PROPOSAL_COOLDOWN = 24 hours;

    /// @notice Cooldown between consecutive mintNFT() calls per wallet.
    uint256 public constant NFT_COOLDOWN      = 12 hours;

    /*//////////////////////////////////////////////////////////////
                            STATE
    //////////////////////////////////////////////////////////////*/

    /// @dev The scoring engine — set once in constructor, never changed.
    IReputationEngine private immutable i_engine;

    /// @dev wallet → active loan amount. 0 = no loan.
    mapping(address => uint256) private s_activeLoans;

    /// @dev wallet → airdrop claim timestamp. 0 = no active airdrop.
    mapping(address => uint256) private s_airdropClaimTime;

    /// @dev wallet → airdrop amount. Cached at claim, read at settle for event emit.
    mapping(address => uint256) private s_airdropAmount;

    /// @dev wallet → timestamp of last castVote() call.
    mapping(address => uint256) private s_lastVoteAt;

    /// @dev wallet → timestamp of last submitProposal() call.
    mapping(address => uint256) private s_lastProposalAt;

    /// @dev wallet → timestamp of last mintNFT() call.
    mapping(address => uint256) private s_lastNftMintAt;

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @param engine        Deployed ReputationEngine proxy address.
    /// @param initialOwner  Address that receives Ownable ownership.
    constructor(address engine, address initialOwner) Ownable(initialOwner) {
      if (engine == address(0)) revert ReputationVault__ZeroAddress();
        i_engine = IReputationEngine(engine);
    }

    /*//////////////////////////////////////////////////////////////
                        DAO ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Simulate casting a DAO vote — records +10 reputation.
    function castVote() external nonReentrant {
       
        uint256 lastVote = s_lastVoteAt[msg.sender];
        if (lastVote != 0 && block.timestamp < lastVote + VOTE_COOLDOWN) {
            revert ReputationVault__CooldownActive(lastVote + VOTE_COOLDOWN);
        }
        s_lastVoteAt[msg.sender] = block.timestamp;

        i_engine.recordAction(msg.sender, ReputationMath.Action.DaoVote);

        emit CooldownReset(
            msg.sender,
            ReputationMath.Action.DaoVote,
            block.timestamp + VOTE_COOLDOWN
        );
    }

    /// @notice Simulate submitting a DAO proposal — records +25 reputation.
    
    function submitProposal() external nonReentrant {
       
        uint256 lastProposal = s_lastProposalAt[msg.sender];
        if (lastProposal != 0 && block.timestamp < lastProposal + PROPOSAL_COOLDOWN) {
            revert ReputationVault__CooldownActive(lastProposal + PROPOSAL_COOLDOWN);
        }
        s_lastProposalAt[msg.sender] = block.timestamp;

        i_engine.recordAction(msg.sender, ReputationMath.Action.DaoProposal);

        emit CooldownReset(
            msg.sender,
            ReputationMath.Action.DaoProposal,
            block.timestamp + PROPOSAL_COOLDOWN
        );
    }

    /*//////////////////////////////////////////////////////////////
                        LENDING ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Open a simulated loan position.
    /// @dev    No ETH is transferred — pure reputation simulation.
    ///         Score change only happens on repay or default, not on open.
    ///         One active loan per wallet enforced — prevents double-counting.
    /// @param  amount  Notional loan size (any non-zero value). Stored for
    ///                 event visibility — not used in score calculation.
    function takeLoan(uint256 amount) external nonReentrant {
       
        if (amount == 0) revert ReputationVault__ZeroAmount();
        if (s_activeLoans[msg.sender] != 0)
            revert ReputationVault__AlreadyHasActiveLoan();

        s_activeLoans[msg.sender] = amount;
        emit LoanOpened(msg.sender, amount);
    }

    /// @notice Repay an active loan — records +30 reputation.
    
    function repayLoan() external nonReentrant {
        
        uint256 amount = s_activeLoans[msg.sender];
        if (amount == 0) revert ReputationVault__NoActiveLoan();

        delete s_activeLoans[msg.sender];

        i_engine.recordAction(msg.sender, ReputationMath.Action.LoanRepaid);

        emit LoanRepaid(msg.sender, amount);
    }

    /// @notice Mark a wallet's loan as defaulted — records -50 reputation.
    /// @param  wallet  The wallet whose loan is being defaulted.
    function markDefault(address wallet) external onlyOwner nonReentrant {
        
        if (wallet == address(0)) revert ReputationVault__ZeroAddress();
        uint256 amount = s_activeLoans[wallet];
        if (amount == 0) revert ReputationVault__NoActiveLoan();

        delete s_activeLoans[wallet];

        i_engine.recordAction(wallet, ReputationMath.Action.LoanDefaulted);

        emit LoanDefaulted(wallet, amount);
    }

    /*//////////////////////////////////////////////////////////////
                        AIRDROP ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Claim a simulated airdrop — starts the 30-day hold timer.
    /// @dev    Score is NOT recorded here. Score recorded in settleAirdrop()
    /// @param  amount  Notional airdrop size (any non-zero value).
    function claimAirdrop(uint256 amount) external nonReentrant {
       
        if (amount == 0) revert ReputationVault__ZeroAmount();
        if (s_airdropClaimTime[msg.sender] != 0)
            revert ReputationVault__AirdropAlreadyClaimed();

        s_airdropClaimTime[msg.sender] = block.timestamp;
        s_airdropAmount[msg.sender]    = amount;

        emit AirdropClaimed(msg.sender, amount, block.timestamp);
    }

    /// @notice Settle an airdrop — held 30+ days → +15, dumped early → -20.
   
    function settleAirdrop() external nonReentrant {
       
        uint256 claimedAt = s_airdropClaimTime[msg.sender];
        if (claimedAt == 0) revert ReputationVault__NoAirdropToClaim();

        uint256 amount = s_airdropAmount[msg.sender];

        bool held = (block.timestamp - claimedAt) >= HOLD_PERIOD;

        
        delete s_airdropClaimTime[msg.sender];
        delete s_airdropAmount[msg.sender];

        i_engine.recordAction(
            msg.sender,
            held ? ReputationMath.Action.AirdropHeld : ReputationMath.Action.AirdropDumped
        );

        // ── Event ────────────────────────────────────────────────
        emit AirdropSettled(msg.sender, held, amount);
    }

    /*//////////////////////////////////////////////////////////////
                        NFT ACTION
    //////////////////////////////////////////////////////////////*/

    /// @notice Simulate minting an NFT — records +5 reputation.
   
    function mintNFT() external nonReentrant {
        uint256 lastMint = s_lastNftMintAt[msg.sender];
        if (lastMint != 0 && block.timestamp < lastMint + NFT_COOLDOWN) {
            revert ReputationVault__CooldownActive(lastMint + NFT_COOLDOWN);
        }
        s_lastNftMintAt[msg.sender] = block.timestamp;

        i_engine.recordAction(msg.sender, ReputationMath.Action.NftMinted);

        emit CooldownReset(
            msg.sender,
            ReputationMath.Action.NftMinted,
            block.timestamp + NFT_COOLDOWN
        );
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns the active loan amount for `wallet`. 0 = no loan.
    function getActiveLoan(address wallet) external view returns (uint256) {
        return s_activeLoans[wallet];
    }

    /// @notice Returns the airdrop claim timestamp for `wallet`. 0 = none.
    function getAirdropClaimTime(address wallet) external view returns (uint256) {
        return s_airdropClaimTime[wallet];
    }

    /// @notice Returns the pending airdrop amount for `wallet`. 0 = none.
    function getAirdropAmount(address wallet) external view returns (uint256) {
        return s_airdropAmount[wallet];
    }

    /// @notice Returns true if `wallet` can settle their airdrop with +15.
    /// @dev    Convenience view for frontends — avoids unnecessary tx reversions.
    function isAirdropHeld(address wallet) external view returns (bool) {
        uint256 claimedAt = s_airdropClaimTime[wallet];
        if (claimedAt == 0) return false;
        return (block.timestamp - claimedAt) >= HOLD_PERIOD;
    }

    /// @notice Returns timestamp when wallet can castVote() again. 0 = now.
    function getNextVoteTime(address wallet) external view returns (uint256) {
        uint256 last = s_lastVoteAt[wallet];
        if (last == 0) return 0;
        uint256 next = last + VOTE_COOLDOWN;
        return block.timestamp >= next ? 0 : next;
    }

    /// @notice Returns timestamp when wallet can submitProposal() again. 0 = now.
    function getNextProposalTime(address wallet) external view returns (uint256) {
        uint256 last = s_lastProposalAt[wallet];
        if (last == 0) return 0;
        uint256 next = last + PROPOSAL_COOLDOWN;
        return block.timestamp >= next ? 0 : next;
    }

    /// @notice Returns timestamp when wallet can mintNFT() again. 0 = now.
    function getNextNftMintTime(address wallet) external view returns (uint256) {
        uint256 last = s_lastNftMintAt[wallet];
        if (last == 0) return 0;
        uint256 next = last + NFT_COOLDOWN;
        return block.timestamp >= next ? 0 : next;
    }

    /// @notice Returns the bound engine address.
    function getEngine() external view returns (address) {
        return address(i_engine);
    }
}
