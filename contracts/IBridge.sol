//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./Structs.sol";

interface IBridge {
    // An event emitted once a Lock transaction is executed
    event Lock(
        uint16 targetChain,
        address token,
        address receiver,
        uint256 amount,
        uint256 serviceFee
    );

    // An event emitted once an Unlock transaction is executed
    event Release(
        uint256 sourceChain,
        address token,
        uint256 amount,
        address receiver
    );

    // An event emitted once a Burn transaction is executed
    event Burn(address wrappedToken, uint256 amount, address receiver);

    // An even emitted once a Mint transaction is executed
    event Mint(address wrappedToken, uint256 amount, address receiver);

    // An event emitted once a new wrapped token is deployed by the contract
    event WrappedTokenDeployed(
        uint16 sourceChain,
        address token,
        address wrappedToken
    );

    // The lock function is used for sending a token from its source chain to any target chain.
    function lock(
        uint16 targetChain,
        address token,
        uint256 amount
    ) external payable;

    // The release function is used for the unlock of tokens when they were sent from other network.
    function release(
        uint16 sourceChain,
        address token,
        uint256 amount,
        address receiver,
        bytes memory txHash,
        bytes memory txSigned
    ) external;

    // The burn function is used for sending a wrapped token back into its source chain.
    function burn(
        uint16 sourceChain,
        address wrappedToken,
        uint256 amount,
        address receiver
    ) external;

    // The mint function is used for the creation and release of wrapped tokens in a target chain.
    function mint(
        uint16 sourceChain,
        address token,
        uint256 amount,
        address receiver,
        bytes memory txHash,
        bytes memory txSigned
        // Structs.WrappedTokenParams memory tokenParams
    ) external;

    // The wrapToken functions is used to deploy new wrapped token
    function wrapToken(
        uint16 sourceChain,
        address token,
        Structs.WrappedTokenParams memory newToken
    ) external returns (address);

    // The wrappedTokens return all the wrapped tokens
    function wrappedTokens()
        external
        view
        returns (Structs.WrappedToken[] memory);

    // The tokenToWrappedToken returns the coresponding wrapped token address
    function tokenToWrappedToken(address token) external view returns (address);
}
