//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract AcmeToken is ERC20PresetMinterPauser{
    constructor(uint256 initialBalance, string memory name, string memory symbol) ERC20PresetMinterPauser(name, symbol) {
        _mint(msg.sender, initialBalance);
    }
}
