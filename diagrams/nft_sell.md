## NFT Sell
```mermaid
stateDiagram
direction LR
    maker --> 1inch:NFT
    1inch --> maker:wETH
    state 1inch {
      direction LR
      NFT --> wETH
      wETH --> NFT
    }
    1inch --> taker:NFT
    taker --> 1inch:wETH
```
