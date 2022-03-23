//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

contract SideEscrow is Ownable {
    mapping(address => bool) private _isSupportedToken;
    mapping(string => string) private _supportedTokenNames;
    address[] private _supportedTokens;

    event ReleaseSuccess(address to, uint256 amount);
    event LockSuccess(address sender, uint256 amount);
    event AddNewERC20Success(address newToken);

    modifier isSupported(IERC20 token) {
        require(_isSupportedToken[address(token)], "Not supported token");
        _;
    }

    function lock(ERC20Burnable token, uint256 amount)
        public
        isSupported(token)
    {
        require(amount > 0, "Can not lock 0");
        require(
            token.allowance(_msgSender(), address(this)) >= amount,
            "Not enough allowance"
        );

        token.burnFrom(msg.sender, amount);

        emit LockSuccess(_msgSender(), amount);
    }

    function release(
        ERC20PresetMinterPauser token,
        address to,
        uint256 amount
    ) external isSupported(token) {
        // todo require validator to confirm the lock transaction on the main chain
        // is successfuly mined/confirmed and the same amount is locked
        require(amount > 0, "Can not mint 0");

        token.mint(to, amount);

        emit ReleaseSuccess(to, amount);
    }

    function supportedTokens() external view returns (address[] memory) {
        return _supportedTokens;
    }

    function addNewERC20(string memory name, string memory symbol)
        external
        onlyOwner
    {
        // should we ensure no dup of symbols?
        require(
            bytes(_supportedTokenNames[name]).length == 0,
            "Duplicate names not allowed"
        );

        IERC20 token = new ERC20PresetMinterPauser(name, symbol);
        _isSupportedToken[address(token)] = true;
        _supportedTokenNames[name] = symbol;
        _supportedTokens.push(address(token));

        emit AddNewERC20Success(address(token));
    }
}
