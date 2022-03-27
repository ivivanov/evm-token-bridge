//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./SharedStructs.sol";

interface IMainEscrow {
    function lock(IERC20 token, uint256 amount) external;
    function release(IERC20 token, uint256 amount) external;
    function lockedBalance(address token) external view returns (uint256);
}
