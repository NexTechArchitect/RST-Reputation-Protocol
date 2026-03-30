// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {OwnableUpgradeable} from "openzeppelin-contracts-upgradeable/contracts/access/OwnableUpgradeable.sol";
import {Initializable}      from "openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable}    from "openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import {ReentrancyGuard}    from "openzeppelin-contracts-upgradeable/lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import {IReputationEngine}  from "./interfaces/IReputationEngine.sol";
import {IReputationToken}   from "./interfaces/IReputationToken.sol";
import {ReputationMath}     from "./libraries/ReputationMath.sol";

/// @title  ReputationEngine
/// @author NexTechArchitect
/// @notice UUPS-upgradeable scoring engine — records on-chain actions,
///         updates wallet reputation scores, and auto-issues Soulbound Tokens.
contract ReputationEngine is
    Initializable,
    OwnableUpgradeable,
    ReentrancyGuard,
    UUPSUpgradeable,
    IReputationEngine
{
    /*//////////////////////////////////////////////////////////////
                            STORAGE
    //////////////////////////////////////////////////////////////*/

    IReputationToken private s_token;

    mapping(address => uint256) private s_scores;
    mapping(address => uint256) private s_actionCount;
    mapping(address => uint256) private s_lastActionAt;
    mapping(address => bool)    private s_authorized;

    /// @dev Append new variables BEFORE this gap. Reduce gap size accordingly.
    uint256[45] private __gap;

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /*//////////////////////////////////////////////////////////////
                            INITIALIZER
    //////////////////////////////////////////////////////////////*/

    /// @notice One-time initialiser — replaces constructor for UUPS proxy.
    function initialize(address token, address initialOwner) external initializer {
        if (token        == address(0)) revert IReputationEngine__ZeroAddress();
        if (initialOwner == address(0)) revert IReputationEngine__ZeroAddress();

        __Ownable_init(initialOwner);

        s_token = IReputationToken(token);
    }

    /*//////////////////////////////////////////////////////////////
                            ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IReputationEngine
    function recordAction(
        address wallet,
        ReputationMath.Action action
    ) external nonReentrant {
        if (!s_authorized[msg.sender] && msg.sender != owner())
            revert IReputationEngine__NotAuthorized();
        if (wallet == address(0)) revert IReputationEngine__ZeroAddress();

        uint256 oldScore = s_scores[wallet];
        uint256 newScore = ReputationMath.applyAction(oldScore, action);
        int256  delta    = ReputationMath.deltaFor(action);

        s_scores[wallet]       = newScore;
        unchecked { s_actionCount[wallet]++; }
        s_lastActionAt[wallet] = block.timestamp;

        if (!s_token.hasSBT(wallet)) s_token.issue(wallet);

        emit ActionRecorded(wallet, action, delta);
        emit ScoreUpdated(wallet, oldScore, newScore);
    }

    /// @inheritdoc IReputationEngine
    function setAuthorizedCaller(address caller, bool authorized) external onlyOwner {
        if (authorized && caller == address(0)) revert IReputationEngine__ZeroAddress();
        if (s_authorized[caller] == authorized) return;

        s_authorized[caller] = authorized;

        if (authorized) emit CallerAuthorized(caller);
        else            emit CallerRevoked(caller);
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IReputationEngine
    function getScore(address wallet) external view returns (uint256) {
        return s_scores[wallet];
    }

    /// @inheritdoc IReputationEngine
    function getTier(address wallet) external view returns (ReputationMath.Tier) {
        return ReputationMath.resolveTier(s_scores[wallet]);
    }

    /// @inheritdoc IReputationEngine
    function getTierName(address wallet) external view returns (string memory) {
        return ReputationMath.tierName(s_scores[wallet]);
    }

    /// @inheritdoc IReputationEngine
    function getVotingMultiplier(address wallet) external view returns (uint256) {
        return ReputationMath.votingMultiplier(s_scores[wallet]);
    }

    /// @inheritdoc IReputationEngine
    function getLoanLimitBps(address wallet) external view returns (uint256) {
        return ReputationMath.loanLimitBps(s_scores[wallet]);
    }

    /// @inheritdoc IReputationEngine
    function getActionCount(address wallet) external view returns (uint256) {
        return s_actionCount[wallet];
    }

    /// @inheritdoc IReputationEngine
    function getLastActionAt(address wallet) external view returns (uint256 timestamp) {
        return s_lastActionAt[wallet];
    }

    /// @inheritdoc IReputationEngine
    function isAuthorized(address caller) external view returns (bool) {
        return s_authorized[caller];
    }

    /// @inheritdoc IReputationEngine
    function getReputationToken() external view returns (address) {
        return address(s_token);
    }

    /*//////////////////////////////////////////////////////////////
                            UUPS
    //////////////////////////////////////////////////////////////*/

    /// @dev Owner-only. Use multisig or TimelockController in production.
    function _authorizeUpgrade(address) internal override onlyOwner {}
}
