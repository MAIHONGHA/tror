// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20Payout {
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
}

contract TRORPayout {
    address public immutable USDC;

    mapping(bytes32 => bool)
        public executedPayouts;

    event PayoutExecuted(
        bytes32 indexed payoutId,
        address indexed payer,
        address indexed recipient,
        uint256 amount
    );

    constructor(address usdcAddress) {
        require(
            usdcAddress != address(0),
            "Invalid USDC address"
        );

        USDC = usdcAddress;
    }

    function executePayout(
        bytes32 payoutId,
        address recipient,
        uint256 amount
    ) external {
        require(
            payoutId != bytes32(0),
            "Invalid payout id"
        );

        require(
            !executedPayouts[payoutId],
            "Payout already executed"
        );

        require(
            recipient != address(0),
            "Invalid recipient"
        );

        require(
            amount > 0,
            "Invalid amount"
        );

        executedPayouts[payoutId] = true;

        bool success =
            IERC20Payout(USDC)
                .transferFrom(
                    msg.sender,
                    recipient,
                    amount
                );

        require(
            success,
            "USDC transfer failed"
        );

        emit PayoutExecuted(
            payoutId,
            msg.sender,
            recipient,
            amount
        );
    }
}