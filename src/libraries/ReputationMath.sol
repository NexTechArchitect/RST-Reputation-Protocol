// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title  ReputationMath
/// @author NexTechArchitect
/// @notice Pure math library for reputation score calculations.
/// @dev    No state, no external calls — zero reentrancy surface.
///         All scores are enforced in [0, MAX_SCORE] at every entry point.
///         Deltas are routed exclusively through the Action enum to prevent
///         arbitrary signed-integer misuse.
///         This library only allows importing contracts to call it.

library ReputationMath {
    /*//////////////////////////////////////////////////////////////
                            ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @dev Thrown when a score argument exceeds MAX_SCORE.
    error ReputationMath__ScoreOutOfBounds(uint256 score);

    /// @dev Thrown when an action is unknown.
    error ReputationMath__UnknownAction();

    /*//////////////////////////////////////////////////////////////
                            ENUMS
    //////////////////////////////////////////////////////////////*/

    /// @notice Every action that can affect reputation.
    /// @dev    Enum-only entry point closes the arbitrary-delta misuse vector.
    ///         Callers cannot supply raw int256 values.
    enum Action {
        DaoVote, // +10
        DaoProposal, // +25
        LoanRepaid, // +30
        LoanDefaulted, // -50
        AirdropHeld, // +15
        AirdropDumped, // -20
        NftMinted //  +5
    }

    /// @notice Tier levels returned by resolveTier().
    /// @dev    Enum is gas-efficient for on-chain comparisons.
    ///         Use tierName() only for events / frontend strings.
    enum Tier {
        Unranked,
        Bronze,
        Silver,
        Gold,
        Platinum
    }

    /*//////////////////////////////////////////////////////////////
                            CONSTANTS
    //////////////////////////////////////////////////////////////*/

    uint256 internal constant MAX_SCORE = 1000;

    uint256 internal constant MIN_SCORE = 0;

    // ── Tier thresholds ──────────────────────────────────────────
    uint256 internal constant TIER_BRONZE = 100;
    uint256 internal constant TIER_SILVER = 300;
    uint256 internal constant TIER_GOLD = 600;
    uint256 internal constant TIER_PLATINUM = 850;

    // ── Raw deltas (only reachable via deltaFor — Action enum gated) ─
    int256 private constant _DELTA_DAO_VOTE = 10;
    int256 private constant _DELTA_DAO_PROPOSAL = 25;
    int256 private constant _DELTA_LOAN_REPAID = 30;
    int256 private constant _DELTA_LOAN_DEFAULTED = -50;
    int256 private constant _DELTA_AIRDROP_HELD = 15;
    int256 private constant _DELTA_AIRDROP_DUMPED = -20;
    int256 private constant _DELTA_NFT_MINTED = 5;

    // ── Voting power (basis points: 10_000 = 1x) ─────────────────
    uint256 internal constant VOTING_UNRANKED = 5_000; // 0.5x
    uint256 internal constant VOTING_BRONZE = 10_000; // 1x
    uint256 internal constant VOTING_SILVER = 15_000; // 1.5x
    uint256 internal constant VOTING_GOLD = 20_000; // 2x
    uint256 internal constant VOTING_PLATINUM = 30_000; // 3x

    // ── Undercollateralised loan ceiling (bps of collateral value) ─
    /// @dev Intentional asymmetry: VOTING_UNRANKED > 0 (all wallets can vote)
    ///      but LOAN_UNRANKED = 0 (unranked wallets cannot borrow).
    ///      Borrowing requires demonstrated on-chain trust; voting is open to all.
    uint256 internal constant LOAN_UNRANKED = 0;
    uint256 internal constant LOAN_BRONZE = 2_000; // 20%
    uint256 internal constant LOAN_SILVER = 4_000; // 40%
    uint256 internal constant LOAN_GOLD = 6_000; // 60%
    uint256 internal constant LOAN_PLATINUM = 8_000; // 80%

    /*//////////////////////////////////////////////////////////////
                        PRIMARY ENTRY POINT
    //////////////////////////////////////////////////////////////*/

    /// @notice Apply an Action to a score and return the clamped result.
    /// @dev    Sole entry point for score mutation.
    ///         Enum parameter prevents callers from supplying arbitrary deltas.
    /// @param  currentScore  Must be <= MAX_SCORE.
    /// @param  action        One of the valid Action variants.
    /// @return newScore      New score clamped to [0, MAX_SCORE].
    function applyAction(
        uint256 currentScore,
        Action action
    ) internal pure returns (uint256 newScore) {
        _assertValidScore(currentScore);
        return _applyDelta(currentScore, deltaFor(action));
    }

    /*//////////////////////////////////////////////////////////////
                        TIER RESOLUTION
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns the Tier enum for a given score.
    /// @dev    Prefer for on-chain comparisons — no string hashing cost.
    function resolveTier(uint256 score) internal pure returns (Tier) {
        _assertValidScore(score);
        return _resolveTierUnchecked(score);
    }

    /// @notice Returns the human-readable tier name.
    /// @dev    For events and frontend display only.
    ///         Avoid in on-chain conditional logic — use resolveTier() instead.
    ///         Calls _assertValidScore once then delegates to _resolveTierUnchecked
    ///         to avoid the double-guard cost of calling resolveTier() internally.
    function tierName(uint256 score) internal pure returns (string memory) {
        _assertValidScore(score);
        Tier t = _resolveTierUnchecked(score);
        if (t == Tier.Platinum) return "Platinum";
        if (t == Tier.Gold) return "Gold";
        if (t == Tier.Silver) return "Silver";
        if (t == Tier.Bronze) return "Bronze";
        return "Unranked";
    }

    /*//////////////////////////////////////////////////////////////
                        DERIVED METRICS
    //////////////////////////////////////////////////////////////*/

    /// @notice Voting power multiplier in basis points (10_000 = 1x).
    /// @dev    Usage: finalWeight = (rawVotes * votingMultiplier(score)) / 10_000
    function votingMultiplier(uint256 score) internal pure returns (uint256) {
        _assertValidScore(score);
        if (score >= TIER_PLATINUM) return VOTING_PLATINUM;
        if (score >= TIER_GOLD) return VOTING_GOLD;
        if (score >= TIER_SILVER) return VOTING_SILVER;
        if (score >= TIER_BRONZE) return VOTING_BRONZE;
        return VOTING_UNRANKED;
    }

    /// @notice Max undercollateralised loan as bps of collateral value.
    /// @dev    Returns 0 for Unranked — no undercollateralised credit allowed.
    ///         Usage: loanCeiling = (collateralValue * loanLimitBps(score)) / 10_000
    function loanLimitBps(uint256 score) internal pure returns (uint256) {
        _assertValidScore(score);
        if (score >= TIER_PLATINUM) return LOAN_PLATINUM;
        if (score >= TIER_GOLD) return LOAN_GOLD;
        if (score >= TIER_SILVER) return LOAN_SILVER;
        if (score >= TIER_BRONZE) return LOAN_BRONZE;
        return LOAN_UNRANKED;
    }

    /*//////////////////////////////////////////////////////////////
                              DELTA ACCESSOR
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns the signed delta for a given Action.
    /// @dev    Prefer for on-chain comparisons — no string hashing cost.
    function deltaFor(Action action) internal pure returns (int256) {
        if (action == Action.DaoVote) return _DELTA_DAO_VOTE;
        if (action == Action.DaoProposal) return _DELTA_DAO_PROPOSAL;
        if (action == Action.LoanRepaid) return _DELTA_LOAN_REPAID;
        if (action == Action.LoanDefaulted) return _DELTA_LOAN_DEFAULTED;
        if (action == Action.AirdropHeld) return _DELTA_AIRDROP_HELD;
        if (action == Action.AirdropDumped) return _DELTA_AIRDROP_DUMPED;
        if (action == Action.NftMinted) return _DELTA_NFT_MINTED;
        revert ReputationMath__UnknownAction();
    }

    /*//////////////////////////////////////////////////////////////
                        PRIVATE HELPERS
    //////////////////////////////////////////////////////////////*/

    /// @dev Shared score-range guard. Called once at every public entry point.
    function _assertValidScore(uint256 score) private pure {
        if (score > MAX_SCORE) revert ReputationMath__ScoreOutOfBounds(score);
    }

    /// @dev Tier resolution without the score guard.
    ///      Only call after _assertValidScore has already run in the same frame.
    function _resolveTierUnchecked(uint256 score) private pure returns (Tier) {
        if (score >= TIER_PLATINUM) return Tier.Platinum;
        if (score >= TIER_GOLD) return Tier.Gold;
        if (score >= TIER_SILVER) return Tier.Silver;
        if (score >= TIER_BRONZE) return Tier.Bronze;
        return Tier.Unranked;
    }

    /// @dev Core clamped addition.
    /// @param  currentScore  Pre-validated to be <= MAX_SCORE.
    /// @param  delta         Raw signed delta from deltaFor().
    function _applyDelta(uint256 currentScore, int256 delta) private pure returns (uint256) {
        // Future-proof upper-overflow guard.
        // forge-lint: disable-next-line(unsafe-typecast)
        if (delta >= int256(MAX_SCORE)) return MAX_SCORE;

        // Future-proof lower-overflow guard.
        // forge-lint: disable-next-line(unsafe-typecast)
        if (delta <= -int256(MAX_SCORE)) return 0;

        // Safe addition — operands proven bounded above, no overflow.
        // forge-lint: disable-next-line(unsafe-typecast)
        int256 raw = int256(currentScore) + delta;

        // Lower clamp.
        //  literal `0` — not `int256(MIN_SCORE)` — intentional.
        if (raw < 0) return 0;

        // Upper clamp.
        // forge-lint: disable-next-line(unsafe-typecast)
        if (raw >= int256(MAX_SCORE)) return MAX_SCORE;

        // Safe downcast: raw is proven in [1, 999] at this point.
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint256(raw);
    }
}
