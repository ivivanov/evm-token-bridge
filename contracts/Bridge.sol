//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./IMainEscrow.sol";
import "./ISideEscrow.sol";
import "./IERC20Burnable.sol";
import "./IERC20Mintable.sol";

contract Bridge is Context, IMainEscrow, ISideEscrow {
    mapping(address => mapping(address => uint256)) private _balances;
    mapping(address => bool) private _isSupportedToken;
    mapping(string => string) private _supportedTokenNames;
    address[] private _supportedTokens;

    event LockSuccess(address sender, address token, uint256 amount);
    event ReleaseSuccess(address sender, uint256 amount);
    event MintSuccess(address to, uint256 amount);
    event BurnSuccess(address sender, uint256 amount);
    event AddNewERC20Success(address newToken);

    modifier isSupported(IERC20 token) {
        require(_isSupportedToken[address(token)], "Not supported token");
        _;
    }

    receive() external payable {
        revert("Bridging ETH is not supported");
    }

    fallback() external payable {
        revert("Something went wrong");
    }

    function lock(IERC20 token, uint256 amount) external override {
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

    function release(IERC20 token, uint256 amount) external override {
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

    function burn(IERC20Burnable token, uint256 amount)
        external
        override
        isSupported(token)
    {
        require(amount > 0, "Can not lock 0");
        require(
            token.allowance(_msgSender(), address(this)) >= amount,
            "Not enough allowance"
        );

        token.burnFrom(msg.sender, amount);

        emit BurnSuccess(_msgSender(), amount);
    }

    function mint(
        IERC20Mintable token,
        address to,
        uint256 amount
    ) external override isSupported(token) {
        // todo require validator to confirm the lock transaction on the main chain
        // is successfuly mined/confirmed and the same amount is locked
        require(amount > 0, "Can not mint 0");

        token.mint(to, amount);

        emit MintSuccess(to, amount);
    }

    function supportedTokens()
        external
        view
        override
        returns (address[] memory)
    {
        return _supportedTokens;
    }

    function addNewERC20(string memory name, string memory symbol)
        public
        override
    {
        require(
            bytes(_supportedTokenNames[name]).length == 0,
            "Duplicate names not allowed"
        );

        IERC20 token = new ERC20(name, symbol);
        _isSupportedToken[address(token)] = true;
        _supportedTokenNames[name] = symbol;
        _supportedTokens.push(address(token));

        emit AddNewERC20Success(address(token));
    }
}
