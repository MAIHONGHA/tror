// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);
}

contract TRORPayroll {
    address public immutable USDC;

    uint256 public constant MAX_RECIPIENTS = 100;

    mapping(bytes32 => bool) public executedPayrolls;

    event PayrollExecuted(
        bytes32 indexed payrollId,
        address indexed payer,
        uint256 employeeCount,
        uint256 totalAmount
    );

    event PayrollPayment(
        bytes32 indexed payrollId,
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

    function executePayroll(
        bytes32 payrollId,
        address[] calldata recipients,
        uint256[] calldata amounts
    ) external {
        require(
            payrollId != bytes32(0),
            "Invalid payroll id"
        );

        require(
            !executedPayrolls[payrollId],
            "Payroll already executed"
        );

        uint256 count = recipients.length;

        require(
            count > 0,
            "Empty payroll"
        );

        require(
            count <= MAX_RECIPIENTS,
            "Too many recipients"
        );

        require(
            count == amounts.length,
            "Array length mismatch"
        );

        uint256 totalAmount = 0;

        /*
         * Mark first.
         * If any transfer below reverts,
         * the whole transaction reverts too,
         * including this state change.
         */
        executedPayrolls[payrollId] = true;

        for (uint256 i = 0; i < count; i++) {
            address recipient = recipients[i];
            uint256 amount = amounts[i];

            require(
                recipient != address(0),
                "Invalid recipient"
            );

            require(
                amount > 0,
                "Invalid amount"
            );

            totalAmount += amount;

            bool success = IERC20(USDC).transferFrom(
                msg.sender,
                recipient,
                amount
            );

            require(
                success,
                "USDC transfer failed"
            );

            emit PayrollPayment(
                payrollId,
                msg.sender,
                recipient,
                amount
            );
        }

        emit PayrollExecuted(
            payrollId,
            msg.sender,
            count,
            totalAmount
        );
    }
}