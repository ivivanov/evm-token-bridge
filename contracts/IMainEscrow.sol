//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMainEscrow {
    function lock(IERC20 token, uint256 amount) external;

    function release(IERC20 token, uint256 amount) external;
}
