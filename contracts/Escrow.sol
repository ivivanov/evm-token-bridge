//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "hardhat/console.sol";
// import "@nomicslabs/buidler/console.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./AcmeToken.sol";

contract Escrow is Ownable {
    AcmeToken private token;

    event LockSuccess(address sender, address escrow, uint256 amount);
    event UnlockSuccess(address sender, uint256 amount);

    constructor() {
        token = new AcmeToken(0);
    }

    receive() external payable {
        lock();
    }

    function lock() public payable {
        console.log(msg.sender);
        require(msg.value > 0, "Value must be greated then zero");
        token.transferFrom(msg.sender, address(this), msg.value);

        emit LockSuccess(msg.sender, address(this), msg.value);
    }
}
