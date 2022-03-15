//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";
import "./AcmeToken.sol";

import "hardhat/console.sol";

contract Escrow is Ownable {
    AcmeToken private _acme;
    mapping(address => uint256) private _balances;

    constructor(AcmeToken acme) {
        _acme = acme;
    }

    event LockSuccess(address sender, address escrow, uint256 amount);
    event ClaimSuccess(address sender, uint256 amount);

    function lock(uint256 amount) external {
        require(amount > 0, "Amount must be greated then zero");

        _acme.transferFrom(_msgSender(), address(this), amount);
        _balances[_msgSender()] = amount;

        emit LockSuccess(_msgSender(), address(this), amount);
    }

    function claimAll() external {
        require(_balances[_msgSender()] > 0, "Nothing to claim");

        uint256 claimable = _balances[_msgSender()];
        _balances[_msgSender()] = 0;
        _acme.transfer(_msgSender(), claimable);

        emit ClaimSuccess(_msgSender(), claimable);
    }

    function setBalance(address wallet, uint256 amount) external onlyOwner {
        _balances[wallet] = amount;
    }
}
