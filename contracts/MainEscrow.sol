//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MainEscrow is Context {
    mapping(address => mapping(address => uint256)) private _balances;
    mapping(address => uint256) _ethBalance;

    event LockSuccess(address sender, address token, uint256 amount);
    event ReleaseSuccess(address sender, uint256 amount);

    receive() external payable {
        lockEth();
    }

    function lockEth() public payable {
        require(msg.value > 0, "Can not lock 0 ETH");

        _ethBalance[_msgSender()] = msg.value;

        emit LockSuccess(_msgSender(), address(this), msg.value);
    }

    function releaseEth(uint256 amount) external {
        // todo require validator to confirm the lock transaction on the side chain
        // is successfuly mined/confirmed and the same amount is burned
        require(
            _ethBalance[_msgSender()] >= amount,
            "Not enough locked balance"
        );

        address payable _to = payable(_msgSender());
        _to.transfer(amount);

        emit ReleaseSuccess(_msgSender(), amount);
    }

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

        emit LockSuccess(_msgSender(), address(token), amount);
    }

    function release(IERC20 token, uint256 amount) external {
        // todo require validator to confirm the lock transaction on the side chain
        // is successfuly mined/confirmed and the same amount is burned
        require(
            _balances[_msgSender()][address(token)] >= amount,
            "Not enough locked balance"
        );

        _balances[_msgSender()][address(token)] =
            _balances[_msgSender()][address(token)] -
            amount;
        token.transfer(_msgSender(), amount);

        emit ReleaseSuccess(_msgSender(), amount);
    }
}
