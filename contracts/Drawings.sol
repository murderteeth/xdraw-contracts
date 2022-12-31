//SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "./ICredits.sol";

contract Drawings is Ownable2Step, ERC721Enumerable {
  ICredits public credits;
  uint256 public creditsPerDrawing;
  uint256 public nextToken = 1;

  constructor() ERC721("xDraw Drawing", "XDRAW-D") {}

  function setCredits(address _credits) public onlyOwner {
    credits = ICredits(_credits);
    creditsPerDrawing = 10 ** credits.decimals();
  }

  function setCreditsPerDrawing(uint256 _creditsPerDrawing) public onlyOwner {
    creditsPerDrawing = _creditsPerDrawing;
  }

  function mint() public {
    credits.spend(msg.sender, creditsPerDrawing);
    _safeMint(msg.sender, nextToken);
    nextToken += 1;
  }
}
