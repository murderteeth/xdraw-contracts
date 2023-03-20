//SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IVault is IERC20 {
  function decimals() external view returns (uint256);
  function deposit() external returns (uint256);
  function withdraw(uint256 maxShares) external returns (uint256);
  function pricePerShare() external view returns (uint256);
}
