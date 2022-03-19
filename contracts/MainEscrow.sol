//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/utils/Context.sol";
import "./AcmeToken.sol";

import "hardhat/console.sol";

contract MainEscrow is Context {
    AcmeToken private _acme;
    mapping(address => uint256) private _balances;

    event LockSuccess(address sender, address escrow, uint256 amount);
    event ReleaseSuccess(address sender, uint256 amount);

    constructor(AcmeToken acme) {
        _acme = acme;
    }

    function lock(uint256 amount) external {
        require(amount > 0, "Can not lock 0");
        require(_acme.allowance(_msgSender(), address(this)) >= amount, "Not enough allowance");

        _acme.transferFrom(_msgSender(), address(this), amount);
        _balances[_msgSender()] = amount;

        emit LockSuccess(_msgSender(), address(this), amount);
    }

    function release() external {
        require(_balances[_msgSender()] > 0, "Nothing to claim");

        uint256 claimable = _balances[_msgSender()];
        _balances[_msgSender()] = 0;
        _acme.increaseAllowance(_msgSender(), claimable);

        emit ReleaseSuccess(_msgSender(), claimable);
    }
}
