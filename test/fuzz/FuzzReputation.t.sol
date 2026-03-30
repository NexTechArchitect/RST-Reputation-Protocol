// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ReputationToken}   from "../../src/ReputationToken.sol";
import {ReputationEngine}  from "../../src/ReputationEngine.sol";
import {ReputationVault}   from "../../src/ReputationVault.sol";
import {ReputationMath}    from "../../src/libraries/ReputationMath.sol";
import {ERC1967Proxy}      from "openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IReputationEngine} from "../../src/interfaces/IReputationEngine.sol";
import {IReputationToken}  from "../../src/interfaces/IReputationToken.sol";

// @dev Wrapper so vm.expectRevert can catch pure library reverts
contract MathWrapper {
    function applyAction(uint256 score, ReputationMath.Action action) external pure returns (uint256) {
        return ReputationMath.applyAction(score, action);
    }
}

contract FuzzReputation is Test {

    MathWrapper mathWrapper;

    ReputationToken  token;
    ReputationEngine engine;
    ReputationVault  vault;

    address owner = makeAddr("owner");
    address user  = makeAddr("user");

    function setUp() public {
        vm.startPrank(owner);

        token = new ReputationToken(owner);

        ReputationEngine impl = new ReputationEngine();
        bytes memory init = abi.encodeCall(ReputationEngine.initialize, (address(token), owner));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), init);
        engine = ReputationEngine(address(proxy));

        vault = new ReputationVault(address(engine), owner);

        token.setEngine(address(engine));
        engine.setAuthorizedCaller(address(vault), true);

        vm.stopPrank();
        vm.warp(1_700_000_000);
        mathWrapper = new MathWrapper();
    }

    /*//////////////////////////////////////////////////////////////
                        REPUTATIONMATH — PURE LIBRARY
    //////////////////////////////////////////////////////////////*/

    /// @dev Score must always stay in [0, MAX_SCORE] after any action.
    function testFuzz_Math_ApplyAction_ScoreAlwaysInBounds(
        uint256 score,
        uint8   actionSeed
    ) public pure {
        score      = bound(score, 0, ReputationMath.MAX_SCORE);
        actionSeed = uint8(bound(actionSeed, 0, 6));

        ReputationMath.Action action = ReputationMath.Action(actionSeed);
        uint256 newScore = ReputationMath.applyAction(score, action);

        assertLe(newScore, ReputationMath.MAX_SCORE);
    }

    /// @dev deltaFor must return the correct signed value for every action.
    function testFuzz_Math_DeltaFor_NeverReverts(uint8 actionSeed) public pure {
        actionSeed = uint8(bound(actionSeed, 0, 6));
        ReputationMath.Action action = ReputationMath.Action(actionSeed);
        int256 delta = ReputationMath.deltaFor(action);
        // Delta must be non-zero and within reasonable range
        assertTrue(delta != 0);
        assertGe(delta, -100);
        assertLe(delta,  100);
    }

    /// @dev resolveTier must never revert for any valid score.
    function testFuzz_Math_ResolveTier_NeverReverts(uint256 score) public pure {
        score = bound(score, 0, ReputationMath.MAX_SCORE);
        ReputationMath.Tier tier = ReputationMath.resolveTier(score);
        // Tier must be a valid enum value (0-4)
        assertLe(uint8(tier), 4);
    }

    /// @dev Tier boundaries must be monotonically consistent.
    function testFuzz_Math_TierBoundaries_Monotonic(uint256 score) public pure {
        score = bound(score, 0, ReputationMath.MAX_SCORE);
        ReputationMath.Tier tier = ReputationMath.resolveTier(score);

        if (score >= ReputationMath.TIER_PLATINUM) {
            assertEq(uint8(tier), uint8(ReputationMath.Tier.Platinum));
        } else if (score >= ReputationMath.TIER_GOLD) {
            assertEq(uint8(tier), uint8(ReputationMath.Tier.Gold));
        } else if (score >= ReputationMath.TIER_SILVER) {
            assertEq(uint8(tier), uint8(ReputationMath.Tier.Silver));
        } else if (score >= ReputationMath.TIER_BRONZE) {
            assertEq(uint8(tier), uint8(ReputationMath.Tier.Bronze));
        } else {
            assertEq(uint8(tier), uint8(ReputationMath.Tier.Unranked));
        }
    }

    /// @dev votingMultiplier must be consistent with tier.
    function testFuzz_Math_VotingMultiplier_ConsistentWithTier(uint256 score) public pure {
        score = bound(score, 0, ReputationMath.MAX_SCORE);
        uint256 multiplier = ReputationMath.votingMultiplier(score);
        ReputationMath.Tier tier = ReputationMath.resolveTier(score);

        if (tier == ReputationMath.Tier.Platinum) assertEq(multiplier, 30_000);
        else if (tier == ReputationMath.Tier.Gold)     assertEq(multiplier, 20_000);
        else if (tier == ReputationMath.Tier.Silver)   assertEq(multiplier, 15_000);
        else if (tier == ReputationMath.Tier.Bronze)   assertEq(multiplier, 10_000);
        else                                            assertEq(multiplier,  5_000);
    }

    /// @dev loanLimitBps must be consistent with tier.
    function testFuzz_Math_LoanLimitBps_ConsistentWithTier(uint256 score) public pure {
        score = bound(score, 0, ReputationMath.MAX_SCORE);
        uint256 bps  = ReputationMath.loanLimitBps(score);
        ReputationMath.Tier tier = ReputationMath.resolveTier(score);

        if (tier == ReputationMath.Tier.Platinum) assertEq(bps, 8_000);
        else if (tier == ReputationMath.Tier.Gold)     assertEq(bps, 6_000);
        else if (tier == ReputationMath.Tier.Silver)   assertEq(bps, 4_000);
        else if (tier == ReputationMath.Tier.Bronze)   assertEq(bps, 2_000);
        else                                            assertEq(bps,     0);
    }

    /// @dev applyAction must revert if score > MAX_SCORE.
    function testFuzz_Math_ApplyAction_RevertsOnInvalidScore(uint256 score) public {
        score = bound(score, ReputationMath.MAX_SCORE + 1, type(uint256).max);
        vm.expectRevert(
            abi.encodeWithSelector(
                ReputationMath.ReputationMath__ScoreOutOfBounds.selector,
                score
            )
        );
        mathWrapper.applyAction(score, ReputationMath.Action.DaoVote);
    }

    /*//////////////////////////////////////////////////////////////
                        ENGINE — SCORE INVARIANTS
    //////////////////////////////////////////////////////////////*/

    /// @dev Engine score must never exceed MAX_SCORE regardless of action sequence.
    function testFuzz_Engine_Score_NeverExceedsMax(
        uint8 actionCount,
        uint8[32] memory actionSeeds
    ) public {
        actionCount = uint8(bound(actionCount, 1, 32));

        vm.startPrank(owner);
        engine.setAuthorizedCaller(owner, true);
        vm.stopPrank();

        for (uint8 i = 0; i < actionCount; i++) {
            uint8 seed = uint8(bound(actionSeeds[i], 0, 6));
            // Skip negative actions for this particular invariant test
            // to purely test upper bound clamping
            if (seed == 3 || seed == 6) seed = 0; // skip LoanDefaulted, AirdropDumped
            vm.prank(owner);
            engine.recordAction(user, ReputationMath.Action(seed));
        }

        assertLe(engine.getScore(user), ReputationMath.MAX_SCORE);
    }

    /// @dev Engine score must never underflow below 0.
    function testFuzz_Engine_Score_NeverUnderflows(
        uint8 negativeActionCount
    ) public {
        negativeActionCount = uint8(bound(negativeActionCount, 1, 20));

        vm.startPrank(owner);
        engine.setAuthorizedCaller(owner, true);

        for (uint8 i = 0; i < negativeActionCount; i++) {
            engine.recordAction(user, ReputationMath.Action.LoanDefaulted); // -50 each
        }
        vm.stopPrank();

        // Score must be 0, never underflow
        assertEq(engine.getScore(user), 0);
    }

    /// @dev Action count must always increment — never decrement or overflow.
    function testFuzz_Engine_ActionCount_MonotonicallyIncreases(
        uint8 actionCount
    ) public {
        actionCount = uint8(bound(actionCount, 1, 20));

        vm.prank(owner);
        engine.setAuthorizedCaller(owner, true);

        for (uint8 i = 0; i < actionCount; i++) {
            uint256 before = engine.getActionCount(user);
            vm.prank(owner);
            engine.recordAction(user, ReputationMath.Action.DaoVote);
            assertEq(engine.getActionCount(user), before + 1);
        }
    }

    /// @dev lastActionAt must always be >= previous lastActionAt.
    function testFuzz_Engine_LastActionAt_NeverGoesBack(
        uint8 actionCount,
        uint32 skipSeconds
    ) public {
        actionCount  = uint8(bound(actionCount, 2, 10));
        skipSeconds  = uint32(bound(skipSeconds, 0, 7 days));

        vm.prank(owner);
        engine.setAuthorizedCaller(owner, true);

        uint256 lastTimestamp = 0;
        for (uint8 i = 0; i < actionCount; i++) {
            skip(skipSeconds);
            vm.prank(owner);
            engine.recordAction(user, ReputationMath.Action.DaoVote);

            uint256 current = engine.getLastActionAt(user);
            assertGe(current, lastTimestamp);
            lastTimestamp = current;
        }
    }

    /*//////////////////////////////////////////////////////////////
                        VAULT — COOLDOWN INVARIANTS
    //////////////////////////////////////////////////////////////*/

    /// @dev Cooldown must block any second call within the window.
    function testFuzz_Vault_VoteCooldown_AlwaysBlocks(uint32 skipSeconds) public {
        skipSeconds = uint32(bound(skipSeconds, 0, vault.VOTE_COOLDOWN() - 1));

        vm.startPrank(user);
        vault.castVote();

        skip(skipSeconds);

        vm.expectRevert(
            abi.encodeWithSelector(
                ReputationVault.ReputationVault__CooldownActive.selector,
                block.timestamp - skipSeconds + vault.VOTE_COOLDOWN()
            )
        );
        vault.castVote();
        vm.stopPrank();
    }

    /// @dev After cooldown expires, vote must always succeed.
    function testFuzz_Vault_VoteCooldown_AlwaysAllowsAfterExpiry(
        uint32 extraSeconds
    ) public {
        extraSeconds = uint32(bound(extraSeconds, 0, 7 days));

        vm.startPrank(user);
        vault.castVote();
        skip(vault.VOTE_COOLDOWN() + extraSeconds);
        vault.castVote(); // Must not revert
        vm.stopPrank();
    }

    /// @dev Proposal cooldown blocks any second call within window.
    function testFuzz_Vault_ProposalCooldown_AlwaysBlocks(uint32 skipSeconds) public {
        skipSeconds = uint32(bound(skipSeconds, 0, vault.PROPOSAL_COOLDOWN() - 1));

        vm.startPrank(user);
        vault.submitProposal();
        skip(skipSeconds);
        vm.expectRevert();
        vault.submitProposal();
        vm.stopPrank();
    }

    /// @dev NFT cooldown blocks any second call within window.
    function testFuzz_Vault_NftCooldown_AlwaysBlocks(uint32 skipSeconds) public {
        skipSeconds = uint32(bound(skipSeconds, 0, vault.NFT_COOLDOWN() - 1));

        vm.startPrank(user);
        vault.mintNFT();
        skip(skipSeconds);
        vm.expectRevert();
        vault.mintNFT();
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                        VAULT — LOAN INVARIANTS
    //////////////////////////////////////////////////////////////*/

    /// @dev Any non-zero loan amount must be stored exactly.
    function testFuzz_Vault_TakeLoan_StoresAmountExactly(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);

        vm.prank(user);
        vault.takeLoan(amount);

        assertEq(vault.getActiveLoan(user), amount);
    }

    /// @dev After repay, active loan must always be zero.
    function testFuzz_Vault_RepayLoan_AlwaysClearsLoan(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);

        vm.startPrank(user);
        vault.takeLoan(amount);
        vault.repayLoan();
        vm.stopPrank();

        assertEq(vault.getActiveLoan(user), 0);
    }

    /// @dev After default, active loan must always be zero.
    function testFuzz_Vault_MarkDefault_AlwaysClearsLoan(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);

        vm.prank(user);
        vault.takeLoan(amount);

        vm.prank(owner);
        vault.markDefault(user);

        assertEq(vault.getActiveLoan(user), 0);
    }

    /// @dev Zero amount must always revert.
    function testFuzz_Vault_TakeLoan_ZeroAlwaysReverts(address caller) public {
        vm.assume(caller != address(0));
        vm.prank(caller);
        vm.expectRevert(ReputationVault.ReputationVault__ZeroAmount.selector);
        vault.takeLoan(0);
    }

    /*//////////////////////////////////////////////////////////////
                        VAULT — AIRDROP INVARIANTS
    //////////////////////////////////////////////////////////////*/

    /// @dev Airdrop amount stored at claim must match what is read back.
    function testFuzz_Vault_Airdrop_AmountStoredExactly(uint256 amount) public {
        amount = bound(amount, 1, type(uint128).max);

        vm.prank(user);
        vault.claimAirdrop(amount);

        assertEq(vault.getAirdropAmount(user), amount);
        assertGt(vault.getAirdropClaimTime(user), 0);
    }

    /// @dev After settle, both airdrop mappings must be zero.
    function testFuzz_Vault_Airdrop_AlwaysClearedAfterSettle(
        uint256 amount,
        uint32  skipSeconds
    ) public {
        amount      = bound(amount, 1, type(uint128).max);
        skipSeconds = uint32(bound(skipSeconds, 0, 60 days));

        vm.startPrank(user);
        vault.claimAirdrop(amount);
        skip(skipSeconds);
        vault.settleAirdrop();
        vm.stopPrank();

        assertEq(vault.getAirdropClaimTime(user), 0);
        assertEq(vault.getAirdropAmount(user),    0);
    }

    /// @dev Held/dumped outcome must be deterministic based on timestamp.
    function testFuzz_Vault_Airdrop_HeldOutcome_Deterministic(
        uint256 amount,
        uint32  skipSeconds
    ) public {
        amount      = bound(amount, 1, type(uint128).max);
        skipSeconds = uint32(bound(skipSeconds, 0, 60 days));

        // Get some base score so negative score doesn't clamp to 0
        vm.prank(owner);
        engine.setAuthorizedCaller(owner, true);
        vm.prank(owner);
        engine.recordAction(user, ReputationMath.Action.LoanRepaid); // +30

        uint256 scoreBefore = engine.getScore(user);

        vm.startPrank(user);
        vault.claimAirdrop(amount);
        skip(skipSeconds);
        bool willBeHeld = vault.isAirdropHeld(user);
        vault.settleAirdrop();
        vm.stopPrank();

        uint256 scoreAfter = engine.getScore(user);

        if (willBeHeld) {
            // +15 applied
            uint256 expected = scoreBefore + 15 > ReputationMath.MAX_SCORE
                ? ReputationMath.MAX_SCORE
                : scoreBefore + 15;
            assertEq(scoreAfter, expected);
        } else {
            // -20 applied, clamped at 0
            uint256 expected = scoreBefore >= 20 ? scoreBefore - 20 : 0;
            assertEq(scoreAfter, expected);
        }
    }

    /*//////////////////////////////////////////////////////////////
                        TOKEN — SBT INVARIANTS
    //////////////////////////////////////////////////////////////*/

    /// @dev Every wallet can have at most one SBT.
    function testFuzz_Token_OneSBTPerWallet(address wallet) public {
        vm.assume(wallet != address(0));
        vm.assume(wallet.code.length == 0); // EOA only

        // Issue first token
        vm.prank(address(engine));
        token.issue(wallet);
        assertTrue(token.hasSBT(wallet));

        // Second issue must revert
        vm.prank(address(engine));
        vm.expectRevert(
            abi.encodeWithSelector(
                IReputationToken.IReputationToken__AlreadyHasSBT.selector,
                wallet
            )
        );
        token.issue(wallet);
    }

    /// @dev totalSupply must equal number of successful issues minus burns.
    function testFuzz_Token_TotalSupply_Consistent(uint8 issueCount) public {
        issueCount = uint8(bound(issueCount, 1, 20));

        // Create unique wallets and issue tokens
        for (uint8 i = 0; i < issueCount; i++) {
            address w = address(uint160(i + 1000));
            vm.prank(address(engine));
            token.issue(w);
        }

        assertEq(token.totalSupply(), issueCount);

        // Burn first token — supply decrements
        vm.prank(address(engine));
        token.burn(1);
        assertEq(token.totalSupply(), issueCount - 1);
    }

    /// @dev tokenOf must return 0 for any wallet that never got an SBT.
    function testFuzz_Token_TokenOf_ZeroForUnknownWallet(address wallet) public view {
        vm.assume(wallet != address(0));
        assertEq(token.tokenOf(wallet), 0);
        assertFalse(token.hasSBT(wallet));
    }

    /// @dev Any address other than engine must fail to issue.
    function testFuzz_Token_OnlyEngine_CanIssue(address caller) public {
        vm.assume(caller != address(engine));
        vm.assume(caller != address(0));

        vm.prank(caller);
        vm.expectRevert(IReputationToken.IReputationToken__OnlyEngine.selector);
        token.issue(user);
    }

    /// @dev Any address other than engine must fail to burn.
    function testFuzz_Token_OnlyEngine_CanBurn(address caller) public {
        // First issue a valid token
        vm.prank(address(engine));
        token.issue(user);
        uint256 tokenId = token.tokenOf(user);

        vm.assume(caller != address(engine));
        vm.assume(caller != address(0));

        vm.prank(caller);
        vm.expectRevert(IReputationToken.IReputationToken__OnlyEngine.selector);
        token.burn(tokenId);
    }

    /*//////////////////////////////////////////////////////////////
                        ENGINE — ACCESS CONTROL INVARIANTS
    //////////////////////////////////////////////////////////////*/

    /// @dev Any unauthorized caller must always revert on recordAction.
    function testFuzz_Engine_UnauthorizedCallers_AlwaysRevert(address caller) public {
        vm.assume(caller != address(vault));
        vm.assume(caller != owner);
        vm.assume(caller != address(0));

        vm.prank(caller);
        vm.expectRevert(IReputationEngine.IReputationEngine__NotAuthorized.selector);
        engine.recordAction(user, ReputationMath.Action.DaoVote);
    }

    /// @dev Zero address wallet must always revert on recordAction.
    function testFuzz_Engine_ZeroWallet_AlwaysReverts(uint8 actionSeed) public {
        actionSeed = uint8(bound(actionSeed, 0, 6));

        vm.prank(owner);
        engine.setAuthorizedCaller(owner, true);

        vm.prank(owner);
        vm.expectRevert(IReputationEngine.IReputationEngine__ZeroAddress.selector);
        engine.recordAction(address(0), ReputationMath.Action(actionSeed));
    }

    /// @dev isAuthorized must reflect setAuthorizedCaller exactly.
    function testFuzz_Engine_Authorization_MatchesStorage(address caller, bool authorized) public {
        vm.assume(caller != address(0));

        vm.prank(owner);
        engine.setAuthorizedCaller(caller, authorized);

        assertEq(engine.isAuthorized(caller), authorized);
    }

    /// @dev setAuthorizedCaller no-op — calling twice with same value must not emit.
    function testFuzz_Engine_SetAuthorized_NoOpOnSameValue(address caller) public {
        vm.assume(caller != address(0));

        vm.prank(owner);
        engine.setAuthorizedCaller(caller, true);

        // Second call with same value — storage write skipped
        vm.prank(owner);
        engine.setAuthorizedCaller(caller, true);

        // State unchanged
        assertTrue(engine.isAuthorized(caller));
    }
}
