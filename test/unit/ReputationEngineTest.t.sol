// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {ReputationEngine} from "../../src/ReputationEngine.sol";
import {ReputationMath} from "../../src/libraries/ReputationMath.sol";
import {IReputationToken} from "../../src/interfaces/IReputationToken.sol";
import {ERC1967Proxy} from "openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {OwnableUpgradeable} from "openzeppelin-contracts-upgradeable/contracts/access/OwnableUpgradeable.sol";
import {Initializable} from "openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";
import {IReputationEngine} from "../../src/interfaces/IReputationEngine.sol";

/// @dev Mock Token to track SBT issuance without full Token logic
contract MockRepToken is IReputationToken {
    mapping(address => bool) public hasSBTMap;
    uint256 public issueCount;

    function hasSBT(address wallet) external view returns (bool) {
        return hasSBTMap[wallet];
    }

    function issue(address to) external returns (uint256) {
        hasSBTMap[to] = true;
        issueCount++;
        return issueCount;
    }

    // Dummy returns to satisfy the interface
    function setEngine(address) external {}
    function burn(uint256) external {}
    function burnAuth(uint256) external pure returns (BurnAuth) { return BurnAuth.IssuerOnly; }
    function tokenOf(address) external pure returns (uint256) { return 0; }
    function totalSupply() external pure returns (uint256) { return 0; }
    function getEngine() external pure returns (address) { return address(0); }
}

