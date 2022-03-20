//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MainEscrow is Context {
    mapping(address => mapping(address => uint256)) private _balances;

    event LockSuccess(address sender, address escrow, uint256 amount);
    event ReleaseSuccess(address sender, uint256 amount);

    function lock(IERC20 token, uint256 amount) external {
        require(amount > 0, "Can not lock 0");
        require(
            token.allowance(_msgSender(), address(this)) >= amount,
            "Not enough allowance"
        );

        token.transferFrom(_msgSender(), address(this), amount);
        _balances[_msgSender()][address(token)] =
            _balances[_msgSender()][address(token)] +
            amount;

        emit LockSuccess(_msgSender(), address(this), amount);
    }

    function release(IERC20 token, uint256 amount) external {
        require(
            _balances[_msgSender()][address(token)] >= amount,
            "Not enough locked balance"
        );

        _balances[_msgSender()][address(token)] =
            _balances[_msgSender()][address(token)] -
            amount;
        token.approve(_msgSender(), amount);

        emit ReleaseSuccess(_msgSender(), amount);
    }
}
