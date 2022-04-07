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
    function release(Structs.ReleaseInput memory args) external;

    // The burn function is used for sending a wrapped token back into its source chain.
    function burn(
        uint16 sourceChain,
        address wrappedToken,
        uint256 amount,
        address receiver
    ) external;

    // The mint function is used for the creation and release of wrapped tokens in a target chain.
    function mint(Structs.MintInput memory mintArgs) external;

    // The wrappedTokens return all the wrapped tokens
    function wrappedTokens()
        external
        view
        returns (Structs.WrappedToken[] memory);
}
