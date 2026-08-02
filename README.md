# TROR

Decentralized USDC Payments on Arc Network.

TROR is a decentralized payment platform built on the Arc ecosystem. It enables businesses and individuals to create invoices, receive USDC payments, manage payroll, send crypto claims through Gmail, and process payouts from one unified dashboard.

---

# Overview

TROR simplifies real-world stablecoin payments by combining invoicing, QR payments, payroll, payouts, wallet onboarding, payment memos, and email-based crypto claims into one platform.

The goal is to make USDC payments as simple as traditional online payments while keeping transactions transparent and verifiable on-chain.

---

# Smart Contracts

TROR uses multiple smart contracts deployed on Arc Testnet to support on-chain invoicing, USDC payments, payment memos, and Gmail-based crypto claims.

## Network

Arc Testnet

## TROR Invoice Contract

```text
0xbb9b26e639d2613132bd964afe1be10931f123a0
```

### Capabilities

- Create on-chain USDC invoices
- Store invoice ID, merchant, payer, amount, note, and payment status
- Pay invoices directly with USDC
- Emit `InvoiceCreated` events
- Emit `InvoicePaid` events
- Store payment memo information
- Verify invoice settlement on-chain

## TROR Claim Contract

```text
0xa99b752ffe5ecbbedc37136444ca3c190dcfce96
```

### Capabilities

- Create Gmail-based USDC claims
- Protect recipient privacy by storing an email hash instead of a plain email address
- Store claim amount, memo, and expiration time
- Claim USDC to a Web3 wallet
- Refund expired claims
- Emit `ClaimCreated` events

## Arc Memo Contract

```text
0x5294E9927c3306DcBaDb03fe70b92e01cCede505
```

### Capabilities

- Attach structured memo data to contract calls
- Record payment metadata on-chain
- Link invoice payments with memo identifiers
- Improve transaction traceability

---

# Features

## Payments and Invoicing

- Create USDC invoices
- Create invoices on-chain
- Pay invoices through smart contracts
- Add payment notes and memos
- Generate QR codes
- Generate shareable payment links
- Track payment status
- Verify transactions on Arc Explorer
- View invoice history

## Gmail Crypto Claim

- Send USDC claims through Gmail
- Verify recipients through Google Login
- Use hashed email data on-chain
- Create claims through the TROR Claim contract
- Claim USDC to a Web3 wallet
- Refund expired claims
- Support Circle Wallet onboarding
- Simplify onboarding for non-crypto users

## Payroll

- Manage employees
- Create payroll batches
- Review and approve payroll
- Execute payroll payments
- Track employee payments
- Send email payslips
- Support scheduled payroll workflows

## Payouts

- Create manual payouts
- Schedule payouts
- Review and approve payout requests
- Track payout status
- View transaction history

## Wallet Support

- MetaMask
- Circle Wallet
- OKX Wallet
- Coinbase Wallet
- WalletConnect-compatible wallets through AppKit

## Dashboard

- Payment analytics
- Invoice tracking
- Payroll overview
- Claims monitoring
- Payout overview
- Recent activity history
- Workspace-based data management

---

# Live Demo

https://tror.app

---

# Technology Stack

## Frontend

- HTML
- CSS
- JavaScript
- React
- Vite

## Backend

- Node.js
- Express

## Database

- SQLite

## Blockchain

- Arc Network
- Solidity
- ERC-20 USDC
- ethers.js
- WalletConnect AppKit
- Wagmi
- Viem

## Wallet Infrastructure

- Circle Programmable Wallets
- Google Login
- MetaMask
- OKX Wallet
- Coinbase Wallet

## Infrastructure

- Railway
- GitHub
- Cloudflare

---

# Current Status

TROR MVP is live on Arc Testnet.

## Completed

- TROR Invoice smart contract
- TROR Claim smart contract
- Arc Memo integration
- On-chain invoice creation
- Smart contract USDC invoice payments
- Payment memo support
- Gmail Claim
- Gmail recipient verification
- Claim to Web3 wallet
- Expired claim refund support
- QR payment system
- Circle Wallet integration
- Multi-wallet support
- Employee management
- Payroll workflow
- Scheduled payouts
- Dashboard analytics
- Workspace management
- Business profiles

## Currently Building

- Payroll smart contract
- Merchant settlement
- Advanced payment memo integration
- Improved Gmail Claim settlement
- Bank withdrawal infrastructure
- Merchant APIs

## Planned

- AI Payment Assistant
- Natural-language payment commands
- Automated payroll approvals
- Cross-border payment infrastructure
- Fiat settlement integrations
- Enterprise payment tools

---

# Roadmap

## Phase 1

- On-chain invoice creation
- Smart contract USDC payments
- QR payment system
- Multi-wallet support
- Circle Wallet integration
- Payment memo support

## Phase 2

- Gmail Claim smart contract
- Email hash privacy
- Claim to Web3 wallet
- Expired claim refunds
- Employee and payroll management
- Workspace-based business operations

## Phase 3

- Payroll smart contract
- Merchant settlement
- Bank withdrawals
- Merchant APIs
- AI Payment Assistant
- Enterprise payroll
- Cross-border payments

---

# Why TROR?

TROR focuses on practical USDC payments for real-world businesses and individuals.

Users can:

- Create invoices
- Receive USDC payments
- Pay invoices on-chain
- Add transaction memos
- Send crypto through Gmail
- Claim funds to a Web3 wallet
- Manage employees and payroll
- Process payouts
- Verify transactions on-chain

All from one unified dashboard.

---

# Security and Privacy

TROR is designed to avoid storing plain recipient email addresses on-chain.

For Gmail-based crypto claims, the smart contract uses an email hash. This allows the claim to be associated with the intended recipient while reducing exposure of personal information on the blockchain.

Users should verify contract addresses, network details, wallet permissions, and transaction information before signing.

---

# Author

**MAI HONG HA**

Founder and Builder of TROR.

---

# License

MIT License