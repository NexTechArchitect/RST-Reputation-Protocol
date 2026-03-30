// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ReputationVault} from "../../src/ReputationVault.sol";
import {ReputationMath} from "../../src/libraries/ReputationMath.sol";
import {IReputationEngine} from "../../src/interfaces/IReputationEngine.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @dev Mock Engine to track calls from Vault without heavy UUPS deployment
contract MockEngine is IReputationEngine {
    address public lastWallet;
    ReputationMath.Action public lastAction;
    uint256 public callCount;

    function recordAction(address wallet, ReputationMath.Action action) external {
        lastWallet = wallet;
        lastAction = action;
        callCount++;
    }

    // Dummy returns to satisfy the interface
    function getScore(address) external pure returns (uint256) { return 0; }
    function getTier(address) external pure returns (ReputationMath.Tier) { return ReputationMath.Tier.Unranked; }
    function getTierName(address) external pure returns (string memory) { return ""; }
    function getVotingMultiplier(address) external pure returns (uint256) { return 0; }
    function getLoanLimitBps(address) external pure returns (uint256) { return 0; }
    function getActionCount(address) external pure returns (uint256) { return 0; }
    function getLastActionAt(address) external pure returns (uint256) { return 0; }
    function isAuthorized(address) external pure returns (bool) { return true; }
    function getReputationToken() external pure returns (address) { return address(0); }
    function setAuthorizedCaller(address, bool) external {}
}

