//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "./Utils.sol";
import "./Structs.sol";
import "./IBridge.sol";

contract Bridge is IBridge {
    Structs.WrappedToken[] private _wrappedTokens;
    mapping(address => address) private _tokenToWrapped;
    mapping(address => Structs.WrappedToken) private _wrappedDetails;
    address private _trustedSigner;
    uint256 private _serviceFee;

    constructor(address trustedSigner, uint256 serviceFee) {
        _trustedSigner = trustedSigner;
        _serviceFee = serviceFee;
    }

    receive() external payable {
        revert("Reverted");
    }

    fallback() external payable {
        revert("Reverted");
    }

    // Checks if the message is siggned from a trusted signer
    modifier isTrustedSigner(bytes memory msgHash, bytes memory msgSigned) {
        address signer = Utils.recoverSignerFromSignedMessage(
            msgHash,
            msgSigned
        );
        require(signer == _trustedSigner, "Bad signer");
        _;
    }

    // Check if function arguments match the txHash
    modifier isValidTx(
        uint16 chainId,
        address token,
        uint256 amount,
        address receiver,
        bytes memory txHash
    ) {
        require(
            Utils.hashArgs(chainId, token, amount, receiver) ==
                Utils.bytesToTxHash(txHash),
            "Bad args"
        );
        _;
    }

    function lock(
        uint16 targetChain,
        address token,
        uint256 amount
    ) external payable override {
        require(msg.value >= _serviceFee, "Service fee not enough");
        require(amount > 0, "Lock 0");

        IERC20(token).transferFrom(msg.sender, address(this), amount);

        emit Lock(targetChain, address(token), msg.sender, amount, msg.value);
    }

    function release(
        uint16 sourceChain,
        address token,
        uint256 amount,
        address receiver,
        bytes memory txHash,
        bytes memory txSigned
    )
        external
        override
        isTrustedSigner(txHash, txSigned)
        isValidTx(sourceChain, token, amount, receiver, txHash)
    {
        require(receiver == msg.sender, "Reciver and sender mismatch");
        require(Utils.isContract(token), "Token does not exist");

        IERC20(token).transfer(msg.sender, amount);

        emit Release(sourceChain, token, amount, msg.sender);
    }

    function burn(
        uint16 sourceChain,
        address wrappedToken,
        uint256 amount,
        address receiver
    ) external override {
        require(receiver == msg.sender, "Reciver and sender mismatch");
        ERC20Burnable token = ERC20Burnable(wrappedToken);
        require(amount > 0, "Bad amount");
        require(
            _wrappedDetails[wrappedToken].token != address(0),
            "Not supported token"
        );
        require(
            _wrappedDetails[wrappedToken].sourceChain == sourceChain,
            "Bad source chain"
        );

        token.burnFrom(receiver, amount);

        emit Burn(wrappedToken, amount, receiver);
    }

    function mint(
        uint16 sourceChain,
        address token,
        uint256 amount,
        address receiver,
        bytes memory txHash,
        bytes memory txSigned
    )
        external
        override
        // Structs.WrappedTokenParams memory tokenParams
        isTrustedSigner(txHash, txSigned)
        isValidTx(sourceChain, token, amount, receiver, txHash)
    {
        require(receiver == msg.sender, "Reciver and sender mismatch");
        require(amount > 0, "Bad amount");
        require(_tokenToWrapped[token] != address(0), "Wrap first");

        ERC20PresetMinterPauser(_tokenToWrapped[token]).mint(
            msg.sender,
            amount
        );

        emit Mint(_tokenToWrapped[token], amount, msg.sender);
    }

    function wrapToken(
        uint16 sourceChain,
        address token,
        Structs.WrappedTokenParams memory newToken
    ) external override returns (address) {
        // todo ?validate the token is not a token on the same network
        // todo ?maybe validate token exists on sourceChain
        // todo ?should we prevent non owner of source token to add wrapped token
        require(_tokenToWrapped[token] == address(0), "Already wrapped");
        require(bytes(newToken.name).length != 0, "Bad name");
        require(bytes(newToken.symbol).length != 0, "Bad symbol");
        require(sourceChain > 0, "Bad chain id");

        ERC20PresetMinterPauser wrappedToken = new ERC20PresetMinterPauser(
            newToken.name,
            newToken.symbol
        );

        _tokenToWrapped[token] = address(wrappedToken);
        Structs.WrappedToken memory storeIt = Structs.WrappedToken({
            name: newToken.name,
            symbol: newToken.symbol,
            decimals: wrappedToken.decimals(),
            wrappedToken: address(wrappedToken),
            token: token,
            sourceChain: sourceChain
        });

        _wrappedTokens.push(storeIt);
        _wrappedDetails[address(wrappedToken)] = storeIt;

        emit WrappedTokenDeployed(sourceChain, token, address(wrappedToken));

        return address(wrappedToken);
    }

    function wrappedTokens()
        external
        view
        override
        returns (Structs.WrappedToken[] memory)
    {
        return _wrappedTokens;
    }

    function tokenToWrappedToken(address token)
        external
        view
        override
        returns (address)
    {
        return _tokenToWrapped[token];
    }
}
