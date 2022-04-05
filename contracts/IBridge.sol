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
        address nativeToken,
        address wrappedToken
    );

    // The lock function is used for sending a native token from the native chain to any target chain.
    function lock(
        uint16 targetChain,
        address nativeToken,
        uint256 amount,
        address receiver
    ) external;

    // The release function is used for the unlock of native tokens when they were sent from other network.
    function release(
        uint16 sourceChain,
        address nativeToken,
        uint256 amount,
        address receiver,
        bytes memory txHash,
        bytes memory txSigned
    ) external;

    // The burn function is used for sending a wrapped token back into its native chain.
    function burn(
        address wrappedToken,
        uint256 amount,
        address receiver
    ) external;

    // The mint function is used for the creation and release of wrapped tokens in a non-native chain.
    function mint(
        uint16 nativeChain,
        address nativeToken,
        uint256 amount,
        address receiver,
        bytes memory txHash,
        bytes memory txSigned
        // Structs.WrappedTokenParams memory tokenParams
    ) external;

    // The wrapToken functions is used to deploy new wrapped token
    function wrapToken(
        uint16 nativeChain,
        address nativeToken,
        Structs.WrappedTokenParams memory token
    ) external returns (address);

    // The wrappedTokens return all the wrapped tokens
    function wrappedTokens() external view returns(Structs.WrappedToken[] memory);

    // The nativeToWrappedToken returns the coresponding wrapped token address
    function nativeToWrappedToken(address nativeToken) external view returns(address);
}
