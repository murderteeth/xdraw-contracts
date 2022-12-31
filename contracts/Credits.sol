//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./ICredits.sol";

contract Credits is AccessControl, Ownable2Step, Pausable, ICredits {
  bytes32 public constant SPENDER_ROLE = keccak256("SPENDER_ROLE");
  bytes32 public constant REWARD_ROLE = keccak256("REWARD_ROLE");
  uint16 public constant decimals = 18;
  uint256 public constant oneCredit = 10 ** decimals;

  uint16 constant public bps = 10_000;
  uint16 immutable public rate;
  ERC20 immutable public dai;
  uint256 immutable public oneDai;
  mapping(address => uint256) public minted;
  mapping(address => uint256) public spent;
  uint256 public totalMinted;
  uint256 public totalSpent;

  event Buy(address indexed buyer, uint256 credits);
  event Spend(address indexed spender, uint256 credits);
  event Reward(address indexed buyer, uint256 credits);

  constructor(uint16 _rate, address _dai) {
    rate = _rate;
    dai = ERC20(_dai);
    oneDai = 10 ** dai.decimals();
  }

  function pause() public onlyOwner {
    _pause();
  }

  function unpause() public onlyOwner {
    _unpause();
  }

  function _transferOwnership(address newOwner) internal override {
    address previousOwner = owner();
    super._transferOwnership(newOwner);

    _grantRole(DEFAULT_ADMIN_ROLE, newOwner);
    if(previousOwner != address(0)) {
      _revokeRole(DEFAULT_ADMIN_ROLE, previousOwner);
    }
  }

  function approve(address spender, uint256 amount) public onlyOwner {
    dai.approve(spender, amount);
  }

  function creditsToUsd(uint256 credits) public view returns (uint256) {
    return (rate * credits * oneDai) / (bps * oneCredit);
  }

  function usdToCredits(uint256 usd) public view returns (uint256) {
    return (usd * bps * oneCredit) / (rate * oneDai);
  }

  function balanceOf(address user) public view returns (uint256) {
    return minted[user] - spent[user];
  }

  function buy(uint256 credits) public whenNotPaused {
    dai.transferFrom(msg.sender, address(this), creditsToUsd(credits));
    minted[msg.sender] += credits;
    totalMinted += credits;
    emit Buy(msg.sender, credits);
  }

  function spend(address user, uint256 credits) public whenNotPaused onlyRole(SPENDER_ROLE) {
    require(balanceOf(user) >= credits, "!balance");
    spent[user] += credits;
    totalSpent += credits;
    emit Spend(user, credits);
  }

  function reward(address user, uint256 credits) public onlyRole(REWARD_ROLE) {
    minted[user] += credits;
    totalMinted += credits;
    emit Reward(user, credits);
  }
}
