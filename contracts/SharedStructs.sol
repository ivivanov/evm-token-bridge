//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

library SharedStructs {
    struct WrappedToken {
        string name;
        string symbol;
        address token;
        address sourceToken;
        uint16 sourceChainId;
    }
}
