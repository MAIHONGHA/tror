// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20Claim {
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);

    function transfer(
        address to,
        uint256 amount
    ) external returns (bool);
}

contract TRORClaim {
    IERC20Claim public immutable usdc;

    // Address allowed only to attest that
    // Gmail verification succeeded.
    // It cannot withdraw claim funds.
    address public immutable verifier;

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

    constructor(
        address usdcAddress,
        address verifierAddress
    ) {
        require(
            usdcAddress != address(0),
            "Invalid USDC"
        );

        require(
            verifierAddress != address(0),
            "Invalid verifier"
        );

        usdc = IERC20Claim(usdcAddress);
        verifier = verifierAddress;
    }

    function createClaim(
        bytes32 emailHash,
        uint256 amount,
        string calldata memo,
        uint256 expiresAt
    ) external returns (uint256) {
        require(
            emailHash != bytes32(0),
            "Invalid email hash"
        );

        require(
            amount > 0,
            "Invalid amount"
        );

        require(
            expiresAt > block.timestamp,
            "Invalid expiry"
        );

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
            usdc.transferFrom(
                msg.sender,
                address(this),
                amount
            ),
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

    function claim(
        uint256 claimId,
        uint256 authorizationDeadline,
        bytes calldata authorization
    ) external {
        Claim storage c = claims[claimId];

        require(
            c.amount > 0,
            "Claim not found"
        );

        require(
            !c.claimed,
            "Already claimed"
        );

        require(
            !c.refunded,
            "Already refunded"
        );

        require(
            block.timestamp <= c.expiresAt,
            "Claim expired"
        );

        require(
            block.timestamp <= authorizationDeadline,
            "Authorization expired"
        );

        bytes32 messageHash = keccak256(
            abi.encode(
                block.chainid,
                address(this),
                claimId,
                msg.sender,
                c.emailHash,
                authorizationDeadline
            )
        );

        bytes32 ethSignedMessageHash =
            keccak256(
                abi.encodePacked(
                    "\x19Ethereum Signed Message:\n32",
                    messageHash
                )
            );

        address recovered =
            recoverSigner(
                ethSignedMessageHash,
                authorization
            );

        require(
            recovered == verifier,
            "Invalid Gmail authorization"
        );

        c.claimed = true;

        require(
            usdc.transfer(
                msg.sender,
                c.amount
            ),
            "Claim transfer failed"
        );

        emit ClaimPaid(
            claimId,
            msg.sender,
            c.amount,
            c.memo
        );
    }

    function refundExpired(
        uint256 claimId
    ) external {
        Claim storage c =
            claims[claimId];

        require(
            c.amount > 0,
            "Claim not found"
        );

        require(
            msg.sender == c.sender,
            "Only sender"
        );

        require(
            !c.claimed,
            "Already claimed"
        );

        require(
            !c.refunded,
            "Already refunded"
        );

        require(
            block.timestamp > c.expiresAt,
            "Not expired"
        );

        c.refunded = true;

        require(
            usdc.transfer(
                c.sender,
                c.amount
            ),
            "Refund failed"
        );

        emit ClaimRefunded(
            claimId,
            c.sender,
            c.amount
        );
    }

    function recoverSigner(
        bytes32 digest,
        bytes memory signature
    ) internal pure returns (address) {
        require(
            signature.length == 65,
            "Invalid signature length"
        );

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(
                add(signature, 32)
            )

            s := mload(
                add(signature, 64)
            )

            v := byte(
                0,
                mload(
                    add(signature, 96)
                )
            )
        }

        if (v < 27) {
            v += 27;
        }

        require(
            v == 27 || v == 28,
            "Invalid signature v"
        );

        return ecrecover(
            digest,
            v,
            r,
            s
        );
    }
}