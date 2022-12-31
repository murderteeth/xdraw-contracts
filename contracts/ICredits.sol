//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

interface ICredits {
  function decimals() external pure returns (uint16);
  function creditsToUsd(uint256) external view returns (uint256);
  function usdToCredits(uint256) external view returns (uint256);
  function minted(address) external view returns (uint256);
  function totalMinted() external view returns (uint256);
  function totalSpent() external view returns (uint256);
  function balanceOf(address) external view returns (uint256);
  function spend(address, uint256) external;
  function reward(address, uint256) external;
}
