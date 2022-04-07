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

    struct WrappedTokenParams {
        string name;
        string symbol;
        uint8 decimals;
    }
}
