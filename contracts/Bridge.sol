//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";

import "./IMainEscrow.sol";
import "./ISideEscrow.sol";
import "./SharedStructs.sol";

contract Bridge is Context, IMainEscrow, ISideEscrow {
    mapping(address => mapping(address => uint256)) private _balances;
    mapping(address => address) private _sourceToWrapped;
    SharedStructs.WrappedToken[] private _wrappedTokens;

    event LockSuccess(address sender, address token, uint256 amount);
    event ReleaseSuccess(address sender, uint256 amount);
    event MintSuccess(address to, uint256 amount);
    event BurnSuccess(address sender, uint256 amount);
    event WrapTokenSuccess(address newToken);

    modifier isSupported(address source) {
        require(_sourceToWrapped[source] != address(0), "Not supported token");
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

    // source - the address of the source token which has wrapped version on the side chain
    function burn(address source, uint256 amount)
        external
        override
        isSupported(source)
    {
        ERC20Burnable token = ERC20Burnable(_sourceToWrapped[source]);
        require(amount > 0, "Can not lock 0");
        require(
            token.allowance(_msgSender(), address(this)) >= amount,
            "Not enough allowance"
        );

        token.burnFrom(msg.sender, amount);

        emit BurnSuccess(_msgSender(), amount);
    }

    // source - the address of the source token which has wrapped version on the side chain
    function mint(
        address source,
        address to,
        uint256 amount
    ) external override isSupported(source) {
        // todo require validator to confirm the lock transaction on the main chain
        // is successfuly mined/confirmed and the same amount is locked
        require(amount > 0, "Can not mint 0");

        ERC20PresetMinterPauser wrappedToken = ERC20PresetMinterPauser(
            _sourceToWrapped[source]
        );

        wrappedToken.mint(to, amount);

        emit MintSuccess(to, amount);
    }

    function wrapToken(
        string memory name,
        string memory symbol,
        address sourceAddress,
        uint16 sourceChainId
    ) external override {
        // todo validate the sourceAddress is not a token on the same network
        // todo ?maybe validate sourdeAddress exists on sourceChainId
        // todo ?how to prevent non owner of source token to add wrapped token
        require(
            _sourceToWrapped[sourceAddress] == address(0),
            "Wrapped token already added"
        );
        require(bytes(name).length != 0, "Name is required");
        require(bytes(symbol).length != 0, "Symbol is required");
        require(
            keccak256(abi.encodePacked((name))) !=
                keccak256(abi.encodePacked((symbol))),
            "Can not be the same"
        );
        require(sourceChainId != 0, "Invalid source chain id");

        IERC20 token = new ERC20PresetMinterPauser(name, symbol);
        _sourceToWrapped[sourceAddress] = address(token);
        _wrappedTokens.push(
            SharedStructs.WrappedToken({
                name: name,
                symbol: symbol,
                token: address(token),
                sourceToken: sourceAddress,
                sourceChainId: sourceChainId
            })
        );

        emit WrapTokenSuccess(address(token));
    }

    function wrappedTokens()
        external
        view
        override
        returns (SharedStructs.WrappedToken[] memory)
    {
        return _wrappedTokens;
    }

    function lockedBalance(address token)
        external
        view
        override
        returns (uint256)
    {
        return _balances[_msgSender()][token];
    }
}
