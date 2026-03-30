// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ReputationToken}  from "../../src/ReputationToken.sol";
import {ReputationEngine} from "../../src/ReputationEngine.sol";
import {ReputationVault}  from "../../src/ReputationVault.sol";
import {ReputationMath}   from "../../src/libraries/ReputationMath.sol";
import {ERC1967Proxy}     from "openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IReputationEngine} from "../../src/interfaces/IReputationEngine.sol";
import {IReputationToken}  from "../../src/interfaces/IReputationToken.sol";

// ─── Helper contracts ────────────────────────────────────────────────────────

contract ExternalDeFiProtocol {
    ReputationEngine public engine;
    constructor(address _engine) { engine = ReputationEngine(_engine); }
    function userDidAwesomeDeFiThing(address user) external {
        engine.recordAction(user, ReputationMath.Action.DaoProposal);
    }
}

contract ReputationEngineV2 is ReputationEngine {
    function getV2Feature() external pure returns (string memory) {
        return "V2_UPGRADE_SUCCESSFUL";
    }
}

// Malicious token that tries to reenter recordAction on issue()
contract MaliciousReentrantToken {
    address public engine;
    bool public attacked;

    function setEngine(address _engine) external { engine = _engine; }

    function hasSBT(address) external pure returns (bool) { return false; }

    function issue(address wallet) external returns (uint256) {
        if (!attacked) {
            attacked = true;
            // Try to reenter recordAction — should be blocked by nonReentrant
            ReputationEngine(engine).recordAction(wallet, ReputationMath.Action.DaoVote);
        }
        return 1;
    }
}

// ─── Test contract ────────────────────────────────────────────────────────────

