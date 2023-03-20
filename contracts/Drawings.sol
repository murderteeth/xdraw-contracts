//SPDX-License-Identifier: MIT
pragma solidity ^0.8.12;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable2Step.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "./ICredits.sol";

contract Drawings is Ownable2Step, ERC721Enumerable {
  ICredits public credits;
  uint256 public creditsPerDrawing;
  uint256 public nextToken = 1;
  mapping (uint256 => string) public cids;

  constructor() ERC721("Pendragon Drawing", "PDRGN") {}

  function setCredits(address _credits) public onlyOwner {
    credits = ICredits(_credits);
    creditsPerDrawing = 10 ** credits.decimals();
  }

  function setCreditsPerDrawing(uint256 _creditsPerDrawing) public onlyOwner {
    creditsPerDrawing = _creditsPerDrawing;
  }

  function mint(string memory cid) public {
    credits.spend(msg.sender, creditsPerDrawing);
    _safeMint(msg.sender, nextToken);
    cids[nextToken] = cid;
    nextToken += 1;
  }

  function tokenURI(uint256 token) public view virtual override returns (string memory) {
    return string.concat("ipfs://", cids[token], "/meta");
  }

  function update(uint256 token, string memory cid) public {
    require(_isApprovedOrOwner(msg.sender, token), "!isApprovedOrOwner");
    cids[token] = cid;
  }
}
