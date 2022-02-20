// SPDX-License-Identifier: MIT

pragma solidity 0.8.11;
pragma abicoder v1;

import "hardhat/console.sol";

contract DatePriceCalculator {

    /// @notice Calculates price of ticket depending on date
    function singlePrice(uint256 timestamp, uint256 amount) external view returns(uint256) {
        
        console.log("Calculating price");
        
        if (timestamp < 0xff0) {
            return amount;
        } else if (timestamp < 0xff00) { 
            return amount * 2;
        } else 
            return amount * 3;
    }

    function getMakerAmount(uint256 orderMakerAmount, uint256 orderTakerAmount, uint256 swapTakerAmount) public view returns(uint256) {
        console.log("Calculating getMakerAmount");
        
        return this.singlePrice(0xff0, orderTakerAmount);
    }
}
