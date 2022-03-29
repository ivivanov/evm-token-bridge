//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./SharedStructs.sol";

interface ISideEscrow {
    function burn(address source, uint256 amount) external;

    function mint(
        address source,
        address to,
        uint256 amount
    ) external;

    function wrapToken(
        string memory name,
        string memory symbol,
        address sourceAddress,
        uint16 sourceChainId
    ) external;

    function wrappedTokens()
        external
        view
        returns (SharedStructs.WrappedToken[] memory);
}