contract ReputationVaultTest is Test {
    ReputationVault vault;
    MockEngine engine;

    address owner = makeAddr("owner");
    address amit = makeAddr("amit");
    address hacker = makeAddr("hacker");

    function setUp() public {
        engine = new MockEngine();
        vault = new ReputationVault(address(engine), owner);
        
        // Start time at a reasonable block.timestamp to avoid 0 calculations
        vm.warp(1000 days); 
    }

    /*//////////////////////////////////////////////////////////////
                            SETUP TESTS
    //////////////////////////////////////////////////////////////*/

    function test_ConstructorReverts() public {
        // Test 1: Engine 0 address -> Custom Error
        vm.expectRevert(ReputationVault.ReputationVault__ZeroAddress.selector);
        new ReputationVault(address(0), owner);

        // Test 2: Owner 0 address -> OpenZeppelin Ownable Error
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        new ReputationVault(address(engine), address(0));
    }

    function test_GetEngine() public view {
        assertEq(vault.getEngine(), address(engine));
    }

    /*//////////////////////////////////////////////////////////////
                            DAO ACTIONS
    //////////////////////////////////////////////////////////////*/

    function test_CastVote_SuccessAndCooldown() public {
        vm.startPrank(amit);
        
        assertEq(vault.getNextVoteTime(amit), 0); // No cooldown initially

        vault.castVote();
        assertEq(engine.callCount(), 1);
        assertEq(uint(engine.lastAction()), uint(ReputationMath.Action.DaoVote));

        // Check view function
        uint256 nextVoteTime = vault.getNextVoteTime(amit);
        assertEq(nextVoteTime, block.timestamp + vault.VOTE_COOLDOWN());

        // Attempt immediately again (Should Revert)
        vm.expectRevert(abi.encodeWithSelector(ReputationVault.ReputationVault__CooldownActive.selector, nextVoteTime));
        vault.castVote();

        // Warp time to pass cooldown
        vm.warp(block.timestamp + 12 hours);
        assertEq(vault.getNextVoteTime(amit), 0); // Cooldown should be 0 now

        vault.castVote(); // Should succeed
        assertEq(engine.callCount(), 2);
        
        vm.stopPrank();
    }

    function test_SubmitProposal_SuccessAndCooldown() public {
        vm.startPrank(amit);
        
        assertEq(vault.getNextProposalTime(amit), 0);

        vault.submitProposal();
        assertEq(engine.callCount(), 1);
        assertEq(uint(engine.lastAction()), uint(ReputationMath.Action.DaoProposal));

        vm.expectRevert();
        vault.submitProposal();

        vm.warp(block.timestamp + 24 hours);
        assertEq(vault.getNextProposalTime(amit), 0);
        
        vault.submitProposal();
        
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                            LENDING ACTIONS
    //////////////////////////////////////////////////////////////*/

    function test_TakeAndRepayLoan() public {
        vm.startPrank(amit);
        
        vm.expectRevert(ReputationVault.ReputationVault__ZeroAmount.selector);
        vault.takeLoan(0);

        vault.takeLoan(1000 ether);
        assertEq(vault.getActiveLoan(amit), 1000 ether);

        vm.expectRevert(ReputationVault.ReputationVault__AlreadyHasActiveLoan.selector);
        vault.takeLoan(500 ether);

        vault.repayLoan();
        assertEq(vault.getActiveLoan(amit), 0);
        assertEq(engine.callCount(), 1);
        assertEq(uint(engine.lastAction()), uint(ReputationMath.Action.LoanRepaid));

        vm.expectRevert(ReputationVault.ReputationVault__NoActiveLoan.selector);
        vault.repayLoan();
        
        vm.stopPrank();
    }

    function test_MarkDefault() public {
        vm.prank(amit);
        vault.takeLoan(1000 ether);

        // Not owner test
        vm.prank(hacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, hacker));
        vault.markDefault(amit);

        // Owner zero address check
        vm.prank(owner);
        vm.expectRevert(ReputationVault.ReputationVault__ZeroAddress.selector);
        vault.markDefault(address(0));

        // Owner zero loan check
        vm.prank(owner);
        vm.expectRevert(ReputationVault.ReputationVault__NoActiveLoan.selector);
        vault.markDefault(hacker); // Hacker has no loan

        // Successful default
        vm.prank(owner);
        vault.markDefault(amit);

        assertEq(vault.getActiveLoan(amit), 0);
        assertEq(engine.callCount(), 1);
        assertEq(uint(engine.lastAction()), uint(ReputationMath.Action.LoanDefaulted));
    }

    /*//////////////////////////////////////////////////////////////
                            AIRDROP ACTIONS
    //////////////////////////////////////////////////////////////*/

    function test_Airdrop_DiamondHands_Held() public {
        vm.startPrank(amit);
        
        vault.claimAirdrop(500 ether);
        assertEq(vault.getAirdropAmount(amit), 500 ether);
        assertEq(vault.getAirdropClaimTime(amit), block.timestamp);
        assertFalse(vault.isAirdropHeld(amit));

        vm.expectRevert(ReputationVault.ReputationVault__ZeroAmount.selector);
        vault.claimAirdrop(0);

        vm.expectRevert(ReputationVault.ReputationVault__AirdropAlreadyClaimed.selector);
        vault.claimAirdrop(100 ether);

        // Warp time 30 days into the future
        vm.warp(block.timestamp + 30 days);
        assertTrue(vault.isAirdropHeld(amit)); // Now he held it

        vault.settleAirdrop();
        assertEq(vault.getAirdropAmount(amit), 0);
        assertEq(vault.getAirdropClaimTime(amit), 0);
        assertEq(engine.callCount(), 1);
        assertEq(uint(engine.lastAction()), uint(ReputationMath.Action.AirdropHeld)); // +15
        
        vm.stopPrank();
    }

    function test_Airdrop_PaperHands_Dumped() public {
        vm.startPrank(amit);
        
        assertFalse(vault.isAirdropHeld(amit)); // View should return false if no airdrop

        vault.claimAirdrop(500 ether);
        
        // Settle immediately (Dumped)
        vault.settleAirdrop();
        
        assertEq(vault.getAirdropAmount(amit), 0);
        assertEq(engine.callCount(), 1);
        assertEq(uint(engine.lastAction()), uint(ReputationMath.Action.AirdropDumped)); // -20

        vm.expectRevert(ReputationVault.ReputationVault__NoAirdropToClaim.selector);
        vault.settleAirdrop();
        
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                            NFT ACTIONS
    //////////////////////////////////////////////////////////////*/

    function test_MintNFT_SuccessAndCooldown() public {
        vm.startPrank(amit);
        
        assertEq(vault.getNextNftMintTime(amit), 0);

        vault.mintNFT();
        assertEq(engine.callCount(), 1);
        assertEq(uint(engine.lastAction()), uint(ReputationMath.Action.NftMinted));

        vm.expectRevert();
        vault.mintNFT();

        vm.warp(block.timestamp + 12 hours);
        assertEq(vault.getNextNftMintTime(amit), 0);
        
        vault.mintNFT();
        
        vm.stopPrank();
    }
}