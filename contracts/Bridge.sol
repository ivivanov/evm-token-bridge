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
        string memory wTokenName,
        string memory wTokenSymbol,
        bytes memory txHash
    ) {
        require(
            Utils.hashArgs(
                chainId,
                token,
                amount,
                receiver,
                wTokenName,
                wTokenSymbol
            ) == Utils.bytesToTxHash(txHash),
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

    function release(Structs.ReleaseInput memory args)
        external
        override
        isTrustedSigner(args.txHash, args.txSigned)
        isValidTx(
            args.sourceChain,
            args.token,
            args.amount,
            args.receiver,
            "",
            "",
            args.txHash
        )
    {
        require(args.receiver == msg.sender, "Receiver and sender mismatch");
        require(Utils.isContract(args.token), "Token does not exist");

        IERC20(args.token).transfer(msg.sender, args.amount);

        emit Release(args.sourceChain, args.token, args.amount, msg.sender);
    }

    function burn(
        uint16 sourceChain,
        address wrappedToken,
        uint256 amount,
        address receiver
    ) external override {
        require(receiver == msg.sender, "Receiver and sender mismatch");
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

    function mint(Structs.MintInput memory args)
        external
        override
        isTrustedSigner(args.txHash, args.txSigned)
        isValidTx(
            args.sourceChain,
            args.token,
            args.amount,
            args.receiver,
            args.wrappedTokenName,
            args.wrappedTokenSymbol,
            args.txHash
        )
    {
        require(args.receiver == msg.sender, "Receiver and sender mismatch");
        require(args.amount > 0, "Bad amount");

        address wrappedToken = _tokenToWrapped[args.token];
        if (wrappedToken == address(0)) {
            // Wrap first
            wrappedToken = wrapToken(
                args.sourceChain,
                args.token,
                args.wrappedTokenName,
                args.wrappedTokenSymbol
            );
        }

        ERC20PresetMinterPauser(wrappedToken).mint(msg.sender, args.amount);

        emit Mint(_tokenToWrapped[args.token], args.amount, msg.sender);
    }

    function wrapToken(
        uint16 sourceChain,
        address token,
        string memory name,
        string memory symbol
    ) internal returns (address) {
        require(_tokenToWrapped[token] == address(0), "Already wrapped");
        require(bytes(name).length != 0, "Bad name");
        require(bytes(symbol).length != 0, "Bad symbol");
        require(sourceChain > 0, "Bad chain id");

        ERC20PresetMinterPauser wrappedToken = new ERC20PresetMinterPauser(
            name,
            symbol
        );

        _tokenToWrapped[token] = address(wrappedToken);
        Structs.WrappedToken memory storeIt = Structs.WrappedToken({
            name: name,
            symbol: symbol,
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
}
