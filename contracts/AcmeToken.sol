//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract AcmeToken is ERC20PresetMinterPauser{
    constructor(uint256 initialBalance) ERC20PresetMinterPauser("AcmeToken", "ACM") {
        _mint(msg.sender, initialBalance);
    }
}
