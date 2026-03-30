// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ReputationMath} from "../libraries/ReputationMath.sol";

/// @title  IReputationEngine
/// @author NexTechArchitect
/// @notice Interface for the Reputation scoring engine.
///
/// @dev    SECURITY INVARIANTS (enforced by implementation)
///         ─────────────────────────────────────────────────
///         • Only authorised callers (vaults / protocols) may call recordAction().
///         • recordAction() MUST follow CEI:
///             1. Checks  — validate wallet (non-zero), validate caller auth
///             2. Effects — update s_scores, s_actionCount, s_lastActionAt
///             3. Interact — call token.issue() only if wallet has no SBT yet
///           External call (token.issue) comes LAST to prevent reentrancy.
///         • Score is always clamped to [0, MAX_SCORE] via ReputationMath.
///         • ReentrancyGuard MUST be applied to recordAction() in implementation.

interface IReputationEngine {

    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @dev Reverts when msg.sender is not an authorised caller or owner.
    error IReputationEngine__NotAuthorized();

    /// @dev Reverts when address(0) is passed where a real address is required.
    ///      [FIX-M3] Moved from implementation to interface so callers can catch
    ///      it by selector without importing the concrete implementation type.
    error IReputationEngine__ZeroAddress();

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice Emitted every time a wallet's reputation score changes.
    /// @param  wallet    The wallet whose score changed.
    /// @param  oldScore  Score before the action was applied.
    /// @param  newScore  Score after clamping — always in [0, MAX_SCORE].
    event ScoreUpdated(
        address indexed wallet,
        uint256         oldScore,
        uint256         newScore
    );

    /// @notice Emitted every time an action is recorded for a wallet.
    /// @param  wallet  The wallet the action is attributed to.
    /// @param  action  The action variant from ReputationMath.Action.
    /// @param  delta   The signed score delta that was applied.
    event ActionRecorded(
        address indexed       wallet,
        ReputationMath.Action action,
        int256                delta
    );

    /// @notice Emitted when an address is granted authorisation to record actions.
    /// @param  caller  The address that was granted authorisation.
    event CallerAuthorized(address indexed caller);

    /// @notice Emitted when an address has its authorisation revoked.
    /// @dev    Revocation is security-critical — separate event allows dedicated
    ///         alert routing independent of grant events.
    /// @param  caller  The address whose authorisation was revoked.
    event CallerRevoked(address indexed caller);

    /*//////////////////////////////////////////////////////////////
                           WRITE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Record an on-chain action for `wallet` and update its score.
    /// @dev    CALLER RESTRICTION: only authorised callers (set via setAuthorizedCaller).
    ///         REENTRANCY: implementation must use ReentrancyGuard.
    ///         CEI ORDER: Checks → Effects (score, actionCount, lastActionAt) → Interact (token.issue).
    ///         Auto-issues a Soulbound Token on the wallet's first recorded action.
    /// @param  wallet  The wallet to attribute the action to. Must not be address(0).
    /// @param  action  The action variant to apply.
    function recordAction(
        address wallet,
        ReputationMath.Action action
    ) external;

    /// @notice Grant or revoke authorisation for a caller to record actions.
    /// @dev    CALLER RESTRICTION: only owner.
    ///         Authorised callers are typically vault / protocol contracts.
    ///         Emits CallerAuthorized or CallerRevoked depending on `authorized`.
    /// @param  caller      Address to authorise or deauthorise. Must not be address(0).
    /// @param  authorized  True to grant, false to revoke.
    function setAuthorizedCaller(address caller, bool authorized) external;

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns the current reputation score for `wallet`.
    /// @dev    Returns 0 for wallets with no recorded actions — never reverts.
    function getScore(address wallet) external view returns (uint256);

    /// @notice Returns the Tier enum for `wallet`.
    /// @dev    Delegates to ReputationMath.resolveTier(). Never reverts.
    function getTier(address wallet) external view returns (ReputationMath.Tier);

    /// @notice Returns the human-readable tier name for `wallet`.
    /// @dev    For events and frontend display only.
    ///         Prefer getTier() for on-chain conditional logic.
    function getTierName(address wallet) external view returns (string memory);

    /// @notice Returns the voting power multiplier (bps) for `wallet`.
    /// @dev    10_000 bps = 1x. Delegates to ReputationMath.votingMultiplier().
    function getVotingMultiplier(address wallet) external view returns (uint256);

    /// @notice Returns the max undercollateralised loan limit (bps) for `wallet`.
    /// @dev    Returns 0 for Unranked. Delegates to ReputationMath.loanLimitBps().
    function getLoanLimitBps(address wallet) external view returns (uint256);

    /// @notice Returns total actions recorded for `wallet` across all types.
    function getActionCount(address wallet) external view returns (uint256);

    /// @notice Returns the block timestamp of the wallet's most recent action.
    /// @dev    Returns 0 for wallets with no recorded actions.
    function getLastActionAt(address wallet) external view returns (uint256 timestamp);

    /// @notice Returns true if `caller` is authorised to call recordAction().
    function isAuthorized(address caller) external view returns (bool);

    /// @notice Returns the address of the bound ReputationToken contract.
    function getReputationToken() external view returns (address);
}
