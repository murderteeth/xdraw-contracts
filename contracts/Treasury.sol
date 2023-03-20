//SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "./IVault.sol";
import "./ICredits.sol";

contract Treasury is Ownable2Step {
  uint16 public constant dust = 10_000;
  ERC20 immutable public dai;
  ICredits public credits;
  IVault public vault;
  uint256 public creditsMintedAsOfLastCollection;
  uint256 public creditsSpentAsOfLastCollection;
  uint256 public earmarkedForProfit;
  mapping(address => uint256) public claimedRewards;

  constructor(address _dai) {
    dai = ERC20(_dai);
  }

  function setCredits(address _credits) public onlyOwner {
    credits = ICredits(_credits);
  }

  function approve(address spender, uint256 amount) public onlyOwner {
    dai.approve(spender, amount);
  }

  function setVault(address _vault) public onlyOwner {
    require(address(vault) == address(0) || vault.balanceOf(address(this)) < dust, "!0");
    vault = IVault(_vault);
  }

  function collect() public onlyOwner {
    uint256 collection = dai.balanceOf(address(credits));
    dai.transferFrom(address(credits), address(this), collection);
    uint256 latestCreditsSpent = credits.totalSpent();
    earmarkedForProfit += credits.creditsToUsd(latestCreditsSpent - creditsSpentAsOfLastCollection);
    creditsMintedAsOfLastCollection = credits.totalMinted();
    creditsSpentAsOfLastCollection = latestCreditsSpent;
  }

  function deposit() public onlyOwner {
    vault.deposit();
  }

  function vaultPosition() public view returns (uint256) {
    uint256 decimals = vault.decimals();
    uint256 pps = vault.pricePerShare();
    uint256 shares = vault.balanceOf(address(this));
    return pps * shares / 10 ** decimals;
  }

  function availableRewards(address user) public view returns (uint256) {
    uint256 unspent = creditsMintedAsOfLastCollection - creditsSpentAsOfLastCollection;
    uint256 basis = credits.creditsToUsd(unspent);
    uint256 position = vaultPosition();
    uint256 unavailableForRewards = basis + earmarkedForProfit;
    if(position <= unavailableForRewards) return 0;
    uint256 totalRewards = position - unavailableForRewards;
    uint256 rewards = totalRewards * credits.minted(user) / credits.totalMinted();
    uint256 claimed = claimedRewards[user];
    if(rewards <= claimed) return 0;
    return rewards - claimed;
  }

  function claimRewards() public {
    uint256 rewards = availableRewards(msg.sender);
    if(rewards < dust) return;
    uint256 rewardsInCredits = credits.usdToCredits(rewards);
    credits.reward(msg.sender, rewardsInCredits);
    claimedRewards[msg.sender] += rewards;
  }

  function withdraw() public onlyOwner {
    vault.withdraw(vault.balanceOf(address(this)));
  }

  function withdrawProfit() public onlyOwner {
    uint256 pps = vault.pricePerShare();
    uint256 shares = earmarkedForProfit * 10 ** vault.decimals() / pps;
    uint256 balance = vault.balanceOf(address(this));
    if(balance < shares) shares = balance;
    if(shares > 0) vault.withdraw(shares);
  }

  function claimProfit() public onlyOwner {
    uint256 balance = dai.balanceOf(address(this));
    if(balance >= earmarkedForProfit) {
      dai.transferFrom(address(this), msg.sender, earmarkedForProfit);
      earmarkedForProfit = 0;
    } else {
      dai.transferFrom(address(this), msg.sender, balance);
      earmarkedForProfit -= balance;
    }
  }
}
