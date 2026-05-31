// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC721}  from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IReputationToken}  from "./interfaces/IReputationToken.sol";
import {IReputationEngine} from "./interfaces/IReputationEngine.sol";
import {ReputationSVG}    from "./libraries/ReputationSVG.sol";
import {ReputationMath}   from "./libraries/ReputationMath.sol";

/// @title  ReputationToken
/// @author NexTechArchitect
/// @notice ERC-5484 Soulbound Reputation Token — immutable, one per wallet.
///
///         ARCHITECTURE
///         ─────────────
///         • Standard OZ ERC721 + Ownable (non-upgradeable).
///         • ERC-5484 compliant: Issued event with BurnAuth, burnAuth() view,
///           transfer lock via _update() override, ERC-165 registration.
///         • Transfer lock via _update() override — exhaustively covers all
///           current and future OZ transfer paths in a single function.
///         • _mint (not _safeMint): onERC721Received callback is meaningless for
///           soulbound tokens and would introduce an unnecessary reentrancy vector.
///         • s_tokenCounter starts at 1 — 0 is the "no token" sentinel.
///         • s_engine is write-once (set once via setEngine, then locked) — engine
///           address becomes permanently immutable after deployment setup.

contract ReputationToken is ERC721, Ownable, IReputationToken {

    /*//////////////////////////////////////////////////////////////
                        ERC-5484 INTERFACE ID
    //////////////////////////////////////////////////////////////*/

    /// @dev ERC-165 interface ID for ERC-5484.
    ///      Computed as: XOR of selector of burnAuth(uint256).
    ///      Value: 0x0489b56f
    ///      Reference: https://eips.ethereum.org/EIPS/eip-5484
    bytes4 private constant _INTERFACE_ID_ERC5484 = 0x0489b56f;

    /*//////////////////////////////////////////////////////////////
                            STATE
    //////////////////////////////////////////////////////////////*/

    /// @dev Next tokenId to mint. Starts at 1 — 0 is the "no token" sentinel.
    ///      Never decrements — burned tokens leave gaps, IDs never reused.
    uint256 private s_tokenCounter;

    /// @dev Live (non-burned) token count.
    uint256 private s_totalSupply;

    /// @dev Authorised engine — only address that may call issue() and burn().
    ///      Write-once: set once via setEngine(), then permanently locked.
    address private s_engine;

    /// @dev wallet → tokenId mapping. 0 means wallet holds no token.
    mapping(address => uint256) private s_walletToToken;

    /*//////////////////////////////////////////////////////////////
                            MODIFIERS
    //////////////////////////////////////////////////////////////*/

    /// @dev Reverts if caller is not the authorised engine.
    ///      Also guards against calls before setEngine() because
    ///      address(0) can never equal msg.sender in practice.
    modifier onlyEngine() {
        if (msg.sender != s_engine) revert IReputationToken__OnlyEngine();
        _;
    }

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    /// @param initialOwner  Address that receives Ownable ownership.
    ///        revert is fully visible to callers who only import IReputationToken.
    constructor(address initialOwner)
        ERC721("Reputation Soulbound Token", "RST")
        Ownable(initialOwner)
    {
        if (initialOwner == address(0)) revert IReputationToken__ZeroAddress();
        // Reserve tokenId 0 as the "no token" sentinel.
        s_tokenCounter = 1;
    }

    /*//////////////////////////////////////////////////////////////
                        ERC-165 OVERRIDE  [FIX-L2]
    //////////////////////////////////////////////////////////////*/

    /// @notice Declares support for ERC721, ERC721Metadata, ERC165, and ERC-5484.
    ///         ERC-5484 (0x0489b56f) was NOT registered — any contract that calls
    ///         IERC165(token).supportsInterface(0x0489b56f) would get `false`,
    ///         silently breaking ERC-5484-aware composability.
    ///         This override fixes that by registering the ERC-5484 interface ID
    ///         in addition to all IDs already handled by the ERC721 base.
    function supportsInterface(
        bytes4 interfaceId
    ) public view virtual override(ERC721) returns (bool) {
        return
            interfaceId == _INTERFACE_ID_ERC5484 ||
            super.supportsInterface(interfaceId);
    }

    /*//////////////////////////////////////////////////////////////
                            ADMIN
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IReputationToken
    function setEngine(address engine) external onlyOwner {
  
        if (engine == address(0))    revert IReputationToken__ZeroAddress();
        if (s_engine != address(0))  revert IReputationToken__EngineAlreadySet();

        s_engine = engine;

        emit EngineSet(engine);
    }

    /*//////////////////////////////////////////////////////////////
                        WRITE — engine-only
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IReputationToken
    function issue(address to) external onlyEngine returns (uint256 tokenId) {

        if (to == address(0))         revert IReputationToken__ZeroAddress();
        if (s_walletToToken[to] != 0) revert IReputationToken__AlreadyHasSBT(to);

        tokenId = s_tokenCounter;

        unchecked { s_tokenCounter++; }
        unchecked { s_totalSupply++; }

        s_walletToToken[to] = tokenId;

        _mint(to, tokenId);

        emit Issued(msg.sender, to, tokenId, BurnAuth.IssuerOnly);
    }

    /// @inheritdoc IReputationToken
    ///
    ///         Clearing s_walletToToken BEFORE _burn is critical:
    ///         if _burn somehow triggered a reentrant call (e.g. via a future
    ///         OZ hook), the mapping would already reflect the burned state.
    function burn(uint256 tokenId) external onlyEngine {
      address owner = _ownerOf(tokenId);
        if (owner == address(0)) revert IReputationToken__TokenDoesNotExist(tokenId);

        delete s_walletToToken[owner];

        unchecked { s_totalSupply--; }
        
        _burn(tokenId);

         emit Burned(msg.sender, owner, tokenId);
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IReputationToken
    function burnAuth(uint256 tokenId) external view returns (BurnAuth) {
        if (_ownerOf(tokenId) == address(0))
            revert IReputationToken__TokenDoesNotExist(tokenId);
        // Every token in this contract uses IssuerOnly — no per-token variation.
        return BurnAuth.IssuerOnly;
    }

    /// @inheritdoc IReputationToken
    function tokenOf(address wallet) external view returns (uint256) {
        return s_walletToToken[wallet];
    }

    /// @inheritdoc IReputationToken
    function hasSBT(address wallet) external view returns (bool) {
        return s_walletToToken[wallet] != 0;
    }

    /// @inheritdoc IReputationToken
    function totalSupply() external view returns (uint256) {
        return s_totalSupply;
    }

    /// @inheritdoc IReputationToken
    function getEngine() external view returns (address) {
        return s_engine;
    }

    /*//////////////////////////////////////////////////////////////
                        TOKEN URI — ON-CHAIN SVG
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns the on-chain metadata URI for a given tokenId.
    /// @dev    Calls the engine to fetch the wallet's current tier and score,
    ///         then delegates to ReputationSVG to build the full data URI.
    /// @param  tokenId  Must exist. Reverts with TokenDoesNotExist otherwise.
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        address owner = _ownerOf(tokenId);
        if (owner == address(0)) revert IReputationToken__TokenDoesNotExist(tokenId);

        if (s_engine == address(0)) {
            return ReputationSVG.buildTokenURI(
                ReputationMath.Tier.Unranked,
                tokenId,
                0
            );
        }

        IReputationEngine engine = IReputationEngine(s_engine);
        ReputationMath.Tier tier = engine.getTier(owner);
        uint256 score            = engine.getScore(owner);

        return ReputationSVG.buildTokenURI(tier, tokenId, score);
    }

    /*//////////////////////////////////////////////////////////////
                    SOULBOUND — TRANSFER LOCK
    //////////////////////////////////////////////////////////////*/

    /// @dev Override the lowest-level ERC721 state-transition hook.

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);

        if (from != address(0) && to != address(0)) {
            revert IReputationToken__SoulboundNonTransferable();
        }

        return super._update(to, tokenId, auth);
    }
}
