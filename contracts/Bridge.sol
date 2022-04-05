//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/presets/ERC20PresetMinterPauser.sol";
import "./Utils.sol";
import "./Structs.sol";
import "./IBridge.sol";

contract Bridge is IBridge {
    Structs.WrappedToken[] private _wrappedTokens;
    mapping(address => address) private _nativeToWrapped;
    address private _trustedSigner;

    constructor(address trustedSigner) {
        _trustedSigner = trustedSigner;
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
        address nativeToken,
        uint256 amount,
        address receiver
    ) external override {
        require(amount > 0, "Lock 0");

        IERC20(nativeToken).transferFrom(receiver, address(this), amount);

        emit Lock(
            targetChain,
            address(nativeToken),
            receiver,
            amount,
            0 // todo incorporate bridge fees
        );
    }

    function release(
        uint16 sourceChain,
        address nativeToken,
        uint256 amount,
        address receiver,
        bytes memory txHash,
        bytes memory txSigned
    )
        external
        override
        isTrustedSigner(txHash, txSigned)
        isValidTx(sourceChain, nativeToken, amount, receiver, txHash)
    {
        IERC20(nativeToken).transfer(receiver, amount);

        emit Release(sourceChain, nativeToken, amount, receiver);
    }

    function burn(
        address wrappedToken,
        uint256 amount,
        address receiver
    ) external override {
        ERC20Burnable token = ERC20Burnable(wrappedToken);
        require(amount > 0, "Bad amount");

        token.burnFrom(receiver, amount);

        emit Burn(wrappedToken, amount, receiver);
    }

    function mint(
        uint16 nativeChain,
        address nativeToken,
        uint256 amount,
        address receiver,
        bytes memory txHash,
        bytes memory txSigned
        // Structs.WrappedTokenParams memory tokenParams
    )
        external
        override
        isTrustedSigner(txHash, txSigned)
        isValidTx(nativeChain, nativeToken, amount, receiver, txHash)
    {
        require(amount > 0, "Bad amount");
        require(_nativeToWrapped[nativeToken] != address(0), "Wrap first");

        ERC20PresetMinterPauser(_nativeToWrapped[nativeToken]).mint(
            receiver,
            amount
        );

        emit Mint(_nativeToWrapped[nativeToken], amount, receiver);
    }

    function wrapToken(
        uint16 nativeChain,
        address nativeToken,
        Structs.WrappedTokenParams memory newToken
    ) external override returns (address) {
        // todo validate the nativeToken is not a token on the same network
        // todo ?maybe validate nativeToken exists on nativeChain
        // todo ?should we prevent non owner of source token to add wrapped token
        require(_nativeToWrapped[nativeToken] == address(0), "Already wrapped");
        require(bytes(newToken.name).length != 0, "Bad name");
        require(bytes(newToken.symbol).length != 0, "Bad symbol");
        require(nativeChain != 0, "Bad chain id");

        ERC20PresetMinterPauser wrappedToken = new ERC20PresetMinterPauser(
            newToken.name,
            newToken.symbol
        );
        _nativeToWrapped[nativeToken] = address(wrappedToken);
        _wrappedTokens.push(
            Structs.WrappedToken({
                name: newToken.name,
                symbol: newToken.symbol,
                decimals: wrappedToken.decimals(),
                token: address(wrappedToken),
                nativeToken: nativeToken,
                nativeChain: nativeChain
            })
        );

        emit WrappedTokenDeployed(
            nativeChain,
            nativeToken,
            address(wrappedToken)
        );

        return address(wrappedToken);
    }

    function wrappedTokens() external override view returns(Structs.WrappedToken[] memory) {
        return _wrappedTokens;
    }

    function nativeToWrappedToken(address nativeToken) external override view returns(address) {
        return _nativeToWrapped[nativeToken];
    }
}