contract ReputationFlowTest is Test {

    ReputationToken        token;
    ReputationEngine       engine;
    ReputationVault        vault;
    ExternalDeFiProtocol   defiProtocol;

    address owner  = makeAddr("nexTechArchitect");
    address amit   = makeAddr("amit");
    address priya  = makeAddr("priya");
    address hacker = makeAddr("hacker");
    address noob   = makeAddr("noob");

    // ── events to test ───────────────────────────────────────────
    event ScoreUpdated(address indexed wallet, uint256 oldScore, uint256 newScore);
    event ActionRecorded(address indexed wallet, ReputationMath.Action action, int256 delta);
    event CallerAuthorized(address indexed caller);
    event CallerRevoked(address indexed caller);

    function setUp() public {
        vm.startPrank(owner);

        token = new ReputationToken(owner);

        ReputationEngine impl = new ReputationEngine();
        bytes memory init = abi.encodeCall(ReputationEngine.initialize, (address(token), owner));
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), init);
        engine = ReputationEngine(address(proxy));

        vault        = new ReputationVault(address(engine), owner);
        defiProtocol = new ExternalDeFiProtocol(address(engine));

        token.setEngine(address(engine));
        engine.setAuthorizedCaller(address(vault), true);
        engine.setAuthorizedCaller(address(defiProtocol), true);

        vm.stopPrank();
        vm.warp(1_700_000_000);
    }

    // ─────────────────────────────────────────────────────────────
    //  SCENARIO 1 — ROAD TO PLATINUM (full journey)
    // ─────────────────────────────────────────────────────────────

    function test_Amit_RoadToPlatinum_CompleteJourney() public {
        vm.startPrank(amit);

        // First action auto-issues SBT
        vault.castVote();
        assertTrue(token.hasSBT(amit));
        assertEq(token.totalSupply(), 1);
        assertEq(token.tokenOf(amit), 1);
        assertEq(engine.getScore(amit), 10);
        assertEq(engine.getActionCount(amit), 1);
        assertEq(engine.getTierName(amit), "Unranked");

        // Airdrop held path
        vault.claimAirdrop(1000 ether);
        skip(31 days);
        vault.settleAirdrop(); // +15 → 25
        assertEq(engine.getScore(amit), 25);

        // 10 loan repayments → +300
        for (uint i = 0; i < 10; i++) {
            vault.takeLoan(100 ether);
            vault.repayLoan();
        }
        assertEq(engine.getScore(amit), 325);
        assertEq(uint(engine.getTier(amit)), uint(ReputationMath.Tier.Silver));
        assertEq(engine.getLoanLimitBps(amit), 4_000);
        assertEq(engine.getVotingMultiplier(amit), 15_000);
        vm.stopPrank();

        // External protocol adds +25
        defiProtocol.userDidAwesomeDeFiThing(amit);
        assertEq(engine.getScore(amit), 350);

        // 20 proposals to reach Platinum (850)
        vm.startPrank(amit);
        for (uint i = 0; i < 20; i++) {
            skip(25 hours);
            vault.submitProposal(); // +25 each
        }
        assertEq(engine.getScore(amit), 850);
        assertEq(engine.getTierName(amit), "Platinum");
        assertEq(engine.getVotingMultiplier(amit), 30_000);
        assertEq(engine.getLoanLimitBps(amit), 8_000);
        vm.stopPrank();
    }

    // ─────────────────────────────────────────────────────────────
    //  SCENARIO 2 — SCORE CLAMPING
    // ─────────────────────────────────────────────────────────────

    function test_Score_ClampedAt_MaxScore() public {
        // Push amit close to 1000
        vm.startPrank(amit);
        for (uint i = 0; i < 33; i++) {
            vault.takeLoan(1 ether);
            vault.repayLoan(); // +30 each → 990
        }
        assertEq(engine.getScore(amit), 990);

        // One more repay pushes to exactly 1000 (clamped)
        vault.takeLoan(1 ether);
        vault.repayLoan();
        assertEq(engine.getScore(amit), 1000);

        // Score cannot exceed 1000 — clamped at MAX
        skip(25 hours);
        vault.submitProposal();
        assertEq(engine.getScore(amit), 1000);
        vm.stopPrank();
    }

    function test_Score_ClampedAt_Zero_OnDefault() public {
        // Noob has no score — default should clamp at 0, not underflow
        vm.prank(noob);
        vault.takeLoan(1 ether);

        vm.prank(owner);
        vault.markDefault(noob);

        assertEq(engine.getScore(noob), 0);
    }

    // ─────────────────────────────────────────────────────────────
    //  SCENARIO 3 — AIRDROP DUMP PATH
    // ─────────────────────────────────────────────────────────────

    function test_Airdrop_DumpedEarly_NegativeScore() public {
        // First get some score so we can go negative-ish
        vm.startPrank(amit);
        vault.castVote(); // +10 → 10

        vault.claimAirdrop(500 ether);
        skip(1 days); // Only 1 day — not 30
        vault.settleAirdrop(); // -20 → clamped at 0 (10 - 20 = -10 → 0)

        assertEq(engine.getScore(amit), 0);
        assertEq(engine.getTierName(amit), "Unranked");
        vm.stopPrank();
    }

    function test_Airdrop_HeldExactly30Days_Passes() public {
        vm.startPrank(amit);
        vault.claimAirdrop(100 ether);
        skip(30 days); // Exactly at boundary
        vault.settleAirdrop(); // +15
        assertEq(engine.getScore(amit), 15);
        vm.stopPrank();
    }

    function test_Airdrop_HeldOneDayShort_Dumps() public {
        vm.startPrank(amit);
        vault.castVote(); // +10
        vault.claimAirdrop(100 ether);
        skip(30 days - 1); // One second short
        vault.settleAirdrop(); // -20 → 0
        assertEq(engine.getScore(amit), 0);
        vm.stopPrank();
    }

    // ─────────────────────────────────────────────────────────────
    //  SCENARIO 4 — COOLDOWN ENFORCEMENT
    // ─────────────────────────────────────────────────────────────

    function test_VoteCooldown_BlocksDoubleVote() public {
        vm.startPrank(amit);
        vault.castVote();

        vm.expectRevert(
            abi.encodeWithSelector(
                ReputationVault.ReputationVault__CooldownActive.selector,
                block.timestamp + vault.VOTE_COOLDOWN()
            )
        );
        vault.castVote(); // Immediate second vote — reverts
        vm.stopPrank();
    }

    function test_VoteCooldown_AllowsAfterCooldown() public {
        vm.startPrank(amit);
        vault.castVote(); // +10
        skip(12 hours + 1);
        vault.castVote(); // +10 → 20
        assertEq(engine.getScore(amit), 20);
        vm.stopPrank();
    }

    function test_ProposalCooldown_BlocksDoubleProposal() public {
        vm.startPrank(amit);
        vault.submitProposal();
        vm.expectRevert(
            abi.encodeWithSelector(
                ReputationVault.ReputationVault__CooldownActive.selector,
                block.timestamp + vault.PROPOSAL_COOLDOWN()
            )
        );
        vault.submitProposal();
        vm.stopPrank();
    }

    function test_NftCooldown_BlocksDoubleMint() public {
        vm.startPrank(amit);
        vault.mintNFT();
        vm.expectRevert(
            abi.encodeWithSelector(
                ReputationVault.ReputationVault__CooldownActive.selector,
                block.timestamp + vault.NFT_COOLDOWN()
            )
        );
        vault.mintNFT();
        vm.stopPrank();
    }

    function test_DifferentCooldowns_AreIndependent() public {
        vm.startPrank(amit);
        vault.castVote();
        vault.submitProposal();
        vault.mintNFT();
        // All three fired once — cooldowns are per-action, independent
        assertEq(engine.getScore(amit), 10 + 25 + 5);
        vm.stopPrank();
    }

    // ─────────────────────────────────────────────────────────────
    //  SCENARIO 5 — SBT LIFECYCLE
    // ─────────────────────────────────────────────────────────────

    function test_SBT_AutoIssuedOnFirstAction() public {
        assertFalse(token.hasSBT(amit));
        vm.prank(amit);
        vault.castVote();
        assertTrue(token.hasSBT(amit));
        assertEq(token.tokenOf(amit), 1);
        assertEq(token.totalSupply(), 1);
    }

    function test_SBT_NotDuplicatedOnSecondAction() public {
        vm.startPrank(amit);
        vault.castVote();
        uint256 tokenId = token.tokenOf(amit);
        assertEq(token.totalSupply(), 1);

        skip(13 hours);
        vault.castVote();
        // Same tokenId, supply unchanged
        assertEq(token.tokenOf(amit), tokenId);
        assertEq(token.totalSupply(), 1);
        vm.stopPrank();
    }

    function test_SBT_Burn_ClearsState() public {
        vm.prank(amit);
        vault.castVote();
        uint256 tokenId = token.tokenOf(amit);
        assertTrue(token.hasSBT(amit));
        assertEq(token.totalSupply(), 1);

        vm.prank(address(engine));
        token.burn(tokenId);

        assertFalse(token.hasSBT(amit));
        assertEq(token.tokenOf(amit), 0);
        assertEq(token.totalSupply(), 0);
    }

    function test_SBT_IsSoulbound_TransferReverts() public {
        vm.prank(amit);
        vault.castVote();
        uint256 tokenId = token.tokenOf(amit);

        vm.prank(amit);
        vm.expectRevert(IReputationToken.IReputationToken__SoulboundNonTransferable.selector);
        token.transferFrom(amit, hacker, tokenId);
    }

    function test_SBT_MultiplWallets_IndependentTokenIds() public {
        vm.prank(amit);  vault.castVote();
        vm.prank(priya); vault.mintNFT();
        vm.prank(noob);  vault.submitProposal();

        assertEq(token.tokenOf(amit),  1);
        assertEq(token.tokenOf(priya), 2);
        assertEq(token.tokenOf(noob),  3);
        assertEq(token.totalSupply(),  3);
    }

    // ─────────────────────────────────────────────────────────────
    //  SCENARIO 6 — LOAN STATE INTEGRITY
    // ─────────────────────────────────────────────────────────────

    function test_Loan_StateCleared_AfterRepay() public {
        vm.startPrank(amit);
        vault.takeLoan(500 ether);
        assertEq(vault.getActiveLoan(amit), 500 ether);

        vault.repayLoan();
        assertEq(vault.getActiveLoan(amit), 0);
        vm.stopPrank();
    }

    function test_Loan_StateCleared_AfterDefault() public {
        vm.prank(noob);
        vault.takeLoan(500 ether);
        assertEq(vault.getActiveLoan(noob), 500 ether);

        vm.prank(owner);
        vault.markDefault(noob);
        assertEq(vault.getActiveLoan(noob), 0);
    }

    function test_Loan_CannotTakeTwo_BeforeResolving() public {
        vm.startPrank(amit);
        vault.takeLoan(100 ether);
        vm.expectRevert(ReputationVault.ReputationVault__AlreadyHasActiveLoan.selector);
        vault.takeLoan(200 ether);
        vm.stopPrank();
    }

    function test_Loan_CanTakeNewLoan_AfterRepay() public {
        vm.startPrank(amit);
        vault.takeLoan(100 ether);
        vault.repayLoan();
        vault.takeLoan(200 ether); // Should not revert
        assertEq(vault.getActiveLoan(amit), 200 ether);
        vm.stopPrank();
    }

    function test_Loan_RepayWithNoLoan_Reverts() public {
        vm.prank(amit);
        vm.expectRevert(ReputationVault.ReputationVault__NoActiveLoan.selector);
        vault.repayLoan();
    }

    // ─────────────────────────────────────────────────────────────
    //  SCENARIO 7 — SECURITY & ACCESS CONTROL
    // ─────────────────────────────────────────────────────────────

    function test_Engine_UnauthorizedCaller_Reverts() public {
        vm.prank(hacker);
        vm.expectRevert(IReputationEngine.IReputationEngine__NotAuthorized.selector);
        engine.recordAction(hacker, ReputationMath.Action.DaoProposal);
    }

    function test_Token_DirectIssue_Reverts() public {
        vm.prank(hacker);
        vm.expectRevert(IReputationToken.IReputationToken__OnlyEngine.selector);
        token.issue(hacker);
    }

    function test_Token_DirectBurn_Reverts() public {
        vm.prank(amit);
        vault.castVote();

        vm.prank(hacker);
        vm.expectRevert(IReputationToken.IReputationToken__OnlyEngine.selector);
        token.burn(1);
    }

    function test_Vault_MarkDefault_OnlyOwner() public {
        vm.prank(noob);
        vault.takeLoan(100 ether);

        vm.prank(hacker);
        vm.expectRevert();
        vault.markDefault(noob);
    }

    function test_Engine_RevokedCaller_CannotRecord() public {
        // Vault is authorized initially
        vm.prank(amit);
        vault.castVote(); // works

        // Owner revokes vault
        vm.prank(owner);
        engine.setAuthorizedCaller(address(vault), false);

        // Vault now blocked
        skip(13 hours);
        vm.prank(amit);
        vm.expectRevert(IReputationEngine.IReputationEngine__NotAuthorized.selector);
        vault.castVote();
    }

    function test_Engine_ReauthorizedCaller_WorksAgain() public {
        vm.prank(owner);
        engine.setAuthorizedCaller(address(vault), false);

        vm.prank(owner);
        engine.setAuthorizedCaller(address(vault), true);

        vm.prank(amit);
        vault.castVote(); // Should work again
        assertEq(engine.getScore(amit), 10);
    }

    function test_Token_SetEngine_OnlyOnce() public {
        vm.prank(owner);
        vm.expectRevert(IReputationToken.IReputationToken__EngineAlreadySet.selector);
        token.setEngine(address(engine));
    }

    function test_Vault_ZeroAmount_Loan_Reverts() public {
        vm.prank(amit);
        vm.expectRevert(ReputationVault.ReputationVault__ZeroAmount.selector);
        vault.takeLoan(0);
    }

    function test_Vault_ZeroAmount_Airdrop_Reverts() public {
        vm.prank(amit);
        vm.expectRevert(ReputationVault.ReputationVault__ZeroAmount.selector);
        vault.claimAirdrop(0);
    }

    // ─────────────────────────────────────────────────────────────
    //  SCENARIO 8 — MULTIPLE WALLETS INDEPENDENT STATE
    // ─────────────────────────────────────────────────────────────

    function test_MultipleWallets_IndependentScores() public {
        vm.prank(amit);  vault.castVote();      // +10
        vm.prank(priya); vault.submitProposal(); // +25
        vm.prank(noob);  vault.mintNFT();        // +5

        assertEq(engine.getScore(amit),  10);
        assertEq(engine.getScore(priya), 25);
        assertEq(engine.getScore(noob),   5);
    }

    function test_MultipleWallets_IndependentCooldowns() public {
        vm.prank(amit);  vault.castVote();
        skip(6 hours);
        vm.prank(priya); vault.castVote(); 

        skip(7 hours); // 13h from amit's vote, 7h from priya's vote

        // Amit can vote (13h passed > 12h cooldown)
        vm.prank(amit);
        vault.castVote(); // No revert

        // Priya cannot (only 7h passed)
        vm.prank(priya);
        vm.expectRevert();
        vault.castVote();
    }

    function test_MultipleWallets_IndependentLoans() public {
        vm.prank(amit);  vault.takeLoan(100 ether);
        vm.prank(priya); vault.takeLoan(200 ether);

        assertEq(vault.getActiveLoan(amit),  100 ether);
        assertEq(vault.getActiveLoan(priya), 200 ether);

        vm.prank(amit);
        vault.repayLoan();
        assertEq(vault.getActiveLoan(amit),  0);
        assertEq(vault.getActiveLoan(priya), 200 ether); // Priya unaffected
    }

    // ─────────────────────────────────────────────────────────────
    //  SCENARIO 9 — EVENTS
    // ─────────────────────────────────────────────────────────────

    function test_Event_ScoreUpdated_EmittedOnAction() public {
        vm.expectEmit(true, false, false, true);
        emit ScoreUpdated(amit, 0, 10);

        vm.prank(amit);
        vault.castVote();
    }

    function test_Event_ActionRecorded_EmittedOnAction() public {
        vm.expectEmit(true, false, false, true);
        emit ActionRecorded(amit, ReputationMath.Action.DaoVote, 10);

        vm.prank(amit);
        vault.castVote();
    }

    function test_Event_CallerAuthorized_EmittedOnGrant() public {
        address newCaller = makeAddr("newCaller");
        vm.expectEmit(true, false, false, false);
        emit CallerAuthorized(newCaller);

        vm.prank(owner);
        engine.setAuthorizedCaller(newCaller, true);
    }

    function test_Event_CallerRevoked_EmittedOnRevoke() public {
        vm.expectEmit(true, false, false, false);
        emit CallerRevoked(address(vault));

        vm.prank(owner);
        engine.setAuthorizedCaller(address(vault), false);
    }

    // ─────────────────────────────────────────────────────────────
    //  SCENARIO 10 — UUPS UPGRADE
    // ─────────────────────────────────────────────────────────────

    function test_UUPS_HackerCannotUpgrade() public {
        ReputationEngineV2 v2 = new ReputationEngineV2();
        vm.prank(hacker);
        vm.expectRevert();
        engine.upgradeToAndCall(address(v2), "");
    }

    function test_UUPS_OwnerUpgrade_PreservesState() public {
        // Build some state
        vm.prank(amit);
        vault.castVote();
        assertEq(engine.getScore(amit), 10);

        ReputationEngineV2 v2 = new ReputationEngineV2();
        vm.prank(owner);
        engine.upgradeToAndCall(address(v2), "");

        ReputationEngineV2 upgraded = ReputationEngineV2(address(engine));

        // State preserved
        assertEq(upgraded.getScore(amit), 10);
        assertTrue(token.hasSBT(amit));

        // New feature works
        assertEq(upgraded.getV2Feature(), "V2_UPGRADE_SUCCESSFUL");
    }

    function test_UUPS_UpgradedEngine_StillAuthorized() public {
        ReputationEngineV2 v2 = new ReputationEngineV2();
        vm.prank(owner);
        engine.upgradeToAndCall(address(v2), "");

        // Vault should still work after upgrade (same proxy address)
        vm.prank(amit);
        vault.castVote();
        assertEq(engine.getScore(amit), 10);
    }

    // ─────────────────────────────────────────────────────────────
    //  SCENARIO 11 — REENTRANCY GUARD
    // ─────────────────────────────────────────────────────────────

    function test_Reentrancy_BlockedByNonReentrant() public {
        // Deploy malicious token that tries to reenter on issue()
        MaliciousReentrantToken malToken = new MaliciousReentrantToken();
        malToken.setEngine(address(engine));

        // Deploy fresh engine pointing at malicious token
        ReputationEngine freshImpl = new ReputationEngine();
        bytes memory init = abi.encodeCall(
            ReputationEngine.initialize,
            (address(malToken), owner)
        );
        ERC1967Proxy freshProxy = new ERC1967Proxy(address(freshImpl), init);
        ReputationEngine freshEngine = ReputationEngine(address(freshProxy));

        // Authorize hacker directly on fresh engine
        vm.prank(owner);
        freshEngine.setAuthorizedCaller(hacker, true);

        // Call should revert due to nonReentrant blocking the reentrant call
        vm.prank(hacker);
        vm.expectRevert();
        freshEngine.recordAction(hacker, ReputationMath.Action.DaoVote);
    }

    // ─────────────────────────────────────────────────────────────
    //  SCENARIO 12 — ADMIN REVOKE + PUNISH DEFAULTER
    // ─────────────────────────────────────────────────────────────

    function test_Admin_DefaulterPunishment_And_ProtocolRevoke() public {
        vm.prank(noob);
        vault.takeLoan(5000 ether);

        vm.prank(owner);
        vault.markDefault(noob);
        assertEq(engine.getScore(noob), 0);
        assertEq(vault.getActiveLoan(noob), 0);

        // Protocol gets hacked — owner revokes it
        vm.prank(owner);
        engine.setAuthorizedCaller(address(defiProtocol), false);
        assertFalse(engine.isAuthorized(address(defiProtocol)));

        // Hacker tries to use revoked protocol
        vm.prank(hacker);
        vm.expectRevert(IReputationEngine.IReputationEngine__NotAuthorized.selector);
        defiProtocol.userDidAwesomeDeFiThing(hacker);
    }

    // ─────────────────────────────────────────────────────────────
    //  SCENARIO 13 — VIEW FUNCTIONS ACCURACY
    // ─────────────────────────────────────────────────────────────

    function test_View_GetNextVoteTime_ReturnsZeroWhenAvailable() public {
        assertEq(vault.getNextVoteTime(amit), 0); // Never voted

        vm.prank(amit);
        vault.castVote();

        uint256 nextVote = vault.getNextVoteTime(amit);
        assertGt(nextVote, block.timestamp); // In the future

        skip(12 hours + 1);
        assertEq(vault.getNextVoteTime(amit), 0); // Available again
    }

    function test_View_IsAirdropHeld_Accurate() public {
        vm.prank(amit);
        vault.claimAirdrop(100 ether);

        assertFalse(vault.isAirdropHeld(amit)); // Not yet

        skip(30 days);
        assertTrue(vault.isAirdropHeld(amit)); // Now held
    }

    function test_View_GetLastActionAt_UpdatesOnAction() public {
        assertEq(engine.getLastActionAt(amit), 0);

        vm.prank(amit);
        vault.castVote();

        assertEq(engine.getLastActionAt(amit), block.timestamp);

        skip(13 hours);
        vm.prank(amit);
        vault.castVote();

        assertEq(engine.getLastActionAt(amit), block.timestamp);
    }

    function test_View_ActionCount_IncrementsCorrectly() public {
        assertEq(engine.getActionCount(amit), 0);

        vm.prank(amit);
        vault.castVote();
        assertEq(engine.getActionCount(amit), 1);

        vm.prank(amit);
        vault.mintNFT();
        assertEq(engine.getActionCount(amit), 2);

        vm.prank(amit);
        vault.takeLoan(1 ether);
        vm.prank(amit);
        vault.repayLoan();
        assertEq(engine.getActionCount(amit), 3);
    }


}