contract ReputationEngineTest is Test {
    ReputationEngine engineImplementation;
    ReputationEngine engine;
    MockRepToken token;

    address owner = makeAddr("owner");
    address authCaller = makeAddr("authCaller");
    address amit = makeAddr("amit");
    address hacker = makeAddr("hacker");

    event CallerAuthorized(address indexed caller);
    event CallerRevoked(address indexed caller);
    event ActionRecorded(address indexed wallet, ReputationMath.Action action, int256 delta);
    event ScoreUpdated(address indexed wallet, uint256 oldScore, uint256 newScore);

    function setUp() public {
        token = new MockRepToken();
        
        // 1. Deploy Implementation
        engineImplementation = new ReputationEngine();

        // 2. Deploy Proxy and Initialize
        bytes memory initData = abi.encodeCall(ReputationEngine.initialize, (address(token), owner));
        ERC1967Proxy proxy = new ERC1967Proxy(address(engineImplementation), initData);

        // 3. Wrap proxy in Engine interface
        engine = ReputationEngine(address(proxy));
    }

    /*//////////////////////////////////////////////////////////////
                            SETUP & INIT TESTS
    //////////////////////////////////////////////////////////////*/

    function test_ImplementationIsLocked() public {
        vm.expectRevert(Initializable.InvalidInitialization.selector);
        engineImplementation.initialize(address(token), owner);
    }

    function test_InitializeRevertsOnZeroAddresses() public {
        ReputationEngine newImpl = new ReputationEngine();
        
        vm.expectRevert(IReputationEngine.IReputationEngine__ZeroAddress.selector);
        new ERC1967Proxy(
            address(newImpl), 
            abi.encodeCall(ReputationEngine.initialize, (address(0), owner))
        );

        vm.expectRevert(IReputationEngine.IReputationEngine__ZeroAddress.selector);
        new ERC1967Proxy(
            address(newImpl), 
            abi.encodeCall(ReputationEngine.initialize, (address(token), address(0)))
        );
    }

    /*//////////////////////////////////////////////////////////////
                            AUTHORIZATION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_SetAuthorizedCaller() public {
        vm.startPrank(owner);

        // Cannot authorize address(0)
        vm.expectRevert(IReputationEngine.IReputationEngine__ZeroAddress.selector);
        engine.setAuthorizedCaller(address(0), true);

        // Expect Event
        vm.expectEmit(true, true, true, true);
        emit CallerAuthorized(authCaller);
        engine.setAuthorizedCaller(authCaller, true);
        assertTrue(engine.isAuthorized(authCaller));

        // Setting same value should return early (no event)
        engine.setAuthorizedCaller(authCaller, true);

        // Revoke
        vm.expectEmit(true, true, true, true);
        emit CallerRevoked(authCaller);
        engine.setAuthorizedCaller(authCaller, false);
        assertFalse(engine.isAuthorized(authCaller));

        vm.stopPrank();
    }

    function test_SetAuthorizedCaller_RevertsNonOwner() public {
        vm.prank(hacker);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, hacker));
        engine.setAuthorizedCaller(authCaller, true);
    }

    /*//////////////////////////////////////////////////////////////
                            RECORD ACTION TESTS
    //////////////////////////////////////////////////////////////*/

    function test_RecordAction_RevertsNonAuthorized() public {
        vm.prank(hacker);
        vm.expectRevert(IReputationEngine.IReputationEngine__NotAuthorized.selector);
        engine.recordAction(amit, ReputationMath.Action.DaoVote);
    }

    function test_RecordAction_RevertsZeroAddress() public {
        vm.prank(owner); // Owner is naturally authorized
        vm.expectRevert(IReputationEngine.IReputationEngine__ZeroAddress.selector);
        engine.recordAction(address(0), ReputationMath.Action.DaoVote);
    }

    function test_RecordAction_IssuesTokenOnFirstAction() public {
        vm.startPrank(owner);

        assertFalse(token.hasSBT(amit));
        assertEq(token.issueCount(), 0);

        engine.recordAction(amit, ReputationMath.Action.DaoVote); // +10

        assertTrue(token.hasSBT(amit));
        assertEq(token.issueCount(), 1);
        assertEq(engine.getScore(amit), 10);
        assertEq(engine.getActionCount(amit), 1);
        assertEq(engine.getLastActionAt(amit), block.timestamp);

        // Second action should NOT issue another token
        engine.recordAction(amit, ReputationMath.Action.DaoVote); // +10
        assertEq(token.issueCount(), 1); // Remains 1
        assertEq(engine.getScore(amit), 20);

        vm.stopPrank();
    }

    function test_RecordAction_EventsAndMath() public {
        vm.prank(owner);
        engine.setAuthorizedCaller(authCaller, true);

        vm.startPrank(authCaller);

        vm.expectEmit(true, true, true, true);
        emit ActionRecorded(amit, ReputationMath.Action.DaoProposal, 25);
        vm.expectEmit(true, true, true, true);
        emit ScoreUpdated(amit, 0, 25);
        
        engine.recordAction(amit, ReputationMath.Action.DaoProposal); // +25

        assertEq(engine.getScore(amit), 25);

        // Test Negative Action
        engine.recordAction(amit, ReputationMath.Action.LoanDefaulted); // -50
        assertEq(engine.getScore(amit), 0); // Should clamp at 0

        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW & UUPS TESTS
    //////////////////////////////////////////////////////////////*/

    function test_ViewFunctions() public {
        vm.startPrank(owner);
        
        // Push score to Silver (300+)
        for(uint i=0; i<10; i++) {
            engine.recordAction(amit, ReputationMath.Action.LoanRepaid); // 30 * 10 = 300
        }

        assertEq(engine.getScore(amit), 300);
        assertEq(uint(engine.getTier(amit)), uint(ReputationMath.Tier.Silver));
        assertEq(engine.getTierName(amit), "Silver");
        assertEq(engine.getVotingMultiplier(amit), 15_000);
        assertEq(engine.getLoanLimitBps(amit), 4_000);
        assertEq(engine.getReputationToken(), address(token));
        
        vm.stopPrank();
    }

    function test_AuthorizeUpgrade() public {
        ReputationEngine newEngineImpl = new ReputationEngine();

        // Non-owner should fail to upgrade
        vm.prank(hacker);
        vm.expectRevert(abi.encodeWithSelector(OwnableUpgradeable.OwnableUnauthorizedAccount.selector, hacker));
        engine.upgradeToAndCall(address(newEngineImpl), "");

        // Owner should succeed
        vm.prank(owner);
        engine.upgradeToAndCall(address(newEngineImpl), "");
    }
}