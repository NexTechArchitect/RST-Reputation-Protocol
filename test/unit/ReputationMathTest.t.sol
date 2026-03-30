// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {ReputationMath} from "../../src/libraries/ReputationMath.sol";

/// @dev Wrapper contract to test reverts on internal library functions.
/// Foundry's vm.expectRevert needs an external call to catch the revert.
contract MathWrapper {
    function resolveTier(uint256 score) external pure returns (ReputationMath.Tier) {
        return ReputationMath.resolveTier(score);
    }
    function tierName(uint256 score) external pure returns (string memory) {
        return ReputationMath.tierName(score);
    }
    function votingMultiplier(uint256 score) external pure returns (uint256) {
        return ReputationMath.votingMultiplier(score);
    }
    function loanLimitBps(uint256 score) external pure returns (uint256) {
        return ReputationMath.loanLimitBps(score);
    }
    function applyAction(uint256 score, ReputationMath.Action action) external pure returns (uint256) {
        return ReputationMath.applyAction(score, action);
    }
}

contract ReputationMathTest is Test {
    MathWrapper wrapper;

    function setUp() public {
        wrapper = new MathWrapper();
    }
    
    /*//////////////////////////////////////////////////////////////
                            SCORE CLAMPING
    //////////////////////////////////////////////////////////////*/

    function test_ApplyAction_Normal() public pure {
        assertEq(ReputationMath.applyAction(500, ReputationMath.Action.DaoVote), 510);
        assertEq(ReputationMath.applyAction(500, ReputationMath.Action.LoanDefaulted), 450);
    }

    function test_ApplyAction_Clamps() public pure {
        // Lower clamp
        assertEq(ReputationMath.applyAction(20, ReputationMath.Action.LoanDefaulted), 0);
        // Upper clamp
        assertEq(ReputationMath.applyAction(990, ReputationMath.Action.LoanRepaid), 1000);
    }

    /*//////////////////////////////////////////////////////////////
                            TIER RESOLUTION
    //////////////////////////////////////////////////////////////*/

    function test_ResolveTier_And_TierName() public pure {
        // Unranked
        assertEq(uint(ReputationMath.resolveTier(0)), uint(ReputationMath.Tier.Unranked));
        assertEq(uint(ReputationMath.resolveTier(99)), uint(ReputationMath.Tier.Unranked));
        assertEq(ReputationMath.tierName(50), "Unranked");

        // Bronze
        assertEq(uint(ReputationMath.resolveTier(100)), uint(ReputationMath.Tier.Bronze));
        assertEq(uint(ReputationMath.resolveTier(299)), uint(ReputationMath.Tier.Bronze));
        assertEq(ReputationMath.tierName(150), "Bronze");

        // Silver
        assertEq(uint(ReputationMath.resolveTier(300)), uint(ReputationMath.Tier.Silver));
        assertEq(uint(ReputationMath.resolveTier(599)), uint(ReputationMath.Tier.Silver));
        assertEq(ReputationMath.tierName(450), "Silver");

        // Gold
        assertEq(uint(ReputationMath.resolveTier(600)), uint(ReputationMath.Tier.Gold));
        assertEq(uint(ReputationMath.resolveTier(849)), uint(ReputationMath.Tier.Gold));
        assertEq(ReputationMath.tierName(700), "Gold");

        // Platinum
        assertEq(uint(ReputationMath.resolveTier(850)), uint(ReputationMath.Tier.Platinum));
        assertEq(uint(ReputationMath.resolveTier(1000)), uint(ReputationMath.Tier.Platinum));
        assertEq(ReputationMath.tierName(950), "Platinum");
    }

    /*//////////////////////////////////////////////////////////////
                            DERIVED METRICS
    //////////////////////////////////////////////////////////////*/

    function test_VotingMultiplier() public pure {
        assertEq(ReputationMath.votingMultiplier(0), 5_000);
        assertEq(ReputationMath.votingMultiplier(100), 10_000);
        assertEq(ReputationMath.votingMultiplier(300), 15_000);
        assertEq(ReputationMath.votingMultiplier(600), 20_000);
        assertEq(ReputationMath.votingMultiplier(850), 30_000);
    }

    function test_LoanLimitBps() public pure {
        assertEq(ReputationMath.loanLimitBps(0), 0);
        assertEq(ReputationMath.loanLimitBps(100), 2_000);
        assertEq(ReputationMath.loanLimitBps(300), 4_000);
        assertEq(ReputationMath.loanLimitBps(600), 6_000);
        assertEq(ReputationMath.loanLimitBps(850), 8_000);
    }

    /*//////////////////////////////////////////////////////////////
                            ERROR CASES
    //////////////////////////////////////////////////////////////*/

    function test_RevertOn_ScoreOutOfBounds() public {
        uint256 badScore = 1001;

        // Ab hum library ko direct nahi, balki Wrapper ke through call karenge
        vm.expectRevert(abi.encodeWithSelector(ReputationMath.ReputationMath__ScoreOutOfBounds.selector, badScore));
        wrapper.resolveTier(badScore);
        
        vm.expectRevert(abi.encodeWithSelector(ReputationMath.ReputationMath__ScoreOutOfBounds.selector, badScore));
        wrapper.tierName(badScore);

        vm.expectRevert(abi.encodeWithSelector(ReputationMath.ReputationMath__ScoreOutOfBounds.selector, badScore));
        wrapper.votingMultiplier(badScore);

        vm.expectRevert(abi.encodeWithSelector(ReputationMath.ReputationMath__ScoreOutOfBounds.selector, badScore));
        wrapper.loanLimitBps(badScore);

        vm.expectRevert(abi.encodeWithSelector(ReputationMath.ReputationMath__ScoreOutOfBounds.selector, badScore));
        wrapper.applyAction(badScore, ReputationMath.Action.DaoVote);
    }
}