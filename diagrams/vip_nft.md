## VIP Ticket 
```mermaid
stateDiagram
direction LR
    maker --> 1inch: VIP NFT Ticket
    1inch --> maker:wETH (Zero price)
    state 1inch {
      direction LR
      NFT --> wETH
      wETH --> NFT
    }
    1inch --> taker:VIP NFT Ticket
    taker --> 1inch:wETH (Zero price)
    taker --> maker:1st step address
```
