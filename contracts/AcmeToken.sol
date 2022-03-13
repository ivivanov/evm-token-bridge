//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract AcmeToken is ERC20PresetMinterPauser, Ownable {
    constructor(uint256 initialBalance) ERC20PresetMinterPauser("AcmeToken", "ACM") {
        mint(msg.sender, initialBalance);
    }
}
