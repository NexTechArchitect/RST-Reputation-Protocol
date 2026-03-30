// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title  IReputationToken
/// @author NexTechArchitect
/// @notice Interface for the ERC-5484 Soulbound Reputation Token.
///
/// @dev    ERC-5484 COMPLIANCE NOTES
///         ─────────────────────────
///         ERC-5484 requires:
///           1. `Issued` event on every mint — including burnAuth parameter.
///           2. `burnAuth()` view returning who may burn each token.
///           3. Transfer functions MUST revert — tokens are soul-bound.
///         ERC-165 interface ID for ERC-5484: 0x0489b56f
///         Implementations MUST override supportsInterface() to register it.
///
///         SECURITY INVARIANTS (enforced by implementation)
///         ─────────────────────────────────────────────────
///         • One token per wallet — `issue()` must revert if wallet already has one.
///         • Only the authorised engine may call `issue()` and `burn()`.
///         • `transferFrom` and `safeTransferFrom` must always revert.
///         • `burn()` must clear the wallet→tokenId mapping before _burn (CEI).
///         • `setEngine()` is one-time only — reverts if engine already set.

interface IReputationToken {
    /*//////////////////////////////////////////////////////////////
                                ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @dev Reverts when a wallet already has a soulbound token.
    error IReputationToken__AlreadyHasSBT(address wallet);

    /// @dev Reverts on any transfer attempt — tokens are non-transferable.
    error IReputationToken__SoulboundNonTransferable();

    /// @dev Reverts when msg.sender is not the authorised engine.
    error IReputationToken__OnlyEngine();

    /// @dev Reverts when a tokenId does not exist or has been burned.
    error IReputationToken__TokenDoesNotExist(uint256 tokenId);

    /// @dev Reverts when address(0) is passed where a real address is required.
    ///      [FIX-C1] Was only in the implementation — now surfaced in interface
    ///      so callers can catch it by selector without importing the concrete type.
    error IReputationToken__ZeroAddress();

    /// @dev Reverts when setEngine() is called after engine is already set.
    ///      Engine is one-time only — immutable after first set.
    ///      [FIX-C1] Same rationale as ZeroAddress above.
    error IReputationToken__EngineAlreadySet();

    /*//////////////////////////////////////////////////////////////
                                ENUMS
    //////////////////////////////////////////////////////////////*/

    /// @notice Defines who is authorised to burn a given token.
    /// @dev    Defined by ERC-5484. This implementation uses IssuerOnly.
    enum BurnAuth {
        IssuerOnly, // only the issuing contract (engine) can burn
        OwnerOnly, // only the token holder can burn
        Both, // either party can burn
        Neither // token is permanent — no one can burn
    }

    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/

    /// @notice REQUIRED by ERC-5484 — emitted on every mint.
    /// @dev    EIP-5484 specifies the exact signature including _burnAuth.
    ///         Parameter names are underscore-prefixed to match canonical ABI —
    ///         do not rename them.
    /// @param  _from      Address that issued the token (the engine contract).
    /// @param  _to        Recipient wallet. Must not be address(0).
    /// @param  _tokenId   The newly minted token ID.
    /// @param  _burnAuth  Burn authorisation rule assigned to this token.
    event Issued(
        address indexed _from,
        address indexed _to,
        uint256 indexed _tokenId,
        BurnAuth _burnAuth
    );

    /// @notice Emitted when a soulbound token is burned.
    /// @dev    Implementation MUST emit this inside burn() before returning.
    ///         Required for off-chain indexers to track revocations.
    /// @param  _from    Address that initiated the burn (the engine contract).
    /// @param  _owner   Wallet that held the token before it was burned.
    /// @param  _tokenId The burned token ID.
    event Burned(address indexed _from, address indexed _owner, uint256 indexed _tokenId);

    /// @notice Emitted once when the engine address is set for the first time.
    /// @dev    [FIX-M2] Was emitted by impl but not declared in interface —
    ///         indexers using interface ABI were blind to it. Now declared.
    /// @param  engine  The engine address that was set.
    event EngineSet(address indexed engine);

    /*//////////////////////////////////////////////////////////////
                           WRITE FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Set the authorised engine address — ONE TIME ONLY.
    /// @param  engine  Engine address. Must not be address(0).
    function setEngine(address engine) external;

    /// @notice Mint a soulbound token to `to`.
    /// @dev    CALLER RESTRICTION: only the authorised engine.
    ///         INVARIANT: one token per wallet — reverts with AlreadyHasSBT
    ///         if `to` already holds a token.
    ///         Must emit `Issued` with burnAuth parameter before returning.
    ///         CEI: effects (mappings, counters) before _mint interaction.
    /// @param  to  Recipient wallet. Must not be address(0).
    /// @return tokenId  The newly minted token ID (starts at 1; 0 is sentinel).
    function issue(address to) external returns (uint256 tokenId);

    /// @notice Burn a soulbound token.
    /// @dev    CALLER RESTRICTION: only the authorised engine (IssuerOnly).
    ///         CEI: clear wallet→tokenId mapping and decrement supply BEFORE _burn.
    ///         Must emit `Burned` before returning.
    /// @param  tokenId  Token to burn. Must exist and not already be burned.
    function burn(uint256 tokenId) external;

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns who is authorised to burn `tokenId`.
    /// @dev    REQUIRED by ERC-5484.
    ///         Reverts with TokenDoesNotExist if tokenId does not exist or burned.
    function burnAuth(uint256 tokenId) external view returns (BurnAuth);

    /// @notice Returns the tokenId bound to `wallet`, or 0 if none.
    /// @dev    Token IDs start at 1 — 0 is a safe sentinel for "no token".
    function tokenOf(address wallet) external view returns (uint256);

    /// @notice Returns true if `wallet` currently holds a live soulbound token.
    /// @dev    Implementations MUST derive this from the same storage slot as
    ///         tokenOf() — never a separate boolean mapping — to prevent desync
    ///         on burn. Equivalent to: tokenOf(wallet) != 0.
    function hasSBT(address wallet) external view returns (bool);

    /// @notice Returns the current total supply of live (non-burned) tokens.
    function totalSupply() external view returns (uint256);

    /// @notice Returns the address of the authorised engine.
    function getEngine() external view returns (address);
}
