[Demo](https://ivivanov.github.io/evm-token-bridge-fe)
# EVM Token Bridge
>The bridge allows transfers of ERC-20 tokens between two networks. The user should be able to connect to the source chain, select a token and the amount they want to bridge, and select a target chain. There is a predefined service fee for using the bridge that is paid when a bridging transaction is sent. Then the user should be able to receive the tokens on the target chain.



## Deployment
```
yarn deploy:ropsten
```
or any other network

## Tests & Coverage
```
yarn test
yarn coverage
```
current coverage is ~99%

## Configuration
- ETHERSCAN_API_KEY - self explanatory
- PRIVATE_KEY - PK of the deployer/owner of the contract
- REPORT_GAS - true or false. Used by hardhat gas reporter
- TRUSTED_SIGNER - address of the validator which will sign transactions and we only trust
- SERVICE_FEE - fee that the bridge would charge for bridging. Value should be in wei
- ROPSTEN_URL - rpc endpoint
