//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/access/Ownable.sol";
import "./AcmeToken.sol";

contract SideEscrow is Ownable {
    // todo make it more generic - ERC20PresetMinterPauser/ERC20
    AcmeToken public Acme;

    event ReleaseSuccess(address to, uint256 amount);
    event LockSuccess(address sender, uint256 amount);

    constructor() {
        // Contract should be the owner of the token on the target chain.
        // This way we can easily mint/burn and maintain the correct total supply
        // todo after its generic token I should find a way to delegate the
        // rights to burn/mint. This way there is no need to own the token
        // and could be any token
        Acme = new AcmeToken(0);
    }

    function lock(uint256 amount) public {
        require(amount > 0, "Can not lock 0");
        require(Acme.allowance(_msgSender(), address(this)) >= amount, "Not enough allowance");

        Acme.transferFrom(_msgSender(), address(this), amount);
        Acme.burn(amount);

        emit LockSuccess(_msgSender(), amount);
    }

    function release(address to, uint256 amount) external onlyOwner {
        require(amount > 0, "Can not mint 0");

        Acme.mint(to, amount);

        emit ReleaseSuccess(to, amount);
    }
}