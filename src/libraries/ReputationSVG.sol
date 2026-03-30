// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ReputationMath} from "./ReputationMath.sol";

/// @title  ReputationSVG
/// @author NexTechArchitect
/// @notice Pure library — generates fully on-chain SVG medal art and ERC-721
///         JSON metadata for each Reputation tier.
///
/// @dev    ARCHITECTURE
///         ─────────────
///         • Zero state, zero external calls — pure functions only.
///         • One SVG per tier, each distinct in colour + iconography.
///         • buildTokenURI() is the sole public entry point: takes a tier +
///           tokenId, returns a complete data:application/json;base64,... URI
///           that wallets (MetaMask, OpenSea) can render directly.
///         • All SVG strings are built with string concatenation — no assembly,
///           no external renderer, no IPFS dependency. Token lives as long as
///           Ethereum exists.
///
///         TIER → MEDAL DESIGN MAPPING
///         ─────────────────────────────
///         Unranked  → grey hexagon  + "?" glyph
///         Bronze    → copper circle + 6-point star
///         Silver    → silver circle + 5-point star
///         Gold      → gold circle   + crown
///         Platinum  → platinum ring + gem diamond

library ReputationSVG {
    using Strings for uint256;

    /*//////////////////////////////////////////////////////////////
                            ERRORS
    //////////////////////////////////////////////////////////////*/

    /// @dev Should never be reached — every Tier variant is handled.
    error ReputationSVG__UnknownTier();

    /*//////////////////////////////////////////////////////////////
                        PRIMARY ENTRY POINT
    //////////////////////////////////////////////////////////////*/

    /// @notice Build a complete ERC-721 tokenURI for a given tier and tokenId.
    /// @dev    Returns a data:application/json;base64,... string.
    ///         Wallets call tokenURI(tokenId) → this string → render image inline.
    /// @param  tier     Tier enum from ReputationMath.
    /// @param  tokenId  Token ID — embedded in the JSON name field.
    /// @param  score    Current reputation score — shown in JSON attributes.
    /// @return          Fully encoded data URI ready for ERC-721 tokenURI().
    function buildTokenURI(
        ReputationMath.Tier tier,
        uint256 tokenId,
        uint256 score
    ) internal pure returns (string memory) {
        string memory tierLabel = _tierLabel(tier);
        string memory svg      = _buildSVG(tier, tierLabel);
        string memory imgURI   = string(abi.encodePacked(
            "data:image/svg+xml;base64,",
            Base64.encode(bytes(svg))
        ));

        string memory json = string(abi.encodePacked(
            '{"name":"Reputation SBT #', tokenId.toString(), ' - ', tierLabel, '",',
            '"description":"On-chain Soulbound Reputation Token. Non-transferable. Tier reflects wallet behaviour score.",',
            '"image":"', imgURI, '",',
            '"attributes":[',
                '{"trait_type":"Tier","value":"',       tierLabel,            '"},',
                '{"trait_type":"Score","value":',       score.toString(),     '},',
                '{"trait_type":"Transferable","value":"No"},',
                '{"trait_type":"Standard","value":"ERC-5484"}',
            ']}'
        ));

        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(json))
        ));
    }

    /*//////////////////////////////////////////////////////////////
                        SVG BUILDER
    //////////////////////////////////////////////////////////////*/

    /// @dev Dispatches to the correct per-tier SVG builder.
    function _buildSVG(
        ReputationMath.Tier tier,
        string memory label
    ) private pure returns (string memory) {
        if (tier == ReputationMath.Tier.Unranked)  return _svgUnranked(label);
        if (tier == ReputationMath.Tier.Bronze)    return _svgBronze(label);
        if (tier == ReputationMath.Tier.Silver)    return _svgSilver(label);
        if (tier == ReputationMath.Tier.Gold)      return _svgGold(label);
        if (tier == ReputationMath.Tier.Platinum)  return _svgPlatinum(label);
        revert ReputationSVG__UnknownTier();
    }

    /*//////////////////////////////////////////////////////////////
                        TIER LABEL
    //////////////////////////////////////////////////////////////*/

    function _tierLabel(ReputationMath.Tier tier) private pure returns (string memory) {
        if (tier == ReputationMath.Tier.Platinum) return "Platinum";
        if (tier == ReputationMath.Tier.Gold)     return "Gold";
        if (tier == ReputationMath.Tier.Silver)   return "Silver";
        if (tier == ReputationMath.Tier.Bronze)   return "Bronze";
        return "Unranked";
    }

    /*//////////////////////////////////////////////////////////////
                        SVG — UNRANKED
                        Grey hexagon + "?" glyph
    //////////////////////////////////////////////////////////////*/

    function _svgUnranked(string memory label) private pure returns (string memory) {
        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">',
            '<defs>',
                '<radialGradient id="u-bg" cx="50%" cy="50%" r="50%">',
                    '<stop offset="0%" stop-color="#2a2a2a"/>',
                    '<stop offset="100%" stop-color="#111111"/>',
                '</radialGradient>',
                '<radialGradient id="u-medal" cx="40%" cy="35%" r="60%">',
                    '<stop offset="0%" stop-color="#6b6b6b"/>',
                    '<stop offset="100%" stop-color="#2e2e2e"/>',
                '</radialGradient>',
            '</defs>',
            // Background
            '<rect width="300" height="300" fill="url(#u-bg)" rx="20"/>',
            // Hexagon medal
            '<polygon points="150,60 210,95 210,165 150,200 90,165 90,95"',
                ' fill="url(#u-medal)" stroke="#555" stroke-width="3"/>',
            // Inner hexagon
            '<polygon points="150,80 195,105 195,155 150,180 105,155 105,105"',
                ' fill="none" stroke="#888" stroke-width="1.5" opacity="0.5"/>',
            // "?" glyph
            '<text x="150" y="148" text-anchor="middle" font-family="Georgia,serif"',
                ' font-size="54" fill="#aaaaaa" font-weight="bold">?</text>',
            // Ribbon bar
            '<rect x="115" y="210" width="70" height="22" rx="4" fill="#3a3a3a" stroke="#555" stroke-width="1"/>',
            // Label
            '<text x="150" y="226" text-anchor="middle" font-family="Arial,sans-serif"',
                ' font-size="11" fill="#888888" letter-spacing="2">',
                label,
            '</text>',
            // Bottom title
            '<text x="150" y="270" text-anchor="middle" font-family="Arial,sans-serif"',
                ' font-size="10" fill="#555555" letter-spacing="1">REPUTATION SBT</text>',
            '</svg>'
        ));
    }

    /*//////////////////////////////////////////////////////////////
                        SVG — BRONZE
                        Copper circle + 6-point star
    //////////////////////////////////////////////////////////////*/

    function _svgBronze(string memory label) private pure returns (string memory) {
        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">',
            '<defs>',
                '<radialGradient id="b-bg" cx="50%" cy="50%" r="50%">',
                    '<stop offset="0%" stop-color="#1a0f00"/>',
                    '<stop offset="100%" stop-color="#0d0700"/>',
                '</radialGradient>',
                '<radialGradient id="b-medal" cx="38%" cy="32%" r="65%">',
                    '<stop offset="0%" stop-color="#e8884a"/>',
                    '<stop offset="50%" stop-color="#b85c1a"/>',
                    '<stop offset="100%" stop-color="#7a3500"/>',
                '</radialGradient>',
                '<radialGradient id="b-shine" cx="35%" cy="30%" r="40%">',
                    '<stop offset="0%" stop-color="#f4b07a" stop-opacity="0.6"/>',
                    '<stop offset="100%" stop-color="#f4b07a" stop-opacity="0"/>',
                '</radialGradient>',
            '</defs>',
            // Background
            '<rect width="300" height="300" fill="url(#b-bg)" rx="20"/>',
            // Outer ring
            '<circle cx="150" cy="130" r="82" fill="none" stroke="#7a3500" stroke-width="4"/>',
            '<circle cx="150" cy="130" r="78" fill="none" stroke="#e8884a" stroke-width="1.5" opacity="0.4"/>',
            // Medal circle
            '<circle cx="150" cy="130" r="74" fill="url(#b-medal)"/>',
            // Shine overlay
            '<circle cx="150" cy="130" r="74" fill="url(#b-shine)"/>',
            // 6-point star
            '<polygon points="150,72 157,112 196,108 165,132 179,170 150,148 121,170 135,132 104,108 143,112"',
                ' fill="#f4c87a" stroke="#c97830" stroke-width="1.5"/>',
            // Ribbon
            '<rect x="118" y="218" width="64" height="20" rx="3" fill="#7a3500" stroke="#e8884a" stroke-width="1.5"/>',
            '<text x="150" y="233" text-anchor="middle" font-family="Arial,sans-serif"',
                ' font-size="10" fill="#f4b07a" letter-spacing="2" font-weight="bold">',
                label,
            '</text>',
            '<text x="150" y="272" text-anchor="middle" font-family="Arial,sans-serif"',
                ' font-size="10" fill="#7a5535" letter-spacing="1">REPUTATION SBT</text>',
            '</svg>'
        ));
    }

    /*//////////////////////////////////////////////////////////////
                        SVG — SILVER
                        Silver circle + 5-point star
    //////////////////////////////////////////////////////////////*/

    function _svgSilver(string memory label) private pure returns (string memory) {
        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">',
            '<defs>',
                '<radialGradient id="s-bg" cx="50%" cy="50%" r="50%">',
                    '<stop offset="0%" stop-color="#0d0d0f"/>',
                    '<stop offset="100%" stop-color="#050507"/>',
                '</radialGradient>',
                '<radialGradient id="s-medal" cx="38%" cy="32%" r="65%">',
                    '<stop offset="0%" stop-color="#e8e8f0"/>',
                    '<stop offset="50%" stop-color="#a0a0b8"/>',
                    '<stop offset="100%" stop-color="#606070"/>',
                '</radialGradient>',
                '<radialGradient id="s-shine" cx="33%" cy="28%" r="38%">',
                    '<stop offset="0%" stop-color="#ffffff" stop-opacity="0.7"/>',
                    '<stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>',
                '</radialGradient>',
            '</defs>',
            '<rect width="300" height="300" fill="url(#s-bg)" rx="20"/>',
            // Decorative outer rings
            '<circle cx="150" cy="130" r="82" fill="none" stroke="#606070" stroke-width="3"/>',
            '<circle cx="150" cy="130" r="78" fill="none" stroke="#c0c0d0" stroke-width="1" opacity="0.5"/>',
            // Medal
            '<circle cx="150" cy="130" r="74" fill="url(#s-medal)"/>',
            '<circle cx="150" cy="130" r="74" fill="url(#s-shine)"/>',
            // 5-point star
            '<polygon points="150,70 161,108 202,108 169,131 181,170 150,148 119,170 131,131 98,108 139,108"',
                ' fill="#e0e0f0" stroke="#8888a0" stroke-width="1.5"/>',
            // Inner star accent
            '<polygon points="150,88 157,110 181,110 162,123 169,146 150,134 131,146 138,123 119,110 143,110"',
                ' fill="#b0b0c8" opacity="0.5"/>',
            // Ribbon
            '<rect x="118" y="218" width="64" height="20" rx="3" fill="#404050" stroke="#a0a0b8" stroke-width="1.5"/>',
            '<text x="150" y="233" text-anchor="middle" font-family="Arial,sans-serif"',
                ' font-size="10" fill="#d0d0e0" letter-spacing="2" font-weight="bold">',
                label,
            '</text>',
            '<text x="150" y="272" text-anchor="middle" font-family="Arial,sans-serif"',
                ' font-size="10" fill="#606070" letter-spacing="1">REPUTATION SBT</text>',
            '</svg>'
        ));
    }

    /*//////////////////////////////////////////////////////////////
                        SVG — GOLD
                        Gold circle + crown
    //////////////////////////////////////////////////////////////*/

    function _svgGold(string memory label) private pure returns (string memory) {
        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">',
            '<defs>',
                '<radialGradient id="g-bg" cx="50%" cy="50%" r="50%">',
                    '<stop offset="0%" stop-color="#1a1400"/>',
                    '<stop offset="100%" stop-color="#0a0800"/>',
                '</radialGradient>',
                '<radialGradient id="g-medal" cx="38%" cy="32%" r="65%">',
                    '<stop offset="0%" stop-color="#ffe066"/>',
                    '<stop offset="45%" stop-color="#f0a800"/>',
                    '<stop offset="100%" stop-color="#9a6600"/>',
                '</radialGradient>',
                '<radialGradient id="g-shine" cx="33%" cy="28%" r="38%">',
                    '<stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/>',
                    '<stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>',
                '</radialGradient>',
                '<filter id="g-glow">',
                    '<feGaussianBlur stdDeviation="3" result="blur"/>',
                    '<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>',
                '</filter>',
            '</defs>',
            '<rect width="300" height="300" fill="url(#g-bg)" rx="20"/>',
            // Glow ring
            '<circle cx="150" cy="130" r="84" fill="none" stroke="#f0a800" stroke-width="2" opacity="0.3" filter="url(#g-glow)"/>',
            '<circle cx="150" cy="130" r="82" fill="none" stroke="#9a6600" stroke-width="3"/>',
            '<circle cx="150" cy="130" r="78" fill="none" stroke="#ffe066" stroke-width="1" opacity="0.6"/>',
            // Medal
            '<circle cx="150" cy="130" r="74" fill="url(#g-medal)"/>',
            '<circle cx="150" cy="130" r="74" fill="url(#g-shine)"/>',
            // Crown base
            '<rect x="112" y="148" width="76" height="14" rx="3" fill="#9a6600"/>',
            // Crown spikes: left, mid-left, center, mid-right, right
            '<polygon points="112,148 120,148 116,118" fill="#9a6600"/>',
            '<polygon points="124,148 138,148 131,108" fill="#b07800"/>',
            '<polygon points="143,148 157,148 150,100" fill="#9a6600"/>',
            '<polygon points="162,148 176,148 169,108" fill="#b07800"/>',
            '<polygon points="180,148 188,148 184,118" fill="#9a6600"/>',
            // Crown gems
            '<circle cx="116" cy="118" r="4" fill="#ff6644" opacity="0.9"/>',
            '<circle cx="131" cy="108" r="5" fill="#44aaff" opacity="0.9"/>',
            '<circle cx="150" cy="100" r="6" fill="#ff44aa" opacity="0.9"/>',
            '<circle cx="169" cy="108" r="5" fill="#44ffaa" opacity="0.9"/>',
            '<circle cx="184" cy="118" r="4" fill="#ffcc44" opacity="0.9"/>',
            // Ribbon
            '<rect x="118" y="218" width="64" height="20" rx="3" fill="#9a6600" stroke="#ffe066" stroke-width="1.5"/>',
            '<text x="150" y="233" text-anchor="middle" font-family="Arial,sans-serif"',
                ' font-size="10" fill="#ffe066" letter-spacing="2" font-weight="bold">',
                label,
            '</text>',
            '<text x="150" y="272" text-anchor="middle" font-family="Arial,sans-serif"',
                ' font-size="10" fill="#9a6600" letter-spacing="1">REPUTATION SBT</text>',
            '</svg>'
        ));
    }

    /*//////////////////////////////////////////////////////////////
                        SVG — PLATINUM
                        Platinum ring + gem diamond
    //////////////////////////////////////////////////////////////*/

    function _svgPlatinum(string memory label) private pure returns (string memory) {
        return string(abi.encodePacked(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300">',
            '<defs>',
                '<radialGradient id="p-bg" cx="50%" cy="50%" r="50%">',
                    '<stop offset="0%" stop-color="#070b14"/>',
                    '<stop offset="100%" stop-color="#020408"/>',
                '</radialGradient>',
                '<radialGradient id="p-medal" cx="38%" cy="32%" r="65%">',
                    '<stop offset="0%" stop-color="#e8f4ff"/>',
                    '<stop offset="40%" stop-color="#a0c8f0"/>',
                    '<stop offset="100%" stop-color="#3060a0"/>',
                '</radialGradient>',
                '<radialGradient id="p-shine" cx="33%" cy="28%" r="38%">',
                    '<stop offset="0%" stop-color="#ffffff" stop-opacity="0.8"/>',
                    '<stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>',
                '</radialGradient>',
                '<filter id="p-glow2">',
                    '<feGaussianBlur stdDeviation="4" result="blur"/>',
                    '<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>',
                '</filter>',
            '</defs>',
            '<rect width="300" height="300" fill="url(#p-bg)" rx="20"/>',
            // Outer glow rings
            '<circle cx="150" cy="130" r="86" fill="none" stroke="#60a8ff" stroke-width="1" opacity="0.2" filter="url(#p-glow2)"/>',
            '<circle cx="150" cy="130" r="82" fill="none" stroke="#3060a0" stroke-width="4"/>',
            '<circle cx="150" cy="130" r="78" fill="none" stroke="#a0c8f0" stroke-width="1.5" opacity="0.7"/>',
            '<circle cx="150" cy="130" r="76" fill="none" stroke="#e8f4ff" stroke-width="0.5" opacity="0.4"/>',
            // Medal
            '<circle cx="150" cy="130" r="73" fill="url(#p-medal)"/>',
            '<circle cx="150" cy="130" r="73" fill="url(#p-shine)"/>',
            // Diamond gem — top facet
            '<polygon points="150,80 178,115 150,105 122,115" fill="#c0e0ff" opacity="0.95"/>',
            // Diamond gem — left facets
            '<polygon points="122,115 150,105 150,158" fill="#80b8f0" opacity="0.9"/>',
            '<polygon points="122,115 150,158 136,130" fill="#60a0e0" opacity="0.8"/>',
            // Diamond gem — right facets
            '<polygon points="178,115 150,105 150,158" fill="#a0ccff" opacity="0.9"/>',
            '<polygon points="178,115 150,158 164,130" fill="#80b8f0" opacity="0.8"/>',
            // Diamond gem — center line
            '<line x1="122" y1="115" x2="178" y2="115" stroke="#ffffff" stroke-width="0.8" opacity="0.6"/>',
            '<line x1="150" y1="80"  x2="150" y2="158" stroke="#ffffff" stroke-width="0.5" opacity="0.4"/>',
            // Sparkles
            '<circle cx="118" cy="95"  r="2.5" fill="#ffffff" opacity="0.8"/>',
            '<circle cx="182" cy="100" r="2"   fill="#ffffff" opacity="0.7"/>',
            '<circle cx="130" cy="165" r="2"   fill="#a0d8ff" opacity="0.6"/>',
            '<circle cx="172" cy="160" r="1.5" fill="#a0d8ff" opacity="0.6"/>',
            // Ribbon
            '<rect x="118" y="218" width="64" height="20" rx="3" fill="#1a3060" stroke="#a0c8f0" stroke-width="1.5"/>',
            '<text x="150" y="233" text-anchor="middle" font-family="Arial,sans-serif"',
                ' font-size="10" fill="#c0e0ff" letter-spacing="2" font-weight="bold">',
                label,
            '</text>',
            '<text x="150" y="272" text-anchor="middle" font-family="Arial,sans-serif"',
                ' font-size="10" fill="#3060a0" letter-spacing="1">REPUTATION SBT</text>',
            '</svg>'
        ));
    }
}
