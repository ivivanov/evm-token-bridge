//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

library Structs {
    struct WrappedToken {
        string name;
        string symbol;
        uint8 decimals;
        address wrappedToken;
        address token;
        uint16 sourceChain;
    }

    struct MintInput {
        uint16 sourceChain;
        address token;
        uint256 amount;
        address receiver;
        string wrappedTokenName;
        string wrappedTokenSymbol;
        bytes txHash;
        bytes txSigned;
    }

    struct ReleaseInput {
        uint16 sourceChain;
        address token;
        uint256 amount;
        address receiver;
        bytes txHash;
        bytes txSigned;
    }
}
