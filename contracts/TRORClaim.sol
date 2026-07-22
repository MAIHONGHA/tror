// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20Claim {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

contract TRORClaim {
    IERC20Claim public usdc;
    address public owner;

    struct Claim {
        address sender;
        bytes32 emailHash;
        uint256 amount;
        string memo;
        uint256 createdAt;
        uint256 expiresAt;
        bool claimed;
        bool refunded;
    }

    uint256 public nextClaimId;
    mapping(uint256 => Claim) public claims;

    event ClaimCreated(
        uint256 indexed claimId,
        address indexed sender,
        bytes32 indexed emailHash,
        uint256 amount,
        string memo,
        uint256 expiresAt
    );

    event ClaimPaid(
        uint256 indexed claimId,
        address indexed receiver,
        uint256 amount,
        string memo
    );

    event ClaimRefunded(
        uint256 indexed claimId,
        address indexed sender,
        uint256 amount
    );

    constructor(address usdcAddress) {
        usdc = IERC20Claim(usdcAddress);
        owner = msg.sender;
    }

    function createClaim(
        bytes32 emailHash,
        uint256 amount,
        string calldata memo,
        uint256 expiresAt
    ) external returns (uint256) {
        require(emailHash != bytes32(0), "Invalid email hash");
        require(amount > 0, "Invalid amount");
        require(expiresAt > block.timestamp, "Invalid expiry");

        uint256 claimId = nextClaimId;

        claims[claimId] = Claim({
            sender: msg.sender,
            emailHash: emailHash,
            amount: amount,
            memo: memo,
            createdAt: block.timestamp,
            expiresAt: expiresAt,
            claimed: false,
            refunded: false
        });

        nextClaimId++;

        require(
            usdc.transferFrom(msg.sender, address(this), amount),
            "USDC transfer failed"
        );

        emit ClaimCreated(
            claimId,
            msg.sender,
            emailHash,
            amount,
            memo,
            expiresAt
        );

        return claimId;
    }

    function claimToWallet(uint256 claimId, address receiver) external {
        Claim storage c = claims[claimId];

        require(c.amount > 0, "Claim not found");
        require(!c.claimed, "Already claimed");
        require(!c.refunded, "Already refunded");
        require(block.timestamp <= c.expiresAt, "Claim expired");
        require(receiver != address(0), "Invalid receiver");

        c.claimed = true;

        require(usdc.transfer(receiver, c.amount), "Payout failed");

        emit ClaimPaid(claimId, receiver, c.amount, c.memo);
    }

    function refundExpired(uint256 claimId) external {
        Claim storage c = claims[claimId];

        require(c.amount > 0, "Claim not found");
        require(msg.sender == c.sender, "Only sender");
        require(!c.claimed, "Already claimed");
        require(!c.refunded, "Already refunded");
        require(block.timestamp > c.expiresAt, "Not expired");

        c.refunded = true;

        require(usdc.transfer(c.sender, c.amount), "Refund failed");

        emit ClaimRefunded(claimId, c.sender, c.amount);
    }
}