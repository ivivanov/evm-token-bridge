//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "./IERC20Burnable.sol";
import "./IERC20Mintable.sol";

interface ISideEscrow {
    function burn(IERC20Burnable token, uint256 amount) external;

    function mint(
        IERC20Mintable token,
        address to,
        uint256 amount
    ) external;

    function supportedTokens() external view returns (address[] memory);

    function addNewERC20(string memory name, string memory symbol) external;
}
