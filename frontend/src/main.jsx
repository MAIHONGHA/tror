import React from "react";
import { createRoot } from "react-dom/client";
import PayoutPanel from "./PayoutPanel.jsx";
import "./style.css";
import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import Web3 from "web3";
import PayrollPanel from "./PayrollPanel.jsx";
import { Html5Qrcode } from "html5-qrcode";
import QRCode from "qrcode";
import { ethers } from "ethers";
import {
  CONTRACT_ADDRESS,
  CONTRACT_ABI,
  MEMO_ADDRESS,
  MEMO_ABI,
  CLAIM_CONTRACT_ADDRESS,
  CLAIM_CONTRACT_ABI
} from "./contract";
import {
  openAppKitWallet,
  wagmiAdapter,
  appKit,
  arcTestnet,
  TROR_NETWORKS
} from "./appkit.js";
import { getAccount, readContract, writeContract, waitForTransactionReceipt } from "@wagmi/core";
import { parseUnits } from "viem";
window.openAppKitWallet = openAppKitWallet;
import {
  getTrorUnifiedBalance,
  depositToTrorUnifiedBalance,
  spendFromTrorUnifiedBalance,
  estimateTrorUnifiedSpend
} from "./gateway.js";
import {
  checkTrorWeb3Capabilities,
  analyzeTrorWeb3GasCapabilities,
  checkTror7702BrowserSupport,
  createTror7702Account,
  inspectTrorWalletProvider,
  inspectTrorAtomicCapabilities,
  inspectTror7702RpcSupport,
  testTrorConnected7702Authorization,
  testTrorBundlerConnection,
  testTrorUsdcPermitMetadata,
  signTrorUsdcPermitWithConnectedWallet,
  buildTrorCirclePaymasterData
} from "./paymaster.js";
import {
  testTrorMetaMask7702Account,
  inspectTrorMetaMask7702Account,
  testTror7702UserOpPrimitives,
  testTror7702StubSignature,
  testTror7702BundlerPrepare,
  testTror7702DeploymentState,
  testTrorValid7702Implementation,
  testTror7702CodeViaPublicClient,
  testTror7702CirclePaymasterPrepare,
  testTror7702CirclePaymasterSend,
  inspectTror7702SigningPath
} from "./tror7702.js";
import {
  testTrorMetaMaskConnect
} from "./tror-metamask-connect.js";
import {
  getTrorGasCapability,
  testTrorGasCapability
} from "./gas-capability.js";
import {
  executeTrorGasCalls,
  getTrorCallStatus,
  testTrorGasExecutor
} from "./gas-executor.js";

window.getTrorUnifiedBalance = getTrorUnifiedBalance;
window.testTror7702Authorization =
  testTrorConnected7702Authorization;
window.testTrorBundlerConnection =
  testTrorBundlerConnection;
window.testTrorUsdcPermitMetadata =
  testTrorUsdcPermitMetadata;
window.signTrorUsdcPermitWithConnectedWallet =
  signTrorUsdcPermitWithConnectedWallet;
window.buildTrorCirclePaymasterData =
  buildTrorCirclePaymasterData;
window.testTrorMetaMask7702Account =
  testTrorMetaMask7702Account;
window.inspectTrorMetaMask7702Account =
  inspectTrorMetaMask7702Account;
window.testTror7702UserOpPrimitives =
  testTror7702UserOpPrimitives;
window.testTror7702StubSignature =
  testTror7702StubSignature;
window.testTror7702BundlerPrepare =
  testTror7702BundlerPrepare;
window.testTror7702DeploymentState =
  testTror7702DeploymentState;
window.testTrorMetaMaskConnect =
  testTrorMetaMaskConnect;
window.testTrorValid7702Implementation =
  testTrorValid7702Implementation;
window.testTror7702CodeViaPublicClient =
  testTror7702CodeViaPublicClient;
window.testTror7702CirclePaymasterPrepare =
  testTror7702CirclePaymasterPrepare;
window.testTror7702CirclePaymasterSend =
  testTror7702CirclePaymasterSend;
window.inspectTror7702SigningPath =
  inspectTror7702SigningPath;
window.getTrorGasCapability =
  getTrorGasCapability;

window.testTrorGasCapability =
  testTrorGasCapability;
window.executeTrorGasCalls =
  executeTrorGasCalls;

window.getTrorCallStatus =
  getTrorCallStatus;

window.testTrorGasExecutor =
  testTrorGasExecutor;

/* =========================
   WALLET CONNECT UI PATCH
   Integrated into main.jsx
========================= */

// Update topbar page title on tab switch
function updateTopbarTitle(tabId) {
  const titles = {
    dashboard:    "Dashboard",
    invoices:     "Invoices",
    customers:    "Customers",
    "gmail-claim":"Gmail Claim",
    payroll:      "Payroll",
    payouts:      "Payouts",
    business:     "Business"
  };
  const el = document.querySelector(".topbar-title");
  if (el) el.textContent = titles[tabId] || "TROR";
}

// Update wallet chip display state
function updateWalletChip(address, balance) {
  const dot =
    document.getElementById("wcDot");

  const addr =
    document.getElementById("walletChipAddress");

  const btn =
    document.getElementById("btnConnectWallet");

  const payBtn =
    document.getElementById("btnPay");

  const scanBtn =
    document.getElementById("btnScanQR");

  const isConnected =
    Boolean(address) &&
    address !== "Disconnected";

  if (isConnected) {
    dot?.classList.add("connected");

    if (addr) {
      addr.textContent =
        address.slice(0, 6) +
        "..." +
        address.slice(-4) +
        " ▾";
    }

    if (btn) {
      btn.style.background =
        "rgba(0,232,135,0.15)";

      btn.style.borderColor =
        "rgba(0,232,135,0.3)";
    }

    if (payBtn) {
      payBtn.style.display = "block";
    }

    if (scanBtn) {
      scanBtn.style.display = "block";
    }

    return;
  }

  dot?.classList.remove("connected");

  if (addr) {
    addr.textContent = "Connect ▾";
  }

  if (btn) {
    btn.style.background = "";
    btn.style.borderColor = "";
  }

  if (payBtn) {
    payBtn.style.display = "none";
  }

  if (scanBtn) {
    scanBtn.style.display = "none";
  }
}

// Wallet chip click — toggle dropdown menu
function positionWalletMenu(chip) {
  const menu = document.getElementById("walletMenu");
  if (!chip || !menu) return;

  const rect = chip.getBoundingClientRect();

  menu.style.position = "fixed";
  menu.style.top = `${rect.bottom + 8}px`;
  menu.style.left = `${Math.max(8, rect.left)}px`;
  menu.style.right = "auto";
  menu.style.zIndex = "1000000";
}

document
  .querySelectorAll("#btnConnectWallet")
  .forEach((button) => {
    button.addEventListener("click", () => {
      const menu =
        document.getElementById("walletMenu");

      if (!menu) return;

      const circleAddress =
        circleWalletEl?.textContent?.startsWith("0x")
          ? circleWalletEl.textContent.trim()
          : null;

      const activeAddress =
        activeWalletType === "circle"
          ? circleAddress
          : metamaskWallet || circleAddress;

      if (!activeAddress) {
        document
          .getElementById("walletModal")
          ?.classList.remove("hidden");

        return;
      }

      menu.classList.toggle("hidden");

      if (!menu.classList.contains("hidden")) {
        positionWalletMenu(button);
      }
    });
  });

// Auto close dropdown on scroll (mobile fix)
window.addEventListener("scroll", () => {
  const walletMenu = document.getElementById("walletMenu");

  if (walletMenu && !walletMenu.classList.contains("hidden")) {
    walletMenu.classList.add("hidden");
  }
}, { passive: true });

window.addEventListener("touchmove", () => {
  const walletMenu = document.getElementById("walletMenu");

  if (walletMenu && !walletMenu.classList.contains("hidden")) {
    walletMenu.classList.add("hidden");
  }
}, { passive: true });

// Sync topbar title when switching tabs
document.querySelectorAll("[data-tab]").forEach((link) => {
  link.addEventListener("click", () => {
    updateTopbarTitle(link.dataset.tab);
  });
});

// Initialize topbar title on page load
updateTopbarTitle(window.location.hash.replace("#","") || "dashboard");

/* =========================
   END OF WALLET UI PATCH
========================= */

window.Web3 = Web3;

globalThis.openCardPayment = window.openCardPayment = function () {
  let modal = document.getElementById("cardCheckoutModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "cardCheckoutModal";
    modal.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.75);
      z-index:999999;display:flex;align-items:center;justify-content:center;
    `;
    document.body.appendChild(modal);
  }

  function renderStep1() {
    modal.innerHTML = `
      <div style="width:340px;background:white;color:#111827;padding:24px;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.5);">
        <h2 style="margin-top:0;">💳 Pay with Visa / MasterCard</h2>
        <p style="color:#6b7280;font-size:13px;">TROR Sandbox — No real money</p>
        <input id="cardRecipientEmail" placeholder="Recipient Gmail"
          style="width:100%;padding:12px;margin-top:12px;background:#f9fafb;color:#111;border:1px solid #e5e7eb;border-radius:10px;box-sizing:border-box;" />
        <input id="cardAmount" placeholder="Amount USD" type="number"
          style="width:100%;padding:12px;margin-top:10px;background:#f9fafb;color:#111;border:1px solid #e5e7eb;border-radius:10px;box-sizing:border-box;" />
        <button id="btnStep1Continue"
          style="width:100%;padding:12px;margin-top:16px;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;border:0;border-radius:10px;font-weight:bold;font-size:15px;cursor:pointer;">
          Continue →
        </button>
        <button id="btnStep1Cancel"
          style="width:100%;padding:10px;margin-top:10px;background:#f3f4f6;color:#374151;border:0;border-radius:10px;cursor:pointer;">
          Cancel
        </button>
      </div>
    `;
    modal.style.display = "flex";
    document.getElementById("btnStep1Cancel").onclick = () => { modal.style.display = "none"; };
    document.getElementById("btnStep1Continue").onclick = () => {
      const email = document.getElementById("cardRecipientEmail").value.trim();
      const amount = document.getElementById("cardAmount").value.trim();
      if (!email || !amount) { alert("Please enter Gmail and amount."); return; }
      renderStep2(email, amount);
    };
  }

  function renderStep2(email, amount) {
    modal.innerHTML = `
      <div style="width:340px;background:white;color:#111827;padding:24px;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,.5);">
        <label style="font-size:12px;color:#6b7280;margin-bottom:4px;display:block;">
  Account Number
</label>

<div style="position:relative;margin-bottom:12px;">
  <input
    id="vcNumber"
    placeholder="•••• •••• •••• ••••"
    maxlength="19"
    type="password"
    autocomplete="off"
    style="
      width:100%;
      padding:12px 44px 12px 12px;
      background:#f9fafb;
      color:#111;
      border:1px solid #e5e7eb;
      border-radius:10px;
      box-sizing:border-box;
    "
  />

  <button
    id="toggleVcNumber"
    type="button"
    style="
  position:absolute;
  right:10px;
  top:50%;
  transform:translateY(-50%);
  background:transparent;
  border:0;
  cursor:pointer;
  font-size:18px;
  padding:0;
"
  >
    👁️
  </button>
</div>

<div style="display:flex;gap:10px;">

  <div style="flex:1;">
    <label style="font-size:12px;color:#6b7280;margin-bottom:4px;display:block;">
      Valid Until
    </label>

    <div style="position:relative;">
      <input
        id="vcExpiry"
        placeholder="••/••"
        maxlength="5"
        type="password"
        autocomplete="off"
        style="
          width:100%;
          padding:12px 44px 12px 12px;
          background:#f9fafb;
          color:#111;
          border:1px solid #e5e7eb;
          border-radius:10px;
          box-sizing:border-box;
        "
      />

      <button
        id="toggleVcExpiry"
        type="button"
        style="
  position:absolute;
  right:10px;
  top:50%;
  transform:translateY(-50%);
  background:transparent;
  border:0;
  cursor:pointer;
  font-size:18px;
  padding:0;
"
      >
        👁️
      </button>
    </div>
  </div>

  <div style="flex:1;">
    <label style="font-size:12px;color:#6b7280;margin-bottom:4px;display:block;">
      Security Code
    </label>

    <div style="position:relative;">
      <input
        id="vcCvv"
        placeholder="•••"
        maxlength="3"
        type="password"
        autocomplete="off"
        style="
          width:100%;
          padding:12px 44px 12px 12px;
          background:#f9fafb;
          color:#111;
          border:1px solid #e5e7eb;
          border-radius:10px;
          box-sizing:border-box;
        "
      />

      <button
        id="toggleVcCvv"
        type="button"
        style="
  position:absolute;
  right:10px;
  top:50%;
  transform:translateY(-50%);
  background:transparent;
  border:0;
  cursor:pointer;
  font-size:18px;
  padding:0;
"
      >
        👁️
      </button>
    </div>
  </div>

</div>

        <div style="margin-top:14px;padding:12px;background:#f0fdf4;border-radius:10px;font-size:14px;color:#166534;">
          📤 Sending <b>${amount} USDC</b> to <b>${email}</b>
        </div>

        <button id="btnPayNow"
          style="width:100%;padding:14px;margin-top:16px;background:linear-gradient(135deg,#10b981,#059669);color:white;border:0;border-radius:10px;font-weight:bold;font-size:15px;cursor:pointer;">
          💸 Pay Now
        </button>
        <button id="btnStep2Back"
          style="width:100%;padding:10px;margin-top:10px;background:#f3f4f6;color:#374151;border:0;border-radius:10px;cursor:pointer;">
          ← Back
        </button>
      </div>
    `;

    document.getElementById("vcNumber").oninput = (e) => {
      let v = e.target.value.replace(/\D/g, "").slice(0, 16);
      e.target.value = v.match(/.{1,4}/g)?.join(" ") || v;
    };

document.getElementById("toggleVcNumber").onclick = () => {
  const input = document.getElementById("vcNumber");
  input.type = input.type === "password" ? "text" : "password";
};

document.getElementById("toggleVcExpiry").onclick = () => {
  const input = document.getElementById("vcExpiry");
  input.type = input.type === "password" ? "text" : "password";
};

document.getElementById("toggleVcCvv").onclick = () => {
  const input = document.getElementById("vcCvv");
  input.type = input.type === "password" ? "text" : "password";
};

    document.getElementById("vcExpiry").oninput = (e) => {
      let v = e.target.value.replace(/\D/g, "").slice(0, 4);
      if (v.length >= 2) v = v.slice(0,2) + "/" + v.slice(2);
      e.target.value = v;
    };

    document.getElementById("btnStep2Back").onclick = renderStep1;
    document.getElementById("btnPayNow").onclick = () => processPayment(email, amount);
  }
  
  async function processPayment(email, amount, card) {

    modal.innerHTML = `
      <div style="background:white;padding:32px;border-radius:20px;text-align:center;color:#111;">
        <div style="font-size:40px;">⏳</div>
        <h3>Processing...</h3>
        <p style="color:#6b7280;">Sending ${amount} USDC to ${email}</p>
      </div>
    `;

    try {
      const res = await fetch(`${API_BASE}/api/claims/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: email,
          amount: amount,
          message: "Payment created through TROR sandbox preview",
          workspaceId: getCurrentWorkspace()?.id
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payment failed");

      modal.innerHTML = `
        <div style="background:white;padding:32px;border-radius:20px;text-align:center;color:#111;max-width:340px;">
          <div style="font-size:48px;">✅</div>
          <h2 style="color:#10b981;">Payment Successful!</h2>
          <p>${amount} USDC → <b>${email}</b></p>
          <a href="${data.claimLink}" target="_blank"
            style="display:block;margin:16px 0;padding:12px;background:#eff6ff;border-radius:10px;color:#2563eb;font-size:13px;word-break:break-all;">
            ${data.claimLink}
          </a>
          <button id="btnDone"
            style="width:100%;padding:12px;background:linear-gradient(135deg,#10b981,#059669);color:white;border:0;border-radius:10px;font-weight:bold;cursor:pointer;">
            Done ✓
          </button>
        </div>
      `;
      document.getElementById("btnDone").onclick = () => { modal.style.display = "none"; };

    } catch (err) {
      modal.innerHTML = `
        <div style="background:white;padding:32px;border-radius:20px;text-align:center;color:#111;max-width:340px;">
          <div style="font-size:48px;">❌</div>
          <h3 style="color:#ef4444;">Payment Failed</h3>
          <p>${err.message}</p>
          <button id="btnRetry"
            style="width:100%;padding:12px;margin-top:16px;background:#6366f1;color:white;border:0;border-radius:10px;cursor:pointer;">
            Try Again
          </button>
        </div>
      `;
      document.getElementById("btnRetry").onclick = renderStep1;
    }
  }

  renderStep1();
};

// API base URL
const API_BASE =
  window.location.port === "5173"
    ? "http://localhost:3000"
    : window.location.origin;

// Arc Network constants
const ARC_CHAIN_ID = 5042002;
const ARC_CHAIN_HEX = "0x4cef52";
const ARC_RPC =
  import.meta.env.VITE_ARC_RPC_URL ||
  "https://rpc.testnet.arc.network"
const ARC_EXPLORER = "https://testnet.arcscan.app";
const ARC_CHAIN_NAME = "Arc Testnet";

// USDC token address on Arc
const USDC_TOKEN = "0x3600000000000000000000000000000000000000";
const USDC_DECIMALS = 6;
const WEB3_USDC_BY_CHAIN = {
  // Arc Testnet
  5042002: "0x3600000000000000000000000000000000000000",

  // Ethereum Sepolia
  11155111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",

  // Base Sepolia
  84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",

  // Arbitrum Sepolia
  421614: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",

  // Avalanche Fuji
  43113: "0x5425890298aed601595a70AB815c96711a31Bc65",

  // Optimism Sepolia
  11155420: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",

  // Polygon Amoy
  80002: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",

  // Unichain Sepolia
  1301: "0x31d0220469e10c4E71834a79b1f276d740d3768F",
};

// Minimal ERC-20 ABI for transfer and balanceOf
const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" }
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    type: "function"
  },
  {
  "constant": false,
  "inputs": [
    {
      "name": "spender",
      "type": "address"
    },
    {
      "name": "amount",
      "type": "uint256"
    }
  ],
  "name": "approve",
  "outputs": [
    {
      "name": "",
      "type": "bool"
    }
  ],
  "type": "function"
},
  {
    constant: true,
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    type: "function"
  }
];

let selectedInvoice = null;
let metamaskWallet = null;
let activeWalletType = null; // "web3" | "circle"

function clearCircleWalletLocal() {
  // Clear Circle wallet from UI
  if (circleWalletEl) {
    circleWalletEl.textContent = "-";
  }

  // Clear Google email from UI
  if (emailEl) {
    emailEl.textContent = "-";
  }

  // Clear Google / Circle identity from browser
  localStorage.removeItem("googleUser");
  localStorage.removeItem("googleToken");
  localStorage.removeItem("circleUserToken");
  localStorage.removeItem("circleEncryptionKey");

  if (activeWalletType === "circle") {
    activeWalletType = null;
  }
}

function clearWeb3WalletLocal() {
  metamaskWallet = null;

  if (metamaskWalletEl) {
    metamaskWalletEl.textContent = "Disconnected";
  }

  updateWalletChip(null, null);

  if (activeWalletType === "web3") {
    activeWalletType = null;
  }
}

// DOM element references
const statusEl = document.getElementById("status");

const emailEl = document.getElementById("email");
const circleWalletEl = document.getElementById("circleWallet");
const metamaskWalletEl = document.getElementById("metamaskWallet");
const selectedInvoiceEl = document.getElementById("selectedInvoice");
const invoiceModalEl = document.getElementById("invoiceModal");
const closeInvoiceModalEl = document.getElementById("closeInvoiceModal");
const invoiceListEl = document.getElementById("invoiceList");
const qrBoxEl = document.getElementById("qrBox");
const titleEl = document.getElementById("title");
const amountEl = document.getElementById("amount");
const recipientEl = document.getElementById("recipient");
const noteEl = document.getElementById("note");
const btnGoogle = document.getElementById("btnGoogle");
const btnSetupPin = document.getElementById("btnSetupPin");
const btnConnectWallet = document.getElementById("btnConnectWallet");
const btnDisconnectWallet = document.getElementById("btnDisconnectWallet");
const btnSwitchArc = document.getElementById("btnSwitchArc");
const btnPay = document.getElementById("btnPay");
const walletProviderEl = document.getElementById("walletProvider");
const btnPayCircle = document.getElementById("btnPayCircle");
const btnCreateInvoice = document.getElementById("btnCreateInvoice");
const btnLoadInvoices = document.getElementById("btnLoadInvoices");
const btnRefresh = document.getElementById("btnRefresh");
const btnLogoutGoogle = document.getElementById("btnLogoutGoogle");
const bizNameEl = document.getElementById("bizName");
const bizEmailEl = document.getElementById("bizEmail");
const bizWalletEl = document.getElementById("bizWallet");
const btnSaveBiz = document.getElementById("btnSaveBiz");
const custNameEl = document.getElementById("custName");
const custEmailEl = document.getElementById("custEmail");
const custWalletEl = document.getElementById("custWallet");
const btnSaveCustomer = document.getElementById("btnSaveCustomer");
const customerSelectEl = document.getElementById("customerSelect");
const claimEmailEl = document.getElementById("claimEmail");
const claimAmountEl = document.getElementById("claimAmount");
const claimMessageEl = document.getElementById("claimMessage");
const btnSendClaimEmail = document.getElementById("btnSendClaimEmail");
const claimResultEl = document.getElementById("claimResult");
const isClaimPage = window.location.pathname.startsWith("/claim/");
const btnScanQR = document.getElementById("btnScanQR");
const btnVoiceInvoice = document.getElementById("btnVoiceInvoice");
const voiceLangEl = document.getElementById("voiceLang");
const qrScannerModal = document.getElementById("qrScannerModal");
const btnCloseScanner = document.getElementById("btnCloseScanner");
let qrScanner = null;

// Wallet chip and menu event listeners
document.getElementById("disconnectWalletChip")?.addEventListener("click", async () => {
  try {
    if (activeWalletType === "circle") {
      clearCircleWalletLocal();

      localStorage.removeItem("circleUserToken");
      localStorage.removeItem("circleEncryptionKey");
    }

    if (activeWalletType === "web3" || metamaskWallet) {
      try {
        await appKit?.disconnect?.();
      } catch {}

      clearWeb3WalletLocal();
    }

    activeWalletType = null;

    clearCircleWalletLocal();
    clearWeb3WalletLocal();

    updateWalletChip(null, null);

activeWalletType = null;

clearCircleWalletLocal();
clearWeb3WalletLocal();

updateWalletChip(null, null);

// Clear active identity/workspace session
localStorage.removeItem("currentUser");
localStorage.removeItem("currentWorkspace");
localStorage.removeItem("userWorkspaces");

// Clear workspace switcher from previous account
const workspaceSwitcher =
  document.getElementById("workspaceSwitcher");

if (workspaceSwitcher) {
  workspaceSwitcher.innerHTML = "";
  workspaceSwitcher.remove();
}

// Clear previous dashboard data
const resetDashboard = () => {
  const values = {
    dashTotal: "0.00 USDC",
    dashPaid: "0",
    dashPending: "0",
    dashLatestTx: "-",
    dashTotalInvoices: "0",
    dashTotalPayrolls: "0",
    dashTotalClaims: "0",
    dashTotalVolume: "0.00 USDC"
  };

  Object.entries(values).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
  });

  const activityFeed =
    document.getElementById("activityFeed");

  if (activityFeed) {
    activityFeed.innerHTML = "No activity yet.";
  }

  const activityTicker =
    document.getElementById("activityTicker");

  if (activityTicker) {
    activityTicker.innerHTML =
      `<button type="button" class="ticker-item">No recent activity yet.</button>`;
  }
};

resetDashboard();

renderCustomerDropdown();
loadWorkspaceClaims();
loadBusinessProfile();

document
  .getElementById("walletMenu")
  ?.classList.add("hidden");

setStatus("Wallet disconnected.", "success");

    document
      .getElementById("walletMenu")
      ?.classList.add("hidden");

    setStatus("Wallet disconnected.", "success");
  } catch (err) {
    console.error("Wallet disconnect error:", err);

    activeWalletType = null;
    clearCircleWalletLocal();
    clearWeb3WalletLocal();
    updateWalletChip(null, null);

    document
      .getElementById("walletMenu")
      ?.classList.add("hidden");
  }
});

document.getElementById("copyWalletAddress")?.addEventListener("click", async () => {
  const circleAddress =
    circleWalletEl?.textContent?.startsWith("0x")
      ? circleWalletEl.textContent.trim()
      : null;

  const activeAddress =
    activeWalletType === "circle"
      ? circleAddress
      : metamaskWallet || circleAddress;

  if (!activeAddress) {
    setStatus("No wallet connected.", "error");
    return;
  }

  await navigator.clipboard.writeText(activeAddress);
  setStatus("Wallet address copied.", "success");
});

document.getElementById("viewWalletExplorer")?.addEventListener("click", () => {
  const circleAddress =
    circleWalletEl?.textContent?.startsWith("0x")
      ? circleWalletEl.textContent.trim()
      : null;

  const activeAddress =
    activeWalletType === "circle"
      ? circleAddress
      : metamaskWallet || circleAddress;

  if (!activeAddress) {
    setStatus("No wallet connected.", "error");
    return;
  }

  window.open(
    `${ARC_EXPLORER}/address/${activeAddress}`,
    "_blank"
  );

  document
    .getElementById("walletMenu")
    ?.classList.add("hidden");
});

/* =========================
   WALLET — SEND USDC
========================= */

document
  .getElementById("btnWalletSend")
  ?.addEventListener("click", async () => {
    const circleAddress =
      circleWalletEl?.textContent?.startsWith("0x")
        ? circleWalletEl.textContent.trim()
        : null;

    const activeAddress =
      activeWalletType === "circle"
        ? circleAddress
        : metamaskWallet || circleAddress;

    if (!activeAddress) {
      setStatus("No wallet connected.", "error");
      return;
    }

    document
      .getElementById("walletMenu")
      ?.classList.add("hidden");

    let modal = document.getElementById("walletSendModal");

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "walletSendModal";

      modal.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 1000000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(0, 0, 0, 0.72);
        backdrop-filter: blur(10px);
      `;

      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="
        width:100%;
        max-width:420px;
        background:#121a2b;
        border:1px solid rgba(215,180,90,.35);
        border-radius:18px;
        padding:22px;
        color:#fff;
        box-shadow:0 24px 70px rgba(0,0,0,.45);
      ">

        <div style="
          color:#d8b46a;
          font-size:12px;
          font-weight:700;
          letter-spacing:.12em;
          margin-bottom:8px;
        ">
          TROR WALLET
        </div>

        <h2 style="margin:0 0 8px;">
          Send USDC
        </h2>

        <div style="
          color:#9da8ba;
          font-size:13px;
          margin-bottom:18px;
        ">
          Arc Testnet
        </div>

        <label style="
          display:block;
          font-size:12px;
          margin-bottom:6px;
        ">
          Recipient address
        </label>

        <input
          id="walletSendRecipient"
          type="text"
          placeholder="0x..."
          autocomplete="off"
          style="
            box-sizing:border-box;
            width:100%;
            padding:12px;
            margin-bottom:14px;
            border-radius:10px;
            border:1px solid rgba(255,255,255,.12);
            background:#090d16;
            color:#fff;
            outline:none;
          "
        />

        <label style="
          display:block;
          font-size:12px;
          margin-bottom:6px;
        ">
          Amount
        </label>

        <input
          id="walletSendAmount"
          type="number"
          min="0"
          step="0.000001"
          placeholder="0.00 USDC"
          style="
            box-sizing:border-box;
            width:100%;
            padding:12px;
            margin-bottom:16px;
            border-radius:10px;
            border:1px solid rgba(255,255,255,.12);
            background:#090d16;
            color:#fff;
            outline:none;
          "
        />

        <button
          id="confirmWalletSend"
          style="
            width:100%;
            padding:12px;
            border:0;
            border-radius:10px;
            cursor:pointer;
            font-weight:700;
            margin-bottom:10px;
          "
        >
          Review & Send
        </button>

        <button
          id="closeWalletSendModal"
          style="
            width:100%;
            padding:12px;
            border-radius:10px;
            cursor:pointer;
            background:transparent;
            border:1px solid rgba(255,255,255,.15);
            color:#fff;
          "
        >
          Close
        </button>

      </div>
    `;

    modal.style.display = "flex";

    document
      .getElementById("closeWalletSendModal")
      ?.addEventListener("click", () => {
        modal.style.display = "none";
      });

    document
  .getElementById("confirmWalletSend")
  ?.addEventListener("click", async () => {

const sendButton =
  document.getElementById("confirmWalletSend");

    const recipient =
      document
        .getElementById("walletSendRecipient")
        ?.value.trim();

    const amount =
      document
        .getElementById("walletSendAmount")
        ?.value.trim();

    // Validate recipient
    if (!recipient || !ethers.isAddress(recipient)) {
      setStatus("Enter a valid recipient address.", "error");
      return;
    }

    // Validate amount
    if (!amount || Number(amount) <= 0) {
      setStatus("Enter a valid USDC amount.", "error");
      return;
    }

    // Circle Wallet will be connected separately next
    if (activeWalletType === "circle") {
  try {
    const cfg = await api("/api/circle/config");
    const appId = cfg?.config?.circleAppId;

    if (!appId) {
      throw new Error("Missing CIRCLE_APP_ID.");
    }

    const { userToken, encryptionKey } = await getCircleAuth();

    setStatus("Loading Circle Wallet...");

    const activeCircleWallet =
  window.trorActiveCircleWallet;

if (
  !activeCircleWallet?.walletId ||
  !activeCircleWallet?.address
) {
  throw new Error(
    "Please select a Circle network first."
  );
}

const wallet = {
  id: activeCircleWallet.walletId,
  blockchain: activeCircleWallet.blockchain,
  address: activeCircleWallet.address
};

const walletAddress =
  activeCircleWallet.address;

const usdc = {
  tokenId: activeCircleWallet.tokenId,
  balance: Number(activeCircleWallet.balance || 0)
};

if (!usdc.tokenId) {
  throw new Error(
    `No USDC token found on ${activeCircleWallet.blockchain}.`
  );
}

if (
  !Number.isFinite(usdc.balance) ||
  usdc.balance < Number(amount)
) {
  throw new Error(
    `Not enough USDC on ${activeCircleWallet.blockchain}. Balance: ${usdc.balance} USDC`
  );
}

    const sdk = new W3SSdk({
  appSettings: { appId }
});

sdk.setAuthentication({
  userToken,
  encryptionKey
});

setStatus(
  `Circle Wallet: preparing ${wallet.blockchain} USDC transfer...`
);

console.log("TROR Circle Send source:", {
  blockchain: wallet.blockchain,
  walletId: wallet.id,
  tokenId: usdc.tokenId,
  balance: usdc.balance,
  from: walletAddress,
  to: recipient,
  amount
});

const transferData = await api(
  "/api/circle/transfer",
  {
    method: "POST",
    body: JSON.stringify({
      userToken,
      walletId: wallet.id,
      tokenId: usdc.tokenId,
      amount: String(amount),
      destinationAddress: recipient
    })
  }
);

console.log(
  "Circle token transfer response:",
  transferData
);

const challengeId =
  transferData?.data?.challengeId ||
  transferData?.challengeId;

if (!challengeId) {
  throw new Error(
    "No Circle transfer challengeId returned."
  );
}

if (sendButton) {
  sendButton.textContent = "Confirm in Circle Wallet...";
}

await new Promise((resolve, reject) => {
  sdk.execute(challengeId, (error, result) => {
    if (error) {
      reject(error);
      return;
    }

    console.log(
      "Circle USDC transfer approved:",
      result
    );

    resolve(result);
  });
});

setStatus(
  `Circle ${wallet.blockchain} transfer approved. Waiting for transaction...`,
  "success"
);

let txHash = "";

const expectedRecipient =
  String(recipient || "").toLowerCase();

const expectedAmount =
  Number(amount);

for (let i = 0; i < 30; i++) {
  await new Promise((resolve) =>
    setTimeout(resolve, 3000)
  );

  const txData = await api(
    "/api/circle/transactions",
    {
      method: "POST",
      body: JSON.stringify({ userToken })
    }
  );

  const transactions =
    txData?.data?.transactions || [];

  const tx = transactions.find((item) => {
    const hash =
      item?.blockchainTxHash ||
      item?.txHash ||
      item?.transactionHash ||
      "";

    const state =
      String(
        item?.state ||
        item?.status ||
        ""
      ).toUpperCase();

    const operation =
      String(item?.operation || "").toUpperCase();

    const sameWallet =
      String(item?.walletId || "") ===
      String(wallet.id);

    const sameRecipient =
      String(
        item?.destinationAddress || ""
      ).toLowerCase() === expectedRecipient;

    const txAmount =
      Array.isArray(item?.amounts)
        ? Number(item.amounts[0] || 0)
        : Number(item?.amount || 0);

    const sameAmount =
      Math.abs(txAmount - expectedAmount) < 0.000001;

    return (
      operation === "TRANSFER" &&
      state === "COMPLETE" &&
      sameWallet &&
      sameRecipient &&
      sameAmount &&
      hash.startsWith("0x")
    );
  });

  txHash =
    tx?.blockchainTxHash ||
    tx?.txHash ||
    tx?.transactionHash ||
    "";

  if (txHash) {
    console.log(
      "TROR Circle transfer transaction found:",
      tx
    );
    break;
  }
}

if (!txHash) {
  console.log(
    "Circle transfer submitted successfully. Transaction is still confirming on-chain."
  );

  setStatus(
    `Sent ${amount} USDC on ${wallet.blockchain}. Transaction is still confirming on-chain.`,
    "success"
  );

  await loadCircleWallet(userToken);

  modal.style.display = "none";

  return;
}

setStatus(
  `Sent ${amount} USDC on ${wallet.blockchain} successfully. TX: ${txHash}`,
  "success"
);

console.log("TROR Circle USDC transfer:", {
  blockchain: wallet.blockchain,
  walletId: wallet.id,
  tokenId: usdc.tokenId,
  from: walletAddress,
  to: recipient,
  amount,
  txHash
});

await loadCircleWallet(userToken);

modal.style.display = "none";

return;

  } catch (err) {
    console.error(
      "TROR Circle Send USDC error:",
      err
    );

    setStatus(
      err?.message || "Circle USDC transfer failed.",
      "error"
    );

    return;
  }
}

    try {
      const config = wagmiAdapter.wagmiConfig;

      const account = getAccount(config);

      if (!account?.address) {
        setStatus("Connect your Web3 wallet first.", "error");
        return;
      }

const activeChainId = Number(account.chainId);

const web3UsdcToken =
  WEB3_USDC_BY_CHAIN[activeChainId];

if (!web3UsdcToken) {
  setStatus(
    `USDC is not configured for chain ${activeChainId}.`,
    "error"
  );
  return;
}

console.log("TROR Web3 Send network:", {
  chainId: activeChainId,
  usdcToken: web3UsdcToken
});

      if (sendButton) {
        sendButton.disabled = true;
        sendButton.textContent = "Confirm in wallet...";
      }

      setStatus(
        `Preparing ${amount} USDC transfer...`,
        "success"
      );

      const amountUnits = parseUnits(
        amount,
        USDC_DECIMALS
      );

const tokenInterface =
  new ethers.Interface(ERC20_ABI);

const transferData =
  tokenInterface.encodeFunctionData(
    "transfer",
    [
      recipient,
      amountUnits
    ]
  );

setStatus(
  "TROR is selecting the best gas mode...",
  "success"
);

const gasResult =
  await executeTrorGasCalls({
    calls: [
      {
        to: web3UsdcToken,
        value: 0n,
        data: transferData
      }
    ]
  });

console.log(
  "TROR Web3 USDC gas execution:",
  gasResult
);

let hash = "";

/*
  Arc / normal native-gas path
*/
if (
  gasResult.execution
    ?.transactionHashes
    ?.length
) {
  hash =
    gasResult.execution
      .transactionHashes[0];

  if (sendButton) {
    sendButton.textContent =
      "Sending USDC...";
  }

  setStatus(
    "Transaction submitted. Waiting for confirmation...",
    "success"
  );

  const receipt =
    await waitForTransactionReceipt(
      config,
      {
        hash
      }
    );

  if (
    receipt.status !== "success"
  ) {
    throw new Error(
      "USDC transfer failed."
    );
  }
}

/*
  MetaMask wallet-sponsored path
  EIP-7702 + wallet_sendCalls
*/
else if (
  gasResult.execution
    ?.callBundleId
) {
  const bundleId =
    gasResult.execution
      .callBundleId;

  if (sendButton) {
    sendButton.textContent =
      "Waiting for wallet...";
  }

  setStatus(
    "Wallet-sponsored transaction submitted...",
    "success"
  );

  let callStatus = null;

  for (
    let i = 0;
    i < 30;
    i++
  ) {
    await new Promise(
      (resolve) =>
        setTimeout(resolve, 2000)
    );

    callStatus =
      await getTrorCallStatus({
        bundleId
      });

    if (
      Number(callStatus?.status) ===
      200
    ) {
      break;
    }
  }

  if (
    Number(callStatus?.status) !==
    200
  ) {
    throw new Error(
      "Wallet transaction is still pending."
    );
  }

  hash =
    callStatus
      ?.receipts?.[0]
      ?.transactionHash ||
    "";

  console.log(
    "TROR wallet-sponsored USDC completed:",
    {
      bundleId,
      callStatus,
      hash
    }
  );
}

else {
  throw new Error(
    "TROR gas executor returned no transaction result."
  );
}

setStatus(
  hash
    ? `Sent ${amount} USDC successfully. TX: ${hash}`
    : `Sent ${amount} USDC successfully.`,
  "success"
);

const refreshedAccount =
  getAccount(config);

const refreshedBalance =
  await loadWeb3UsdcBalance(
    refreshedAccount
  );

const web3BalanceEl =
  document.getElementById(
    "web3UsdcBalance"
  );

if (
  web3BalanceEl &&
  refreshedBalance !== null
) {
  web3BalanceEl.textContent =
    `${refreshedBalance} USDC`;
}

      console.log("TROR USDC transfer successful:", {
        from: account.address,
        to: recipient,
        amount,
        hash
      });

      modal.style.display = "none";

    } catch (err) {
      console.error("TROR Send USDC error:", err);

      const message =
        err?.shortMessage ||
        err?.message ||
        "USDC transfer failed.";

      setStatus(message, "error");

    } finally {
      const sendButton =
        document.getElementById("confirmWalletSend");

      if (sendButton) {
        sendButton.disabled = false;
        sendButton.textContent = "Review & Send";
      }
    }
  });
  });

// =========================
// WALLET RECEIVE
// =========================

document
  .getElementById("btnWalletReceive")
  ?.addEventListener("click", async () => {
    const circleAddress =
      circleWalletEl?.textContent?.startsWith("0x")
        ? circleWalletEl.textContent.trim()
        : null;

    const activeAddress =
      activeWalletType === "circle"
        ? circleAddress
        : metamaskWallet || circleAddress;

    if (!activeAddress) {
      setStatus("No wallet connected.", "error");
      return;
    }

    document
      .getElementById("walletMenu")
      ?.classList.add("hidden");

    let modal =
      document.getElementById("walletReceiveModal");

    if (!modal) {
      modal = document.createElement("div");
      modal.id = "walletReceiveModal";

      modal.style.cssText = `
        position: fixed;
        inset: 0;
        z-index: 1000000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(0, 0, 0, 0.72);
        backdrop-filter: blur(10px);
      `;

      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="
        width:100%;
        max-width:420px;
        background:#121a2b;
        border:1px solid rgba(215,180,90,.35);
        border-radius:18px;
        padding:22px;
        color:#fff;
        box-shadow:0 24px 70px rgba(0,0,0,.45);
      ">
        <div style="
          color:#d8b45a;
          font-size:12px;
          font-weight:700;
          letter-spacing:.12em;
          margin-bottom:8px;
        ">
          TROR WALLET
        </div>

        <h2 style="margin:0 0 8px;">
          Receive USDC
        </h2>

        <div style="
          color:#9da8ba;
          font-size:13px;
          margin-bottom:18px;
        ">
          Arc Testnet
        </div>

<div
  id="receiveQrBox"
  style="
    width:190px;
    height:190px;
    margin:0 auto 18px;
    padding:10px;
    background:#ffffff;
    border-radius:14px;
    display:flex;
    align-items:center;
    justify-content:center;
  "
></div>

        <div style="
          padding:14px;
          background:#090d16;
          border:1px solid rgba(255,255,255,.08);
          border-radius:12px;
          word-break:break-all;
          font-family:monospace;
          font-size:13px;
          margin-bottom:14px;
        ">
          ${activeAddress}
        </div>

        <button
          id="receiveCopyAddress"
          style="
            width:100%;
            padding:12px;
            border:0;
            border-radius:10px;
            cursor:pointer;
            font-weight:700;
            margin-bottom:10px;
          "
        >
          Copy Address
        </button>

        <button
          id="closeReceiveModal"
          style="
            width:100%;
            padding:12px;
            border-radius:10px;
            cursor:pointer;
            background:transparent;
            border:1px solid rgba(255,255,255,.15);
            color:#fff;
          "
        >
          Close
        </button>
      </div>
    `;

    modal.style.display = "flex";

    const receiveQrBox = document.getElementById("receiveQrBox");

if (receiveQrBox) {
  try {
    const qrDataUrl = await QRCode.toDataURL(activeAddress, {
      width: 190,
      margin: 1
    });

    receiveQrBox.innerHTML = `
      <img
        src="${qrDataUrl}"
        alt="Receive wallet QR"
        style="
          width:100%;
          height:100%;
          display:block;
        "
      />
    `;
  } catch (err) {
    console.error("Receive QR error:", err);
    receiveQrBox.innerHTML = "QR unavailable";
  }
}

    document
      .getElementById("receiveCopyAddress")
      ?.addEventListener("click", async () => {
        await navigator.clipboard.writeText(activeAddress);
        setStatus("Wallet address copied.", "success");
      });

    document
      .getElementById("closeReceiveModal")
      ?.addEventListener("click", () => {
        modal.style.display = "none";
      });
  });

/* =========================
   TOAST & STATUS
========================= */

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.className = `toast show ${type}`;

  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => {
    toast.className = "toast hidden";
  }, 3200);
}

function setStatus(message, type = "") {
  if (statusEl) {
    statusEl.className = type;
    statusEl.textContent = message;
  }
  if (message) {
    showToast(message, type || "success");
  }
}

function openCreateProfileModal(walletAddress) {
  let modal = document.getElementById("createProfileModal");

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "createProfileModal";

    modal.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 1000001;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(2, 6, 23, 0.84);
      backdrop-filter: blur(10px);
    `;

    document.body.appendChild(modal);
  }

  const googleUser = getGoogleUser();

  modal.innerHTML = `
    <div style="
      width:100%;
      max-width:430px;
      padding:28px;
      border-radius:24px;
      color:#f8fafc;
      background:
        linear-gradient(
          145deg,
          rgba(30,41,59,.98),
          rgba(15,23,42,.98)
        );
      border:1px solid rgba(250,204,21,.34);
      box-shadow:0 28px 80px rgba(0,0,0,.58);
    ">
      <div style="
        font-size:12px;
        font-weight:800;
        letter-spacing:.16em;
        color:#facc15;
        margin-bottom:8px;
      ">
        TROR IDENTITY
      </div>

      <h2 style="margin:0 0 8px;font-size:26px;">
        Create your profile
      </h2>

      <p style="
        margin:0 0 22px;
        color:#94a3b8;
        line-height:1.55;
        font-size:14px;
      ">
        Create your TROR identity and personal workspace.
      </p>

      <label style="
        display:block;
        margin-bottom:6px;
        font-size:13px;
        color:#cbd5e1;
      ">
        Full Name
      </label>

      <input
        id="profileFullName"
        type="text"
        value="${escapeHtml(googleUser.name || "")}"
        placeholder="Enter your full name"
        style="
          width:100%;
          box-sizing:border-box;
          padding:13px 14px;
          margin-bottom:15px;
          border-radius:12px;
          border:1px solid rgba(148,163,184,.28);
          background:rgba(15,23,42,.82);
          color:#f8fafc;
          outline:none;
        "
      />

      <label style="
        display:block;
        margin-bottom:6px;
        font-size:13px;
        color:#cbd5e1;
      ">
        Email
      </label>

      <input
        id="profileEmail"
        type="email"
        value="${escapeHtml(googleUser.email || "")}"
        placeholder="name@example.com"
        style="
          width:100%;
          box-sizing:border-box;
          padding:13px 14px;
          margin-bottom:15px;
          border-radius:12px;
          border:1px solid rgba(148,163,184,.28);
          background:rgba(15,23,42,.82);
          color:#f8fafc;
          outline:none;
        "
      />

      <label style="
        display:block;
        margin-bottom:6px;
        font-size:13px;
        color:#cbd5e1;
      ">
        Account Type
      </label>

      <select
        id="profileAccountType"
        style="
          width:100%;
          box-sizing:border-box;
          padding:13px 14px;
          margin-bottom:10px;
          border-radius:12px;
          border:1px solid rgba(148,163,184,.28);
          background:#0f172a;
          color:#f8fafc;
          outline:none;
        "
      >
        <option value="PERSONAL">Personal</option>
        <option value="BUSINESS">Business</option>
      </select>

      <div style="
        margin:14px 0 20px;
        padding:12px;
        border-radius:12px;
        background:rgba(250,204,21,.08);
        border:1px solid rgba(250,204,21,.2);
        font-size:12px;
        color:#fde68a;
        word-break:break-all;
      ">
        Wallet: ${escapeHtml(walletAddress)}
      </div>

      <div
        id="profileModalError"
        style="
          display:none;
          margin-bottom:14px;
          padding:10px 12px;
          border-radius:10px;
          color:#fecaca;
          background:rgba(239,68,68,.12);
          border:1px solid rgba(239,68,68,.24);
          font-size:13px;
        "
      ></div>

      <button
        id="btnCreateProfile"
        type="button"
        style="
          width:100%;
          padding:14px;
          border:0;
          border-radius:12px;
          cursor:pointer;
          font-weight:800;
          font-size:15px;
          color:#111827;
          background:
            linear-gradient(135deg,#fde68a,#facc15,#d4a017);
        "
      >
        Create Profile
      </button>

      <button
        id="btnCancelProfile"
        type="button"
        style="
          width:100%;
          padding:12px;
          margin-top:10px;
          border-radius:12px;
          cursor:pointer;
          color:#cbd5e1;
          background:transparent;
          border:1px solid rgba(148,163,184,.2);
        "
      >
        Disconnect
      </button>
    </div>
  `;

  modal.style.display = "flex";

  document.getElementById("btnCancelProfile").onclick = () => {
    modal.style.display = "none";

    localStorage.removeItem("currentUser");
    localStorage.removeItem("currentWorkspace");

    appKit?.disconnect?.();
  };

  document.getElementById("btnCreateProfile").onclick =
    async () => {
      const button =
        document.getElementById("btnCreateProfile");

      const errorEl =
        document.getElementById("profileModalError");

      const fullName = String(
        document.getElementById("profileFullName")?.value || ""
      ).trim();

      const email = String(
        document.getElementById("profileEmail")?.value || ""
      )
        .trim()
        .toLowerCase();

      const accountType = String(
        document.getElementById("profileAccountType")?.value ||
          "PERSONAL"
      )
        .trim()
        .toUpperCase();

      errorEl.style.display = "none";
      errorEl.textContent = "";

      if (!fullName) {
        errorEl.textContent = "Full name is required.";
        errorEl.style.display = "block";
        return;
      }

      try {
        button.disabled = true;
        button.textContent = "Creating Profile...";

        const data = await api("/api/users", {
          method: "POST",
          body: JSON.stringify({
            fullName,
            email,
            accountType,
            walletAddress
          })
        });

        localStorage.setItem(
          "currentUser",
          JSON.stringify(data.user)
        );

        localStorage.setItem(
          "currentWorkspace",
          JSON.stringify(data.workspace)
        );

const shouldReturnToInvoice =
  Boolean(
    localStorage.getItem("invoiceReturnPath")
  );

await loadUserWorkspaces(walletAddress);

if (shouldReturnToInvoice) {
  await restoreInvoiceAfterConnect();
}

modal.style.display = "none";

setStatus(
  "TROR profile created successfully.",
  "success"
);

if (!shouldReturnToInvoice) {
  showTab("dashboard");
  updateTopbarTitle("dashboard");
  window.location.hash = "dashboard";
}

      } catch (err) {
        console.error("Create profile error:", err);

        errorEl.textContent =
          err.message || "Failed to create profile.";

        errorEl.style.display = "block";
      } finally {
        button.disabled = false;
        button.textContent = "Create Profile";
      }
    };
}

/* =========================
   API HELPER
========================= */

async function api(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || data?.message || JSON.stringify(data));
  }

  return data;
}

/* =========================
   FORMATTING HELPERS
========================= */

function formatUsdc(value) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 6
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getGoogleUser() {
  try {
    return JSON.parse(localStorage.getItem("googleUser") || "{}");
  } catch {
    return {};
  }
}

// Convert decimal amount to token smallest units
function toTokenUnits(amount, decimals) {
  const text = String(amount || "0").trim();
  const [wholeRaw, fracRaw = ""] = text.split(".");
  const whole = wholeRaw || "0";
  const frac = fracRaw.slice(0, decimals).padEnd(decimals, "0");
  const combined = `${whole}${frac}`.replace(/^0+/, "");
  return combined || "0";
}

/* =========================
   CUSTOMER
========================= */

function getCurrentWorkspace() {
  try {
    return JSON.parse(
      localStorage.getItem("currentWorkspace") || "null"
    );
  } catch {
    return null;
  }
}

function getCustomerStorageKey() {
  const workspace = getCurrentWorkspace();

  if (!workspace?.id) {
    return null;
  }

  return `customers:${workspace.id}`;
}

function getWorkspaceCustomers() {
  const storageKey = getCustomerStorageKey();

  if (!storageKey) {
    return [];
  }

  try {
    return JSON.parse(
      localStorage.getItem(storageKey) || "[]"
    );
  } catch {
    return [];
  }
}

function saveWorkspaceCustomers(customers) {
  const storageKey = getCustomerStorageKey();

  if (!storageKey) {
    throw new Error("Please select a workspace first.");
  }

  localStorage.setItem(
    storageKey,
    JSON.stringify(customers)
  );
}

function saveCustomer() {
  try {
    const currentWorkspace = getCurrentWorkspace();

    if (!currentWorkspace?.id) {
      setStatus(
        "Please select a workspace first.",
        "error"
      );
      return;
    }

    const customer = {
      id:
        globalThis.crypto?.randomUUID?.() ||
        `cust_${Date.now()}`,

      name: String(custNameEl?.value || "").trim(),

      email: String(custEmailEl?.value || "")
        .trim()
        .toLowerCase(),

      wallet: String(custWalletEl?.value || "")
        .trim(),

      workspaceId: currentWorkspace.id,

      createdAt: new Date().toISOString()
    };

    if (!customer.name) {
      setStatus(
        "Customer name is required.",
        "error"
      );
      return;
    }

    if (
      customer.wallet &&
      !/^0x[a-fA-F0-9]{40}$/.test(customer.wallet)
    ) {
      setStatus(
        "Customer wallet address is invalid.",
        "error"
      );
      return;
    }

    const customers = getWorkspaceCustomers();

    customers.push(customer);

    saveWorkspaceCustomers(customers);

    if (custNameEl) custNameEl.value = "";
    if (custEmailEl) custEmailEl.value = "";
    if (custWalletEl) custWalletEl.value = "";

    renderCustomerDropdown();

    setStatus(
      `Customer saved to ${currentWorkspace.workspace_name}.`,
      "success"
    );
  } catch (err) {
    console.error("Save customer error:", err);

    setStatus(
      "Save customer failed: " + err.message,
      "error"
    );
  }
}

/* =========================
   GMAIL CLAIM
========================= */

async function sendClaimEmail() {
  try {
    const currentWorkspace = getCurrentWorkspace();

if (!currentWorkspace?.id) {
  setStatus(
    "Please select a workspace first.",
    "error"
  );
  return;
}

    const recipientEmail = claimEmailEl.value.trim().toLowerCase();
    const amount = claimAmountEl.value;
    const memo = claimMessageEl.value || "";

    if (!recipientEmail || !amount) {
      setStatus("Please enter recipient email and amount.", "error");
      return;
    }

    const config = wagmiAdapter.wagmiConfig;
    const account = getAccount(config);

    if (!account.isConnected || !account.address) {
      setStatus("Please connect a Web3 wallet first.", "error");
      await openAppKitWallet();
      return;
    }

    setStatus("Preparing Gmail Claim on-chain...");

    const amountUnits = ethers.parseUnits(String(amount), 6);

    const emailHash = ethers.keccak256(
      ethers.toUtf8Bytes(recipientEmail)
    );

    const expiresAt =
      Math.floor(Date.now() / 1000) +
      30 * 24 * 60 * 60;

    setStatus("Approving USDC for Claim contract...");

    const approveHash = await writeContract(config, {
      address: USDC_TOKEN,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [
        CLAIM_CONTRACT_ADDRESS,
        amountUnits
      ],
      account: account.address,
      chainId: 5042002
    });

    await waitForTransactionReceipt(config, {
      hash: approveHash
    });

    setStatus("Creating Gmail Claim on-chain...");

const CREATE_CLAIM_ABI = [
  {
    type: "function",
    name: "createClaim",
    stateMutability: "nonpayable",
    inputs: [
      { name: "emailHash", type: "bytes32" },
      { name: "amount", type: "uint256" },
      { name: "memo", type: "string" },
      { name: "expiresAt", type: "uint256" }
    ],
    outputs: [
      { name: "", type: "uint256" }
    ]
  }
];

    const createHash = await writeContract(config, {
      address: CLAIM_CONTRACT_ADDRESS,
      abi: CREATE_CLAIM_ABI,
      functionName: "createClaim",
      args: [
        emailHash,
        amountUnits,
        memo,
        BigInt(expiresAt)
      ],
      account: account.address,
      chainId: 5042002
    });

    const receipt = await waitForTransactionReceipt(config, {
      hash: createHash
    });

    let onchainClaimId = null;

    const claimInterface = new ethers.Interface([
  "event ClaimCreated(uint256 indexed claimId, address indexed sender, bytes32 indexed emailHash, uint256 amount, string memo, uint256 expiresAt)"
]);

    for (const log of receipt.logs || []) {
      try {
        const parsed = claimInterface.parseLog({
          topics: log.topics,
          data: log.data
        });

        if (
          parsed &&
          parsed.name === "ClaimCreated"
        ) {
          onchainClaimId =
            parsed.args.claimId.toString();

          break;
        }
      } catch {}
    }

    if (!onchainClaimId) {
      throw new Error(
        "Could not read on-chain claimId."
      );
    }

    const data = await api(
      "/api/claims/send-email",
      {
        method: "POST",
        body: JSON.stringify({
          claimId: onchainClaimId,
          recipientEmail,
          amount,
          message: memo,
          txHash: createHash,
          workspaceId: currentWorkspace.id
        })
      }
    );

    claimResultEl.innerHTML = `
      <div style="margin-bottom:12px;">
        Status:
        <span id="claimStatus">PENDING</span>
      </div>

      <div style="margin-bottom:12px;">
        <a
          href="${data.claimLink}"
          target="_blank"
          style="color:#67e8f9;font-weight:bold;"
        >
          Open Claim Page
        </a>
      </div>

      <div style="word-break:break-all;">
        ${data.claimLink}
      </div>

      <div
        id="claimInfo"
        style="margin-top:12px;"
      ></div>
    `;

await loadWorkspaceClaims();

    setInterval(async () => {
      try {
        const res = await fetch(
          `/api/claims/${onchainClaimId}`
        );

        const claim = await res.json();

        if (claim.status === "CLAIMED") {
          document.getElementById(
            "claimStatus"
          ).innerHTML = "CLAIMED ✅";

          document.getElementById(
            "claimInfo"
          ).innerHTML = `
            <div>
              Wallet:
              ${claim.walletAddress || "-"}
            </div>

            <div>
              Tx:
              ${claim.txHash || "-"}
            </div>

            <div>
              Claimed At:
              ${claim.claimedAt || "-"}
            </div>
          `;
        }
      } catch (err) {
        console.error(err);
      }
    }, 5000);

    document.getElementById(
      "btnCardPayment"
    )?.addEventListener("click", () => {
      alert(
        "Visa/Mastercard flow coming soon"
      );
    });

    setStatus(
      "Claim email sent.",
      "success"
    );
  } catch (err) {
    console.error("Send claim error:", err);

    setStatus(
      "Send claim email failed: " +
      (err.message || String(err)),
      "error"
    );
  }
}

function getClaimHistoryElement() {
  let claimHistoryEl =
    document.getElementById("claimHistory");

  if (claimHistoryEl) {
    return claimHistoryEl;
  }

  claimHistoryEl = document.createElement("div");
  claimHistoryEl.id = "claimHistory";

  claimHistoryEl.style.cssText = `
    margin-top: 20px;
    padding: 18px;
    border: 1px solid rgba(148, 163, 184, 0.28);
    border-radius: 18px;
    background: rgba(15, 23, 42, 0.36);
  `;

  claimHistoryEl.innerHTML = `
    <h3 style="margin:0 0 14px;">
      Claim History
    </h3>

    <div id="claimHistoryList">
      No claims yet.
    </div>
  `;

  if (claimResultEl?.parentElement) {
    claimResultEl.parentElement.appendChild(
      claimHistoryEl
    );
  }

  return claimHistoryEl;
}

async function loadWorkspaceClaims() {
  try {
    const currentWorkspace =
      getCurrentWorkspace();

    const claimHistoryEl =
      getClaimHistoryElement();

    const claimHistoryList =
      claimHistoryEl?.querySelector(
        "#claimHistoryList"
      );

    if (!claimHistoryList) {
      return [];
    }

    if (!currentWorkspace?.id) {
      claimHistoryList.innerHTML =
        `<div>Please select a workspace.</div>`;

      return [];
    }

    claimHistoryList.innerHTML =
      `<div>Loading claims...</div>`;

    const data = await api(
      "/api/claims?workspaceId=" +
        encodeURIComponent(currentWorkspace.id)
    );

    const claims = data.claims || [];

    if (!claims.length) {
      claimHistoryList.innerHTML =
        `<div>No claims yet.</div>`;

      return [];
    }

    claimHistoryList.innerHTML = "";

    claims.forEach((claim) => {
      const card = document.createElement("div");

      card.style.cssText = `
        padding: 14px;
        margin-bottom: 10px;
        border: 1px solid rgba(148,163,184,.25);
        border-radius: 14px;
        background: rgba(2,6,23,.42);
      `;

      const createdAt = claim.createdAt
        ? new Date(claim.createdAt)
            .toLocaleString()
        : "-";

      card.innerHTML = `
        <div>
          <b>${escapeHtml(
            claim.recipientEmail || ""
          )}</b>
        </div>

        <div>
          ${Number(claim.amount || 0)} USDC
        </div>

        <div>
          Status:
          <b>${escapeHtml(
            claim.status || "PENDING"
          )}</b>
        </div>

        <div>
          Created: ${escapeHtml(createdAt)}
        </div>

        <div style="margin-top:8px;">
          <a
            href="/claim/${encodeURIComponent(
              claim.id
            )}"
            target="_blank"
            style="color:#67e8f9;"
          >
            Open Claim
          </a>
        </div>
      `;

      claimHistoryList.appendChild(card);
    });

    return claims;
  } catch (err) {
    console.error(
      "Load workspace claims error:",
      err
    );

    const claimHistoryList =
      document.getElementById(
        "claimHistoryList"
      );

    if (claimHistoryList) {
      claimHistoryList.innerHTML =
        `<div>Failed to load claims.</div>`;
    }

    return [];
  }
}

/* =========================
   QR CODE
========================= */

function getInvoicePayUrl(inv) {
  return `${window.location.origin}/app.html?invoice=${encodeURIComponent(inv.id)}`;
}

function renderQR(inv) {
  if (!qrBoxEl) return;

  if (!inv || !inv.id) {
    qrBoxEl.innerHTML = `<div class="qr-empty">Open an invoice to show QR.</div>`;
    return;
  }

  const payUrl = getInvoicePayUrl(inv);
  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(payUrl);

  qrBoxEl.innerHTML = `
    <div class="qr-wrap">
      <img src="${qrUrl}" alt="Invoice QR" />
      <div>
        <div><b>Payment Link</b></div>
        <div><a href="${payUrl}" target="_blank" rel="noreferrer">${payUrl}</a></div>
        <div class="row">
          <button id="btnCopyLink" class="secondary">Copy Link</button>
          <button id="btnCopyRecipient" class="secondary">Copy Recipient</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById("btnCopyLink")?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(payUrl);
    setStatus("Payment link copied.", "success");
  });

  document.getElementById("btnCopyRecipient")?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(inv.recipientAddress);
    setStatus("Recipient address copied.", "success");
  });
}

// Open QR scanner
btnScanQR?.addEventListener("click", async () => {
  try {
    qrScannerModal?.classList.remove("hidden");
    qrScanner = new Html5Qrcode("qrScanner");

    await qrScanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: 250 },
      async (decodedText) => {
        await qrScanner.stop();
        qrScannerModal?.classList.add("hidden");

        const url = new URL(decodedText);
        const invoiceId = url.searchParams.get("invoice");

        if (invoiceId) {
          await openInvoice(invoiceId);
          setStatus("Invoice scanned. Ready to pay.", "success");

          if (navigator.vibrate) navigator.vibrate(120);

          setTimeout(() => {
            document.getElementById("sheetPayInvoice")?.scrollIntoView({
              behavior: "smooth",
              block: "center"
            });
          }, 400);
        } else {
          setStatus("QR does not contain invoice id.", "error");
        }
      }
    );
  } catch (err) {
    setStatus("QR scanner failed: " + err.message, "error");
  }
});

// Close QR scanner
btnCloseScanner?.addEventListener("click", async () => {
  try {
    if (qrScanner) await qrScanner.stop();
  } catch {}
  qrScannerModal?.classList.add("hidden");
});

qrScannerModal?.addEventListener("click", (e) => {
  if (e.target === qrScannerModal) {
    qrScannerModal.classList.add("hidden");
    stopQRScanner?.();
  }
});

/* =========================
   CIRCLE WALLET HELPERS
========================= */

function getPrimaryCircleAddress(wallets = []) {
  const counts = new Map();

  for (const wallet of wallets) {
    const address =
      wallet?.address ||
      wallet?.walletAddress ||
      wallet?.accounts?.[0]?.address ||
      "";

    const normalized =
      String(address).trim().toLowerCase();

    if (!normalized.startsWith("0x")) continue;

    counts.set(
      normalized,
      (counts.get(normalized) || 0) + 1
    );
  }

  let primaryAddress = "";
  let highestCount = 0;

  for (const [address, count] of counts.entries()) {
    if (count > highestCount) {
      primaryAddress = address;
      highestCount = count;
    }
  }

  console.log(
    "TROR primary Circle address:",
    primaryAddress,
    "network count:",
    highestCount
  );

  return primaryAddress;
}

// Extract wallet object from Circle API response
function extractWallet(data) {
  const wallets =
    data?.data?.wallets ||
    data?.wallets ||
    [];

  const primaryAddress =
    getPrimaryCircleAddress(wallets);

  const primaryArcWallet =
    wallets.find((wallet) => {
      const blockchain =
        String(
          wallet?.blockchain || ""
        ).toUpperCase();

      const address =
        String(
          wallet?.address ||
          wallet?.walletAddress ||
          wallet?.accounts?.[0]?.address ||
          ""
        ).toLowerCase();

      return (
        blockchain === "ARC-TESTNET" &&
        address === primaryAddress
      );
    });

  return (
    primaryArcWallet ||
    wallets.find(
      (wallet) =>
        String(
          wallet?.blockchain || ""
        ).toUpperCase() === "ARC-TESTNET"
    ) ||
    wallets[0] ||
    data?.data?.wallet ||
    data?.wallet ||
    null
  );
}

// Extract all Circle wallets for multi-chain support
function extractCircleWallets(data) {
  const wallets =
    data?.data?.wallets ||
    data?.wallets ||
    [];

  return Array.isArray(wallets)
    ? wallets.filter(Boolean)
    : [];
}

function getCircleWalletByBlockchain(data, blockchain) {
  const wallets = extractCircleWallets(data);

  return (
    wallets.find(
      (wallet) =>
        String(wallet?.blockchain || "").toUpperCase() ===
        String(blockchain || "").toUpperCase()
    ) || null
  );
}

// Extract wallet address from Circle API response
function extractWalletAddress(data) {
  const wallet = extractWallet(data);
  return (
    wallet?.address ||
    wallet?.walletAddress ||
    wallet?.accounts?.[0]?.address ||
    null
  );
}

// Get Circle auth tokens for current Google user
async function getCircleAuth() {
  const user = getGoogleUser();

  if (!user.email) {
    throw new Error("Login Google / Circle first.");
  }

  const tokenData = await api("/api/circle/user-token", {
    method: "POST",
    body: JSON.stringify({ email: user.email })
  });

  const userToken = tokenData?.data?.userToken || tokenData?.userToken;
  const encryptionKey = tokenData?.data?.encryptionKey || tokenData?.encryptionKey;

  if (!userToken || !encryptionKey) {
    console.log("Circle token response:", tokenData);
    throw new Error("Missing Circle userToken or encryptionKey.");
  }

  localStorage.setItem("circleUserToken", userToken);
  localStorage.setItem("circleEncryptionKey", encryptionKey);

  return { user, userToken, encryptionKey };
}

window.getCircleAuth = getCircleAuth;

// List Circle wallets (try both endpoints for compatibility)
async function listCircleWallets(userToken) {
  try {
    return await api("/api/circle/list-wallets", {
      method: "POST",
      body: JSON.stringify({ userToken })
    });
  } catch {
    return await api("/api/circle/wallets", {
      method: "POST",
      body: JSON.stringify({ userToken })
    });
  }
}

function findExistingCircleGatewayEoa(listData) {
  const wallets =
    extractCircleWallets(listData);

  const eoa =
    wallets.find(
      (wallet) =>
        String(
          wallet?.blockchain || ""
        ).toUpperCase() === "ARC-TESTNET" &&
        String(
          wallet?.accountType || ""
        ).toUpperCase() === "EOA" &&
        String(
          wallet?.state || ""
        ).toUpperCase() === "LIVE"
    ) || null;

  if (eoa) {
    console.log(
      "TROR existing Circle Gateway EOA:",
      {
        walletId: eoa.id,
        address: eoa.address,
        blockchain: eoa.blockchain,
        accountType: eoa.accountType
      }
    );
  } else {
    console.log(
      "TROR Circle Gateway EOA not found."
    );
  }

  return eoa;
}

async function loadCircleUnifiedBalance() {
  const balanceEl =
    document.getElementById(
      "circleUnifiedBalance"
    );

  const pendingEl =
    document.getElementById(
      "circleUnifiedPending"
    );

  try {
    const eoa =
      window.trorCircleGatewayEoa;

    if (!eoa?.address) {
      if (balanceEl) {
        balanceEl.textContent =
          "0.000000 USDC";
      }

      if (pendingEl) {
        pendingEl.textContent =
          "0.000000 USDC";
      }

      return null;
    }

    console.log(
      "TROR loading Circle Unified Balance:",
      eoa.address
    );

    const [
      balanceResponse,
      depositsResponse
    ] = await Promise.all([
      fetch(
        `/api/circle/gateway/balance?depositor=${encodeURIComponent(
          eoa.address
        )}`
      ),

      fetch(
        `/api/circle/gateway/deposits?depositor=${encodeURIComponent(
          eoa.address
        )}`
      )
    ]);

    const result =
      await balanceResponse.json();

    const depositsResult =
      await depositsResponse.json();

    if (!balanceResponse.ok) {
      throw new Error(
        result?.error ||
        "Failed to load Circle Unified Balance"
      );
    }

    const balances =
      Array.isArray(result?.data?.balances)
        ? result.data.balances
        : [];

    const unifiedBalance =
      balances.reduce(
        (total, item) =>
          total +
          Number(item?.balance || 0),
        0
      );

    const pendingDeposits =
      depositsResponse.ok &&
      Array.isArray(
        depositsResult?.data?.deposits
      )
        ? depositsResult.data.deposits
        : [];

    const pendingBalance =
      pendingDeposits.reduce(
        (total, item) => {
          const status =
            String(
              item?.status || ""
            ).toLowerCase();

          if (status !== "pending") {
            return total;
          }

          return (
            total +
            Number(item?.amount || 0) /
              1_000_000
          );
        },
        0
      );

    if (balanceEl) {
      balanceEl.textContent =
        `${unifiedBalance.toFixed(6)} USDC`;
    }

    if (pendingEl) {
      pendingEl.textContent =
        `${pendingBalance.toFixed(6)} USDC`;
    }

    console.log(
      "TROR Circle Unified Balance loaded:",
      {
        eoa: eoa.address,
        unifiedBalance,
        pendingBalance,
        pendingDeposits,
        balances
      }
    );

    return {
      unifiedBalance,
      pendingBalance,
      pendingDeposits,
      balances
    };

  } catch (err) {
    console.error(
      "TROR Circle Unified Balance error:",
      err
    );

    if (balanceEl) {
      balanceEl.textContent =
        "Unavailable";
    }

    if (pendingEl) {
      pendingEl.textContent =
        "Unavailable";
    }

    return null;
  }
}

async function executeCircleChallenge(
  challengeId,
  userToken,
  encryptionKey
) {
  const cfg = await api("/api/circle/config");
  const appId = cfg?.config?.circleAppId;

  if (!appId) {
    throw new Error("Missing CIRCLE_APP_ID.");
  }

  if (!challengeId) {
    throw new Error("Missing Circle challengeId.");
  }

  const sdk = new W3SSdk({
    appSettings: {
      appId
    }
  });

  sdk.setAuthentication({
    userToken,
    encryptionKey
  });

  return await new Promise(
    (resolve, reject) => {
      sdk.execute(
        challengeId,
        (error, result) => {
          if (error) {
            reject(error);
            return;
          }

          resolve(result);
        }
      );
    }
  );
}

async function depositCircleToUnifiedBalance(
  amount
) {
  const GATEWAY_WALLET =
  "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";

const CIRCLE_GATEWAY_DEPOSIT_NETWORKS = {
  "ARC-TESTNET": {
    name: "Arc Testnet",
    usdc:
      "0x3600000000000000000000000000000000000000"
  },

  "ETH-SEPOLIA": {
    name: "Ethereum Sepolia",
    usdc:
      "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238"
  },

  "BASE-SEPOLIA": {
    name: "Base Sepolia",
    usdc:
      "0x036CbD53842c5426634e7929541eC2318f3dCF7e"
  },

  "ARB-SEPOLIA": {
    name: "Arbitrum Sepolia",
    usdc:
      "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d"
  },

  "AVAX-FUJI": {
    name: "Avalanche Fuji",
    usdc:
      "0x5425890298aed601595a70ab815c96711a31bc65"
  },

  "OP-SEPOLIA": {
    name: "Optimism Sepolia",
    usdc:
      "0x5fd84259d66Cd46123540766Be93DFE6D43130D7"
  },

  "MATIC-AMOY": {
    name: "Polygon Amoy",
    usdc:
      "0x41E94Eb019C0762f9bfcf9fb1E58725BfB0e7582"
  },

  "UNI-SEPOLIA": {
    name: "Unichain Sepolia",
    usdc:
      "0x31d0220469e10c4E71834a79b1f276d740d3768F"
  }
};

  const numericAmount =
    Number(amount);

  if (
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0
  ) {
    throw new Error(
      "Enter a valid USDC amount."
    );
  }

  const sourceWallet =
    window.trorActiveCircleWallet;

const sourceBlockchain =
  String(
    sourceWallet?.blockchain || ""
  ).toUpperCase();

const sourceNetwork =
  CIRCLE_GATEWAY_DEPOSIT_NETWORKS[
    sourceBlockchain
  ];

  const gatewayEoa =
    window.trorCircleGatewayEoa;

  if (
    !sourceWallet?.walletId ||
    !sourceWallet?.address
  ) {
    throw new Error(
      "Circle source wallet is not available."
    );
  }

  if (!sourceNetwork?.usdc) {
  throw new Error(
    `Unified Balance deposit is not configured for ${
      sourceWallet?.blockchain || "this network"
    }.`
  );
}

  if (!gatewayEoa?.address) {
    throw new Error(
      "Circle Gateway EOA is not available."
    );
  }

  if (
    Number(sourceWallet.balance || 0) <
    numericAmount
  ) {
    throw new Error(
      `Not enough USDC. Available: ${sourceWallet.balance || 0} USDC`
    );
  }

  const {
    userToken,
    encryptionKey
  } = await getCircleAuth();

  const amountUnits =
    parseUnits(
      String(amount),
      6
    ).toString();

  console.log(
  "TROR Circle Unified deposit:",
  {
    sourceNetwork:
      sourceNetwork.name,

    sourceBlockchain,

    sourceWallet:
      sourceWallet.address,

    sourceWalletId:
      sourceWallet.walletId,

    sourceUsdc:
      sourceNetwork.usdc,

    gatewayDepositor:
      gatewayEoa.address,

    amount,
    amountUnits
  }
);

  /* =====================================================
     STEP 1 — APPROVE USDC
  ===================================================== */

  setStatus(
    `Approve ${amount} USDC for Unified Balance...`
  );

  const approveResponse =
    await api(
      "/api/circle/contract-execution",
      {
        method: "POST",

        body: JSON.stringify({
          userToken,

          walletId:
            sourceWallet.walletId,

          contractAddress:
            sourceNetwork.usdc,

          abiFunctionSignature:
            "approve(address,uint256)",

          abiParameters: [
            GATEWAY_WALLET,
            amountUnits
          ]
        })
      }
    );

  console.log(
    "TROR Circle Gateway approve response:",
    approveResponse
  );

  const approveChallengeId =
    approveResponse?.data?.challengeId ||
    approveResponse?.challengeId;

  if (!approveChallengeId) {
    throw new Error(
      "Circle approve challengeId was not returned."
    );
  }

  await executeCircleChallenge(
    approveChallengeId,
    userToken,
    encryptionKey
  );

  console.log(
    "TROR Circle Gateway USDC approve approved."
  );

  /* =====================================================
     STEP 2 — DEPOSIT FOR GATEWAY EOA
  ===================================================== */

  setStatus(
    `Depositing ${amount} USDC to Unified Balance...`
  );

  const depositResponse =
    await api(
      "/api/circle/contract-execution",
      {
        method: "POST",

        body: JSON.stringify({
          userToken,

          walletId:
            sourceWallet.walletId,

          contractAddress:
            GATEWAY_WALLET,

          abiFunctionSignature:
            "depositFor(address,address,uint256)",

          abiParameters: [
            sourceNetwork.usdc,
            gatewayEoa.address,
            amountUnits
          ]
        })
      }
    );

  console.log(
    "TROR Circle Gateway depositFor response:",
    depositResponse
  );

  const depositChallengeId =
    depositResponse?.data?.challengeId ||
    depositResponse?.challengeId;

  if (!depositChallengeId) {
    throw new Error(
      "Circle deposit challengeId was not returned."
    );
  }

  const depositResult =
    await executeCircleChallenge(
      depositChallengeId,
      userToken,
      encryptionKey
    );

  console.log(
    "TROR Circle Gateway deposit approved:",
    depositResult
  );

let depositTxHash = "";

for (let i = 0; i < 20; i++) {
  await new Promise((resolve) =>
    setTimeout(resolve, 3000)
  );

  const txData = await api(
    "/api/circle/transactions",
    {
      method: "POST",
      body: JSON.stringify({ userToken })
    }
  );

  console.log(
    `TROR Gateway transaction check ${i + 1}:`,
    txData
  );

  const transactions =
    txData?.data?.transactions || [];

  const gatewayTx = transactions.find((item) => {
    const operation =
      String(item?.operation || "").toUpperCase();

    const state =
      String(
        item?.state ||
        item?.status ||
        ""
      ).toUpperCase();

    const contractAddress =
      String(
        item?.contractAddress ||
        item?.destinationAddress ||
        ""
      ).toLowerCase();

    const walletId =
      String(item?.walletId || "");

    const hash =
      item?.blockchainTxHash ||
      item?.txHash ||
      item?.transactionHash ||
      "";

    return (
      operation === "CONTRACT_EXECUTION" &&
      state === "COMPLETE" &&
      walletId === String(sourceWallet.walletId) &&
      contractAddress === GATEWAY_WALLET.toLowerCase() &&
      hash.startsWith("0x")
    );
  });

  depositTxHash =
    gatewayTx?.blockchainTxHash ||
    gatewayTx?.txHash ||
    gatewayTx?.transactionHash ||
    "";

  if (depositTxHash) {
    console.log(
      "TROR Circle Gateway deposit transaction found:",
      gatewayTx
    );

    console.log(
      "TROR Circle Gateway deposit txHash:",
      depositTxHash
    );

    break;
  }
}

if (!depositTxHash) {
  console.log(
    "TROR Circle Gateway deposit challenge completed, but transaction hash is still pending."
  );
}

  setStatus(
  depositTxHash
    ? `Circle Unified Balance deposit confirmed: ${amount} USDC. TX: ${depositTxHash}`
    : `Circle Unified Balance deposit submitted: ${amount} USDC. Waiting for transaction confirmation...`,
  "success"
);

  return {
  amount,
  sourceWallet,
  gatewayEoa,
  depositResult,
  depositTxHash
};
}

document
  .getElementById(
    "btnCircleUnifiedDeposit"
  )
  ?.addEventListener(
    "click",
    async () => {
      try {
        const amount =
          window.prompt(
            "Amount to deposit to Unified Balance (USDC):",
            "0.10"
          );

        if (amount === null) {
          return;
        }

        await depositCircleToUnifiedBalance(
          amount
        );

      } catch (err) {
        console.error(
          "TROR Circle Unified deposit error:",
          err
        );

        setStatus(
          err?.message ||
            "Circle Unified Balance deposit failed.",
          "error"
        );
      }
    }
  );

const TROR_GATEWAY_WALLET =
  "0x0077777d7EBA4688BDeF3E311b846F25870A19B9";

const TROR_GATEWAY_MINTER =
  "0x0022222ABE238Cc2C7Bb1f21003F0a260052475B";

const TROR_GATEWAY_TESTNETS = {
  5042002: {
    name: "Arc Testnet",
    domain: 26,
    usdc:
      "0x3600000000000000000000000000000000000000"
  },

  11155111: {
    name: "Ethereum Sepolia",
    domain: 0,
    usdc:
      "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238"
  },

  84532: {
    name: "Base Sepolia",
    domain: 6,
    usdc:
      "0x036cbd53842c5426634e7929541ec2318f3dcf7e"
  },

  421614: {
    name: "Arbitrum Sepolia",
    domain: 3,
    usdc:
      "0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d"
  },

  43113: {
    name: "Avalanche Fuji",
    domain: 1,
    usdc:
      "0x5425890298aed601595a70ab815c96711a31bc65"
  },

  11155420: {
    name: "Optimism Sepolia",
    domain: 2,
    usdc:
      "0x5fd84259d66cd46123540766be93dfe6d43130d7"
  },

  80002: {
    name: "Polygon Amoy",
    domain: 7,
    usdc:
      "0x41e94eb019c0762f9bfcf9fb1e58725bfb0e7582"
  },

  1301: {
    name: "Unichain Sepolia",
    domain: 10,
    usdc:
      "0x31d0220469e10c4e71834a79b1f276d740d3768f"
  }
};

const TROR_GATEWAY_EIP712_DOMAIN = [
  { name: "name", type: "string" },
  { name: "version", type: "string" }
];

const TROR_GATEWAY_TRANSFER_SPEC = [
  { name: "version", type: "uint32" },
  { name: "sourceDomain", type: "uint32" },
  { name: "destinationDomain", type: "uint32" },
  { name: "sourceContract", type: "bytes32" },
  { name: "destinationContract", type: "bytes32" },
  { name: "sourceToken", type: "bytes32" },
  { name: "destinationToken", type: "bytes32" },
  { name: "sourceDepositor", type: "bytes32" },
  { name: "destinationRecipient", type: "bytes32" },
  { name: "sourceSigner", type: "bytes32" },
  { name: "destinationCaller", type: "bytes32" },
  { name: "value", type: "uint256" },
  { name: "salt", type: "bytes32" },
  { name: "hookData", type: "bytes" }
];

const TROR_GATEWAY_BURN_INTENT = [
  { name: "maxBlockHeight", type: "uint256" },
  { name: "maxFee", type: "uint256" },
  { name: "spec", type: "TransferSpec" }
];

function gatewayAddressToBytes32(value) {
  if (
    typeof value === "string" &&
    /^0x[0-9a-fA-F]{64}$/.test(value)
  ) {
    return value;
  }

  if (!ethers.isAddress(value)) {
    throw new Error(
      `Invalid Gateway address: ${value}`
    );
  }

  return ethers.zeroPadValue(
    value,
    32
  );
}

function buildCircleGatewayTransferSpec({
  depositor,
  recipientAddress,
  amount,
  destinationChainId
}) {
  const destination =
    TROR_GATEWAY_TESTNETS[
      Number(destinationChainId)
    ];

  if (!destination) {
    throw new Error(
      "Unsupported Gateway destination network."
    );
  }

  if (!ethers.isAddress(depositor)) {
    throw new Error(
      "Invalid Gateway depositor."
    );
  }

  if (!ethers.isAddress(recipientAddress)) {
    throw new Error(
      "Invalid recipient address."
    );
  }

  const value =
    parseUnits(
      String(amount),
      6
    ).toString();

  const salt =
  ethers.hexlify(
    ethers.randomBytes(32)
  );

  return {
    version: 1,

    sourceDomain: 26,

    destinationDomain:
      destination.domain,

    sourceContract:
      gatewayAddressToBytes32(
        TROR_GATEWAY_WALLET
      ),

    destinationContract:
      gatewayAddressToBytes32(
        TROR_GATEWAY_MINTER
      ),

    sourceToken:
      gatewayAddressToBytes32(
        "0x3600000000000000000000000000000000000000"
      ),

    destinationToken:
      gatewayAddressToBytes32(
        destination.usdc
      ),

    sourceDepositor:
      gatewayAddressToBytes32(
        depositor
      ),

    destinationRecipient:
      gatewayAddressToBytes32(
        recipientAddress
      ),

    sourceSigner:
      gatewayAddressToBytes32(
        depositor
      ),

    destinationCaller:
      "0x" + "00".repeat(32),

    value,

    salt,

    hookData: "0x"
  };
}

async function estimateCircleGatewaySend({
  recipientAddress,
  amount = "0.05",
  destinationChainId = 5042002
}) {
  const gatewayEoa =
    window.trorCircleGatewayEoa;

  if (!gatewayEoa?.address) {
    throw new Error(
      "Circle Gateway EOA is not available."
    );
  }

  if (!ethers.isAddress(recipientAddress)) {
    throw new Error(
      "Enter a valid recipient address."
    );
  }

  const numericAmount = Number(amount);

  if (
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0
  ) {
    throw new Error(
      "Enter a valid USDC amount."
    );
  }

  const spec =
    buildCircleGatewayTransferSpec({
      depositor: gatewayEoa.address,
      recipientAddress,
      amount,
      destinationChainId
    });

  console.log(
    "TROR Circle Gateway transfer spec:",
    spec
  );

  const response =
    await api(
      "/api/circle/gateway/estimate",
      {
        method: "POST",

        body: JSON.stringify({
          spec
        })
      }
    );

  console.log(
    "TROR Circle Gateway estimate:",
    response
  );

  const burnIntent =
  response?.data?.[0]?.burnIntent ||
  response?.data?.body?.[0]?.burnIntent ||
  response?.body?.[0]?.burnIntent ||
  null;

  if (!burnIntent) {
    throw new Error(
      "Gateway burnIntent was not returned."
    );
  }

  const feeInfo =
    response?.data?.fees ||
    response?.fees ||
    null;

  console.log(
    "TROR Circle Gateway estimated burnIntent:",
    burnIntent
  );

  console.log(
    "TROR Circle Gateway estimated fees:",
    feeInfo
  );

const typedData =
  buildCircleGatewayBurnTypedData(
    burnIntent
  );

const normalizedBurnIntent = {
  maxBlockHeight:
    String(burnIntent.maxBlockHeight),

  maxFee:
    String(burnIntent.maxFee),

  spec: {
    ...typedData.message.spec
  }
};

console.log(
  "TROR Circle Gateway normalized burnIntent:",
  normalizedBurnIntent
);

console.log(
  "TROR Circle Gateway EIP-712 typed data:",
  typedData
);

  return {
  spec,
  burnIntent: normalizedBurnIntent,
  typedData,
  fees: feeInfo,
  raw: response
};
}

window.estimateCircleGatewaySend =
  estimateCircleGatewaySend;

function buildCircleGatewayBurnTypedData(
  burnIntent
) {
  if (!burnIntent?.spec) {
    throw new Error(
      "Invalid Circle Gateway burnIntent."
    );
  }

  return {
    types: {
      EIP712Domain:
        TROR_GATEWAY_EIP712_DOMAIN,

      TransferSpec:
        TROR_GATEWAY_TRANSFER_SPEC,

      BurnIntent:
        TROR_GATEWAY_BURN_INTENT
    },

    domain: {
      name: "GatewayWallet",
      version: "1"
    },

    primaryType: "BurnIntent",

    message: {
      maxBlockHeight:
        String(
          burnIntent.maxBlockHeight
        ),

      maxFee:
        String(
          burnIntent.maxFee
        ),

      spec: {
  ...burnIntent.spec,

  sourceContract:
    gatewayAddressToBytes32(
      burnIntent.spec.sourceContract
    ),

  destinationContract:
    gatewayAddressToBytes32(
      burnIntent.spec.destinationContract
    ),

  sourceToken:
    gatewayAddressToBytes32(
      burnIntent.spec.sourceToken
    ),

  destinationToken:
    gatewayAddressToBytes32(
      burnIntent.spec.destinationToken
    ),

  sourceDepositor:
    gatewayAddressToBytes32(
      burnIntent.spec.sourceDepositor
    ),

  destinationRecipient:
    gatewayAddressToBytes32(
      burnIntent.spec.destinationRecipient
    ),

  sourceSigner:
    gatewayAddressToBytes32(
      burnIntent.spec.sourceSigner
    ),

  destinationCaller:
    gatewayAddressToBytes32(
      burnIntent.spec.destinationCaller
    )
}
    }
  };
}

async function signCircleGatewayBurnIntent(
  burnIntent
) {
  const gatewayEoa =
    window.trorCircleGatewayEoa;

  if (!gatewayEoa?.id) {
    throw new Error(
      "Circle Gateway EOA walletId is not available."
    );
  }

  const {
    userToken,
    encryptionKey
  } = await getCircleAuth();

  const typedData =
    buildCircleGatewayBurnTypedData(
      burnIntent
    );

  console.log(
    "TROR Circle Gateway signing typed data:",
    typedData
  );

  const challengeResponse =
    await api(
      "/api/circle/sign-typed-data",
      {
        method: "POST",

        body: JSON.stringify({
          userToken,

          walletId:
            gatewayEoa.id,

          data:
            typedData,

          memo:
            "TROR Unified Balance send"
        })
      }
    );

  console.log(
    "TROR Circle Gateway sign challenge:",
    challengeResponse
  );

  const challengeId =
    challengeResponse?.data?.challengeId ||
    challengeResponse?.challengeId;

  if (!challengeId) {
    throw new Error(
      "Circle SIGN_TYPEDDATA challengeId was not returned."
    );
  }

  const signResult =
    await executeCircleChallenge(
      challengeId,
      userToken,
      encryptionKey
    );

  console.log(
    "TROR Circle Gateway BurnIntent signed:",
    signResult
  );

  const signature =
    signResult?.signature ||
    signResult?.data?.signature ||
    null;

  if (!signature) {
    throw new Error(
      "Circle Gateway signature was not returned."
    );
  }

  return {
    typedData,
    signature,
    signResult
  };
}

window.signCircleGatewayBurnIntent =
  signCircleGatewayBurnIntent;

async function submitCircleGatewayTransfer({
  burnIntent,
  signature
}) {
  if (!burnIntent?.spec) {
    throw new Error(
      "Gateway burnIntent is required."
    );
  }

  if (
    !signature ||
    !String(signature).startsWith("0x")
  ) {
    throw new Error(
      "Gateway signature is required."
    );
  }

  console.log(
    "TROR submitting Circle Gateway transfer:",
    {
      burnIntent,
      signature:
        `${signature.slice(0, 12)}...${signature.slice(-8)}`
    }
  );

  const response =
    await api(
      "/api/circle/gateway/transfer",
      {
        method: "POST",

        body: JSON.stringify({
          burnIntent,
          signature
        })
      }
    );

  console.log(
    "TROR Circle Gateway transfer submitted:",
    response
  );

  return response;
}

window.submitCircleGatewayTransfer =
  submitCircleGatewayTransfer;

async function mintCircleGatewayTransfer({
  attestation,
  operatorSignature,
  destinationChainId = 5042002
}) {
  if (!attestation) {
    throw new Error(
      "Gateway attestation is required."
    );
  }

  if (!operatorSignature) {
    throw new Error(
      "Gateway operator signature is required."
    );
  }

  const destination =
    TROR_GATEWAY_TESTNETS[
      Number(destinationChainId)
    ];

  if (!destination) {
    throw new Error(
      "Unsupported Gateway destination network."
    );
  }

  const destinationBlockchainMap = {
    5042002: "ARC-TESTNET",
    11155111: "ETH-SEPOLIA",
    84532: "BASE-SEPOLIA",
    421614: "ARB-SEPOLIA",
    43113: "AVAX-FUJI",
    11155420: "OP-SEPOLIA",
    80002: "MATIC-AMOY",
    1301: "UNI-SEPOLIA"
  };

  const destinationBlockchain =
    destinationBlockchainMap[
      Number(destinationChainId)
    ];

  const destinationWallet =
    (
      window.trorCircleMultiChainBalances ||
      []
    ).find(
      (item) =>
        String(
          item?.blockchain || ""
        ).toUpperCase() ===
        destinationBlockchain
    );

  if (!destinationWallet?.walletId) {
    throw new Error(
      `Circle wallet for ${destination.name} is not available.`
    );
  }

  const {
    userToken,
    encryptionKey
  } = await getCircleAuth();

  setStatus(
    `Minting USDC on ${destination.name}...`
  );

  console.log(
    "TROR Circle Gateway mint:",
    {
      destination:
        destination.name,

      walletId:
        destinationWallet.walletId,

      gatewayMinter:
        TROR_GATEWAY_MINTER
    }
  );

  const mintResponse =
    await api(
      "/api/circle/contract-execution",
      {
        method: "POST",

        body: JSON.stringify({
          userToken,

          walletId:
            destinationWallet.walletId,

          contractAddress:
            TROR_GATEWAY_MINTER,

          abiFunctionSignature:
            "gatewayMint(bytes,bytes)",

          abiParameters: [
            attestation,
            operatorSignature
          ]
        })
      }
    );

  console.log(
    "TROR Circle Gateway mint challenge:",
    mintResponse
  );

  const challengeId =
    mintResponse?.data?.challengeId ||
    mintResponse?.challengeId;

  if (!challengeId) {
    throw new Error(
      "Circle Gateway mint challengeId was not returned."
    );
  }

  const mintResult =
    await executeCircleChallenge(
      challengeId,
      userToken,
      encryptionKey
    );

  console.log(
    "TROR Circle Gateway mint approved:",
    mintResult
  );

  setStatus(
    `Gateway mint submitted on ${destination.name}.`,
    "success"
  );

  return mintResult;
}

window.mintCircleGatewayTransfer =
  mintCircleGatewayTransfer;

/* =========================================================
   CIRCLE UNIFIED BALANCE - SEND POPUP
========================================================= */

document
  .getElementById("btnCircleUnifiedSend")
  ?.addEventListener("click", () => {
    openCircleUnifiedSendModal();
  });

function openCircleUnifiedSendModal() {
  const gatewayEoa =
    window.trorCircleGatewayEoa;

  if (!gatewayEoa?.address) {
    setStatus(
      "Circle Unified Balance is not available.",
      "error"
    );
    return;
  }

  const balanceText =
    document
      .getElementById("circleUnifiedBalance")
      ?.textContent || "0";

  const availableBalance =
    Number.parseFloat(balanceText) || 0;

  let modal =
    document.getElementById(
      "circleUnifiedSendModal"
    );

  if (!modal) {
    modal = document.createElement("div");
    modal.id = "circleUnifiedSendModal";

    modal.style.cssText = `
      position:fixed;
      inset:0;
      z-index:1000002;
      display:flex;
      align-items:center;
      justify-content:center;
      padding:20px;
      background:rgba(0,0,0,.76);
      backdrop-filter:blur(10px);
    `;

    document.body.appendChild(modal);
  }

  const networkOptions =
    Object.entries(TROR_GATEWAY_TESTNETS)
      .map(
        ([chainId, network]) => `
          <option value="${chainId}">
            ${network.name}
          </option>
        `
      )
      .join("");

  function closeModal() {
    modal.style.display = "none";
  }

  function renderForm() {
    modal.innerHTML = `
      <div style="
        width:100%;
        max-width:420px;
        padding:22px;
        border-radius:18px;
        color:#fff;
        background:#121a2b;
        border:1px solid rgba(215,180,90,.38);
        box-shadow:0 24px 70px rgba(0,0,0,.5);
      ">

        <div style="
          display:flex;
          justify-content:space-between;
          align-items:center;
          margin-bottom:4px;
        ">
          <div style="
            color:#d8b46a;
            font-size:12px;
            font-weight:800;
            letter-spacing:.12em;
          ">
            TROR UNIFIED BALANCE
          </div>

          <button
            id="closeCircleUnifiedSend"
            type="button"
            style="
              border:0;
              background:transparent;
              color:#fff;
              cursor:pointer;
              font-size:22px;
            "
          >
            ×
          </button>
        </div>

        <h2 style="margin:4px 0 18px;">
          Send from Unified Balance
        </h2>

        <div style="
          padding:12px 14px;
          margin-bottom:16px;
          border-radius:12px;
          background:rgba(255,255,255,.05);
          border:1px solid rgba(255,255,255,.08);
        ">
          <div style="
            font-size:11px;
            color:#9da8ba;
            text-transform:uppercase;
            letter-spacing:.08em;
          ">
            Available
          </div>

          <div style="
            margin-top:4px;
            font-size:20px;
            font-weight:800;
          ">
            ${availableBalance.toFixed(6)} USDC
          </div>
        </div>

        <label style="
          display:block;
          margin-bottom:6px;
          font-size:12px;
          color:#cbd5e1;
        ">
          Destination Network
        </label>

        <select
          id="circleUnifiedSendNetwork"
          style="
            box-sizing:border-box;
            width:100%;
            padding:12px;
            margin-bottom:14px;
            border-radius:10px;
            border:1px solid rgba(255,255,255,.12);
            background:#090d16;
            color:#fff;
          "
        >
          ${networkOptions}
        </select>

        <label style="
          display:block;
          margin-bottom:6px;
          font-size:12px;
          color:#cbd5e1;
        ">
          Recipient
        </label>

        <input
          id="circleUnifiedSendRecipient"
          type="text"
          placeholder="0x..."
          autocomplete="off"
          style="
            box-sizing:border-box;
            width:100%;
            padding:12px;
            margin-bottom:14px;
            border-radius:10px;
            border:1px solid rgba(255,255,255,.12);
            background:#090d16;
            color:#fff;
            outline:none;
          "
        />

        <label style="
          display:block;
          margin-bottom:6px;
          font-size:12px;
          color:#cbd5e1;
        ">
          Amount
        </label>

        <input
          id="circleUnifiedSendAmount"
          type="number"
          min="0"
          step="0.000001"
          placeholder="0.00 USDC"
          style="
            box-sizing:border-box;
            width:100%;
            padding:12px;
            margin-bottom:18px;
            border-radius:10px;
            border:1px solid rgba(255,255,255,.12);
            background:#090d16;
            color:#fff;
            outline:none;
          "
        />

        <button
          id="continueCircleUnifiedSend"
          type="button"
          style="
            width:100%;
            padding:13px;
            border:0;
            border-radius:11px;
            cursor:pointer;
            font-weight:800;
            background:linear-gradient(
              135deg,
              #c49a36,
              #f0cf69
            );
            color:#111;
          "
        >
          Continue
        </button>

        <button
          id="cancelCircleUnifiedSend"
          type="button"
          style="
            width:100%;
            padding:12px;
            margin-top:9px;
            border-radius:11px;
            cursor:pointer;
            background:transparent;
            border:1px solid rgba(255,255,255,.13);
            color:#fff;
          "
        >
          Cancel
        </button>

      </div>
    `;

    modal.style.display = "flex";

    document
      .getElementById(
        "closeCircleUnifiedSend"
      )
      ?.addEventListener(
        "click",
        closeModal
      );

    document
      .getElementById(
        "cancelCircleUnifiedSend"
      )
      ?.addEventListener(
        "click",
        closeModal
      );

    document
      .getElementById(
        "continueCircleUnifiedSend"
      )
      ?.addEventListener(
        "click",
        prepareReview
      );
  }

  async function prepareReview() {
    try {
      const recipient =
        document
          .getElementById(
            "circleUnifiedSendRecipient"
          )
          ?.value.trim();

      const amount =
        document
          .getElementById(
            "circleUnifiedSendAmount"
          )
          ?.value.trim();

      const destinationChainId =
        Number(
          document
            .getElementById(
              "circleUnifiedSendNetwork"
            )
            ?.value
        );

      if (
        !recipient ||
        !ethers.isAddress(recipient)
      ) {
        throw new Error(
          "Enter a valid recipient address."
        );
      }

      const numericAmount =
        Number(amount);

      if (
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0
      ) {
        throw new Error(
          "Enter a valid USDC amount."
        );
      }

      const continueButton =
        document.getElementById(
          "continueCircleUnifiedSend"
        );

      if (continueButton) {
        continueButton.disabled = true;
        continueButton.textContent =
          "Estimating...";
      }

      const estimate =
        await estimateCircleGatewaySend({
          recipientAddress: recipient,
          amount,
          destinationChainId
        });

      const maxFeeUnits =
        Number(
          estimate?.burnIntent?.maxFee || 0
        );

      const estimatedFee =
        maxFeeUnits / 1_000_000;

      const total =
        numericAmount + estimatedFee;

      if (total > availableBalance) {
        throw new Error(
          `Not enough Unified Balance. Required: ${total.toFixed(
            6
          )} USDC`
        );
      }

      renderReview({
        recipient,
        amount,
        destinationChainId,
        estimatedFee,
        total,
        estimate
      });

    } catch (err) {
      console.error(
        "TROR Unified Send estimate error:",
        err
      );

      setStatus(
        err?.message ||
          "Unable to estimate Unified Balance send.",
        "error"
      );

      const continueButton =
        document.getElementById(
          "continueCircleUnifiedSend"
        );

      if (continueButton) {
        continueButton.disabled = false;
        continueButton.textContent =
          "Continue";
      }
    }
  }

  function renderReview({
    recipient,
    amount,
    destinationChainId,
    estimatedFee,
    total,
    estimate
  }) {
    const network =
      TROR_GATEWAY_TESTNETS[
        destinationChainId
      ];

    modal.innerHTML = `
      <div style="
        width:100%;
        max-width:420px;
        padding:22px;
        border-radius:18px;
        color:#fff;
        background:#121a2b;
        border:1px solid rgba(215,180,90,.38);
        box-shadow:0 24px 70px rgba(0,0,0,.5);
      ">

        <div style="
          color:#d8b46a;
          font-size:12px;
          font-weight:800;
          letter-spacing:.12em;
          margin-bottom:7px;
        ">
          TROR UNIFIED BALANCE
        </div>

        <h2 style="margin:0 0 18px;">
          Review Send
        </h2>

        <div style="
          padding:14px;
          border-radius:12px;
          background:#090d16;
          border:1px solid rgba(255,255,255,.08);
          font-size:13px;
          line-height:1.7;
        ">
          <div>
            <span style="color:#9da8ba;">
              Network
            </span><br>
            <b>${network?.name || "-"}</b>
          </div>

          <div style="margin-top:10px;">
            <span style="color:#9da8ba;">
              Recipient
            </span><br>
            <b style="
              display:block;
              word-break:break-all;
            ">
              ${recipient}
            </b>
          </div>

          <div style="margin-top:10px;">
            <span style="color:#9da8ba;">
              Send
            </span><br>
            <b>
              ${Number(amount).toFixed(6)}
              USDC
            </b>
          </div>

          <div style="margin-top:10px;">
            <span style="color:#9da8ba;">
              Estimated Gateway Fee
            </span><br>
            <b>
              ${estimatedFee.toFixed(6)}
              USDC
            </b>
          </div>

          <div style="
            margin-top:12px;
            padding-top:12px;
            border-top:1px solid
              rgba(255,255,255,.1);
          ">
            <span style="color:#9da8ba;">
              Estimated Total
            </span><br>

            <b style="
              font-size:19px;
              color:#f0cf69;
            ">
              ${total.toFixed(6)} USDC
            </b>
          </div>
        </div>

        <button
          id="confirmCircleUnifiedSend"
          type="button"
          style="
            width:100%;
            padding:13px;
            margin-top:16px;
            border:0;
            border-radius:11px;
            cursor:pointer;
            font-weight:800;
            background:linear-gradient(
              135deg,
              #c49a36,
              #f0cf69
            );
            color:#111;
          "
        >
          Confirm Send
        </button>

        <button
          id="backCircleUnifiedSend"
          type="button"
          style="
            width:100%;
            padding:12px;
            margin-top:9px;
            border-radius:11px;
            cursor:pointer;
            background:transparent;
            border:1px solid rgba(255,255,255,.13);
            color:#fff;
          "
        >
          Back
        </button>

      </div>
    `;

    document
      .getElementById(
        "backCircleUnifiedSend"
      )
      ?.addEventListener(
        "click",
        renderForm
      );

    document
      .getElementById(
        "confirmCircleUnifiedSend"
      )
      ?.addEventListener(
        "click",
        async () => {
          await executeUnifiedSend({
            recipient,
            amount,
            destinationChainId,
            estimatedFee,
            estimate
          });
        }
      );
  }

  async function executeUnifiedSend({
    recipient,
    amount,
    destinationChainId,
    estimatedFee,
    estimate
  }) {
    const button =
      document.getElementById(
        "confirmCircleUnifiedSend"
      );

    try {
      if (button) {
        button.disabled = true;
        button.textContent =
          "Confirm in Circle...";
      }

      /*
       * STEP 1
       * Sign the exact BurnIntent
       * generated on the Review screen.
       */
      const signed =
        await signCircleGatewayBurnIntent(
          estimate.burnIntent
        );

      if (button) {
        button.textContent =
          "Creating transfer...";
      }

      /*
       * STEP 2
       * Submit signed BurnIntent.
       */
      const transfer =
        await submitCircleGatewayTransfer({
          burnIntent:
            estimate.burnIntent,

          signature:
            signed.signature
        });

      const attestation =
        transfer?.data?.attestation;

      const operatorSignature =
        transfer?.data?.signature;

      if (
        !attestation ||
        !operatorSignature
      ) {
        throw new Error(
          "Gateway attestation was not returned."
        );
      }

      if (button) {
        button.textContent =
          "Confirm mint in Circle...";
      }

      /*
       * STEP 3
       * Mint on destination network.
       */
      await mintCircleGatewayTransfer({
        attestation,
        operatorSignature,
        destinationChainId
      });

      /*
       * STEP 4
       * Refresh Gateway balance.
       */
      await loadCircleUnifiedBalance();

      renderSuccess({
        recipient,
        amount,
        destinationChainId,
        estimatedFee,
        transferId:
          transfer?.data?.transferId ||
          ""
      });

    } catch (err) {
      console.error(
        "TROR Circle Unified Send error:",
        err
      );

      setStatus(
        err?.message ||
          "Unified Balance send failed.",
        "error"
      );

      if (button) {
        button.disabled = false;
        button.textContent =
          "Confirm Send";
      }
    }
  }

  function renderSuccess({
    recipient,
    amount,
    destinationChainId,
    estimatedFee,
    transferId
  }) {
    const network =
      TROR_GATEWAY_TESTNETS[
        destinationChainId
      ];

    modal.innerHTML = `
      <div style="
        width:100%;
        max-width:420px;
        padding:28px 22px;
        border-radius:18px;
        text-align:center;
        color:#fff;
        background:#121a2b;
        border:1px solid rgba(50,210,120,.35);
        box-shadow:0 24px 70px rgba(0,0,0,.5);
      ">

        <div style="
          font-size:42px;
          margin-bottom:10px;
        ">
          ✓
        </div>

        <h2 style="margin:0 0 8px;">
          USDC Sent Successfully
        </h2>

        <div style="
          color:#a7f3d0;
          font-size:22px;
          font-weight:800;
          margin:14px 0;
        ">
          ${Number(amount).toFixed(6)}
          USDC
        </div>

        <div style="
          color:#9da8ba;
          font-size:13px;
          line-height:1.7;
        ">
          ${network?.name || "-"}<br>
          ${recipient}<br>
          Gateway fee:
          ${estimatedFee.toFixed(6)} USDC
        </div>

        ${
          transferId
            ? `
              <div style="
                margin-top:14px;
                padding:10px;
                border-radius:10px;
                background:rgba(255,255,255,.04);
                color:#9da8ba;
                font-size:11px;
                word-break:break-all;
              ">
                Transfer ID:
                ${transferId}
              </div>
            `
            : ""
        }

        <button
          id="doneCircleUnifiedSend"
          type="button"
          style="
            width:100%;
            padding:13px;
            margin-top:18px;
            border:0;
            border-radius:11px;
            cursor:pointer;
            font-weight:800;
            background:linear-gradient(
              135deg,
              #c49a36,
              #f0cf69
            );
            color:#111;
          "
        >
          Done
        </button>

      </div>
    `;

    document
      .getElementById(
        "doneCircleUnifiedSend"
      )
      ?.addEventListener(
        "click",
        closeModal
      );

    setStatus(
      `Sent ${amount} USDC from Unified Balance successfully.`,
      "success"
    );
  }

  renderForm();
}

// Load and display Circle wallet address
async function loadCircleWallet(userToken) {
  const listData = await listCircleWallets(userToken);
  console.log("List wallets response:", listData);

const wallets = extractCircleWallets(listData);

const circleGatewayEoa =
  findExistingCircleGatewayEoa(listData);

window.trorCircleGatewayEoa =
  circleGatewayEoa;

await loadCircleUnifiedBalance();

console.log(
  "Circle multi-chain wallets:",
  wallets.map((w) => ({
    id: w?.id,
    blockchain: w?.blockchain,
    address: w?.address || w?.walletAddress || w?.accounts?.[0]?.address || null
  }))
);

const multiChainBalances =
  await loadCircleMultiChainBalances(
    userToken,
    wallets
  );

console.log(
  "Circle multi-chain USDC balances:",
  multiChainBalances
);

window.trorCircleMultiChainBalances =
  multiChainBalances;

  const networkSelect =
  document.getElementById("circleNetworkSelect");

const networkAddress =
  document.getElementById("circleNetworkAddress");

const networkBalance =
  document.getElementById("circleNetworkBalance");

function renderCircleNetwork(blockchain) {
  const selected = multiChainBalances.find(
    (item) =>
      String(item?.blockchain || "").toUpperCase() ===
      String(blockchain || "").toUpperCase()
  );

  if (!selected) {
    if (networkAddress) {
      networkAddress.textContent = "Wallet not available";
    }

    if (networkBalance) {
      networkBalance.textContent = "0 USDC";
    }

    return;
  }

  if (networkAddress) {
    networkAddress.textContent =
      selected.address || "-";
  }

  if (networkBalance) {
    networkBalance.textContent =
      `${Number(selected.balance || 0)} USDC`;
  }
}

if (networkSelect) {
  const setActiveCircleNetwork = (blockchain) => {
    const selected = multiChainBalances.find(
      (item) =>
        String(item?.blockchain || "").toUpperCase() ===
        String(blockchain || "").toUpperCase()
    );

    if (!selected) {
      window.trorActiveCircleNetwork = null;
      window.trorActiveCircleWallet = null;

      renderCircleNetwork(blockchain);
      return;
    }

    window.trorActiveCircleNetwork =
      String(selected.blockchain || "").toUpperCase();

    window.trorActiveCircleWallet = {
      blockchain: selected.blockchain,
      walletId: selected.walletId,
      address: selected.address,
      tokenId: selected.tokenId,
      balance: selected.balance
    };

    console.log(
      "TROR active Circle network:",
      window.trorActiveCircleNetwork
    );

    console.log(
      "TROR active Circle wallet:",
      window.trorActiveCircleWallet
    );

    renderCircleNetwork(blockchain);
  };

  networkSelect.onchange = () => {
    setActiveCircleNetwork(networkSelect.value);
  };

  networkSelect.value = "ARC-TESTNET";
  setActiveCircleNetwork("ARC-TESTNET");
}

  const wallet = extractWallet(listData);
  const address = extractWalletAddress(listData);

  if (!address) {
    circleWalletEl.textContent = "No Circle wallet yet";
    document.getElementById("btnSetupPin")?.classList.remove("hidden");
    setStatus("No Circle wallet found. Tap Create Circle Wallet.", "error");
    return null;
  }

  circleWalletEl.textContent = address;

clearWeb3WalletLocal();

activeWalletType = "circle";
updateWalletChip(address, null);

const hasProfile = await checkUserProfile(address);

if (!hasProfile) {
  return null;
}

setStatus("Circle wallet and workspace loaded.", "success");

if (!isInvoicePaymentMode()) {
  showTab("dashboard");
  updateTopbarTitle("dashboard");
  window.location.hash = "dashboard";
}

document
  .getElementById("btnSetupPin")
  ?.classList.add("hidden");

return { wallet, address, wallets };
}

// Find USDC token in Circle wallet balances
async function findUsdcToken(userToken, walletId) {
  const balanceData = await api("/api/circle/wallet-balances", {
    method: "POST",
    body: JSON.stringify({ userToken, walletId })
  });

  console.log("FULL Circle balances:", balanceData);

  const tokenBalances = balanceData?.data?.tokenBalances || balanceData?.tokenBalances || [];

  // Find USDC on Arc Testnet — strict match first
  const usdc =
    tokenBalances.find((b) => {
      const symbol = String(b?.token?.symbol || "").toUpperCase();
      const tokenAddress = String(b?.token?.tokenAddress || "").toLowerCase();
      const blockchain = String(b?.token?.blockchain || "").toUpperCase();
      return symbol === "USDC" && blockchain === "ARC-TESTNET" && tokenAddress === USDC_TOKEN.toLowerCase();
    }) ||
    // Fallback: any USDC on Arc Testnet
    tokenBalances.find((b) => {
      const symbol = String(b?.token?.symbol || "").toUpperCase();
      const blockchain = String(b?.token?.blockchain || "").toUpperCase();
      return symbol === "USDC" && blockchain === "ARC-TESTNET";
    });

  if (!usdc) {
    console.log("No ARC USDC found. tokenBalances:", tokenBalances);
    throw new Error("No ARC USDC token found in Circle wallet.");
  }

  const tokenId = usdc?.token?.id;
  const balance = Number(usdc?.amount || 0);

  if (!tokenId) {
    console.log("USDC object without tokenId:", usdc);
    throw new Error("ARC USDC tokenId not found.");
  }

  return { tokenId, balance, raw: usdc };
}

async function findUsdcTokenByBlockchain(userToken, walletId, blockchain) {
  const balanceData = await api("/api/circle/wallet-balances", {
    method: "POST",
    body: JSON.stringify({
      userToken,
      walletId
    })
  });

  const tokenBalances =
    balanceData?.data?.tokenBalances ||
    balanceData?.tokenBalances ||
    [];

  const targetChain = String(blockchain || "").toUpperCase();

  const usdc = tokenBalances.find((b) => {
    const symbol = String(b?.token?.symbol || "").toUpperCase();
    const tokenBlockchain = String(
      b?.token?.blockchain || ""
    ).toUpperCase();

    return (
      symbol === "USDC" &&
      tokenBlockchain === targetChain
    );
  });

  if (!usdc) {
    return {
      tokenId: null,
      balance: 0,
      raw: null
    };
  }

  return {
    tokenId: usdc?.token?.id || null,
    balance: Number(usdc?.amount || 0),
    raw: usdc
  };
}

async function loadCircleMultiChainBalances(userToken, wallets) {
  const results = [];

const primaryAddress =
  getPrimaryCircleAddress(wallets);

const primaryWallets =
  (wallets || []).filter((wallet) => {
    const address =
      String(
        wallet?.address ||
        wallet?.walletAddress ||
        wallet?.accounts?.[0]?.address ||
        ""
      ).toLowerCase();

    return address === primaryAddress;
  });

console.log(
  "TROR primary Circle wallets:",
  primaryWallets
);

  for (const wallet of primaryWallets) {
    if (!wallet?.id || !wallet?.blockchain) continue;

    try {
      const usdc = await findUsdcTokenByBlockchain(
        userToken,
        wallet.id,
        wallet.blockchain
      );

      results.push({
        walletId: wallet.id,
        blockchain: wallet.blockchain,
        address:
          wallet?.address ||
          wallet?.walletAddress ||
          wallet?.accounts?.[0]?.address ||
          null,
        tokenId: usdc.tokenId,
        balance: usdc.balance,
        raw: usdc.raw
      });
    } catch (err) {
      console.error(
        `Failed to load ${wallet.blockchain} USDC balance:`,
        err
      );

      results.push({
        walletId: wallet.id,
        blockchain: wallet.blockchain,
        address:
          wallet?.address ||
          wallet?.walletAddress ||
          wallet?.accounts?.[0]?.address ||
          null,
        tokenId: null,
        balance: 0,
        raw: null,
        error: err?.message || "Failed to load balance"
      });
    }
  }

  return results;
}

/* =========================
   GOOGLE + CIRCLE LOGIN
========================= */

function saveInvoiceReturnPath() {
  const invoiceId =
    new URLSearchParams(
      window.location.search
    ).get("invoice");

  if (!invoiceId) return;

  localStorage.setItem(
    "invoiceReturnPath",
    `/app.html?invoice=${encodeURIComponent(
      invoiceId
    )}`
  );
}

async function restoreInvoiceAfterConnect() {
  const savedPath =
    localStorage.getItem("invoiceReturnPath");

  const savedUrl = savedPath
    ? new URL(savedPath, window.location.origin)
    : null;

  const invoiceId =
    new URLSearchParams(
      window.location.search
    ).get("invoice") ||
    savedUrl?.searchParams.get("invoice");

  if (!invoiceId) return;

  window.history.replaceState(
    null,
    "",
    `/app.html?invoice=${encodeURIComponent(
      invoiceId
    )}`
  );

  await openInvoice(invoiceId);

  showTab("invoices");
  updateTopbarTitle("invoices");

  window.location.hash = "invoices";

  localStorage.removeItem(
    "invoiceReturnPath"
  );
}

async function connectGoogleCircle() {
  const cfg = await api("/api/circle/config");
  const googleClientId = cfg?.config?.googleClientId;

  if (!googleClientId) {
    setStatus("Missing GOOGLE_CLIENT_ID in backend .env", "error");
    return;
  }

  const redirectUri = window.location.origin + "/app.html";

  window.location.href =
    "https://accounts.google.com/o/oauth2/v2/auth" +
    "?client_id=" + encodeURIComponent(googleClientId) +
    "&redirect_uri=" + encodeURIComponent(redirectUri) +
    "&response_type=token" +
    "&scope=" + encodeURIComponent("openid email profile") +
    "&prompt=" + encodeURIComponent("select_account");
}

async function handleGoogleRedirect() {
  const hash = window.location.hash;

  if (!hash.includes("access_token")) {
    const savedUser = getGoogleUser();
    if (savedUser.email && emailEl) {
      emailEl.textContent = savedUser.email;
    }
    // Do not auto-load Circle wallet with old token.
    // User must click Login Google / Setup Circle PIN to refresh token.
    return;
  }

  const params = new URLSearchParams(hash.replace("#", ""));
  const googleToken = params.get("access_token");
  if (!googleToken) return;

  localStorage.setItem("googleToken", googleToken);

  const user = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: "Bearer " + googleToken }
  }).then((r) => r.json());

  if (!user.email) {
    setStatus("Google login failed: missing email.", "error");
    return;
  }

  localStorage.setItem("googleUser", JSON.stringify(user));

if (emailEl) {
  emailEl.textContent = user.email;
}

const claimReturnPath = localStorage.getItem("claimReturnPath");

if (claimReturnPath) {
  localStorage.removeItem("claimReturnPath");
  window.location.href = claimReturnPath;
  return;
}

window.history.replaceState(null, "", "/app.html");
if (!isInvoicePaymentMode()) {
  showTab("dashboard");
  updateTopbarTitle("dashboard");

  window.history.replaceState(
    null,
    "",
    "/app.html#dashboard"
  );
}
  setStatus("Google login success. Preparing Circle user...");

  try {
    await api("/api/circle/create-user", {
      method: "POST",
      body: JSON.stringify({ email: user.email })
    });
  } catch (err) {
    console.warn("Create user warning:", err.message);
  }

  const { userToken } = await getCircleAuth();
  setStatus("Circle user ready. Click Setup Circle PIN.", "success");

  try {
  await loadCircleWallet(userToken);

  await restoreInvoiceAfterConnect();
} catch (err) {
  console.warn(
    "Load Circle wallet warning:",
    err
  );
}
}
// Setup Circle PIN and create wallet
async function setupCirclePin() {
  try {
    setStatus("Starting Circle PIN setup...");

    const cfg = await api("/api/circle/config");
    const appId = cfg?.config?.circleAppId;

    if (!appId) {
      setStatus("Missing CIRCLE_APP_ID in backend .env", "error");
      return;
    }

    const { userToken, encryptionKey } = await getCircleAuth();
    let challengeId = null;

    try {
      const initData = await api("/api/circle/initialize-user", {
        method: "POST",
        body: JSON.stringify({ userToken })
      });
      challengeId = initData?.data?.challengeId || initData?.challengeId;
    } catch (err) {
  if (String(err.message || "").includes("already been initialized")) {
    setStatus("User already initialized. Checking wallets...");

    const sdk = new W3SSdk({
      appSettings: { appId }
    });

    sdk.setAuthentication({
      userToken,
      encryptionKey
    });

    const listData = await listCircleWallets(userToken);
    const existingWallets = extractCircleWallets(listData);

    const requiredChains = [
      "ARC-TESTNET",
      "ETH-SEPOLIA",
      "BASE-SEPOLIA",
      "ARB-SEPOLIA",
      "AVAX-FUJI",
      "OP-SEPOLIA",
      "MATIC-AMOY",
      "UNI-SEPOLIA"
    ];

    const existingChains = new Set(
      existingWallets.map((wallet) =>
        String(wallet?.blockchain || "").toUpperCase()
      )
    );

    const missingChains = requiredChains.filter(
      (chain) => !existingChains.has(chain)
    );

    console.log("Existing Circle chains:", [...existingChains]);
    console.log("Missing Circle chains:", missingChains);

    if (missingChains.length === 0) {
  console.log("All required Circle chains already exist.");
  await loadCircleWallet(userToken);
  return;
}

console.log(
  "Creating missing Circle chains:",
  missingChains
);

const walletData = await api("/api/circle/create-wallet", {
  method: "POST",
  body: JSON.stringify({
    userToken,
    blockchains: missingChains
  })
});

console.log(
  "Missing Circle wallets creation response:",
  walletData
);

const walletChallengeId =
  walletData?.data?.challengeId ||
  walletData?.challengeId;

if (!walletChallengeId) {
  console.error(
    "No challengeId returned for missing Circle wallets:",
    walletData
  );

  setStatus(
    "Circle did not return a wallet creation challenge.",
    "error"
  );

  return;
}

setStatus(
  "Confirm creation of the missing Circle wallets...",
  "success"
);

await new Promise((resolve, reject) => {
  sdk.execute(walletChallengeId, (error, result) => {
    if (error) {
      console.error(
        "Missing Circle wallets creation error:",
        error
      );

      reject(error);
      return;
    }

    console.log(
      "Missing Circle wallets creation approved:",
      result
    );

    resolve(result);
  });
});

setStatus(
  "Circle wallets created. Loading wallets...",
  "success"
);

await new Promise((resolve) =>
  setTimeout(resolve, 3000)
);

await loadCircleWallet(userToken);
return;

  }

  throw err;
}

    if (!challengeId) {
      setStatus("No challengeId returned.", "error");
      return;
    }

    const sdk = new W3SSdk({ appSettings: { appId } });
    sdk.setAuthentication({ userToken, encryptionKey });

    sdk.execute(challengeId, async (error, result) => {
      if (error) {
        console.error("PIN setup error:", error);
        setStatus("PIN setup failed: " + (error.message || JSON.stringify(error)), "error");
        return;
      }

      console.log("PIN setup result:", result);
      setStatus("PIN setup completed. Creating wallet...");

      try {
        const walletData = await api("/api/circle/create-wallet", {
          method: "POST",
          body: JSON.stringify({ userToken })
        });

        console.log("Wallet response:", walletData);

const walletChallengeId =
  walletData?.data?.challengeId ||
  walletData?.challengeId;

if (walletChallengeId) {
  setStatus(
    "Confirm multi-chain wallet creation in Circle...",
    "success"
  );

  await new Promise((resolve, reject) => {
    sdk.execute(walletChallengeId, (error, result) => {
      if (error) {
        console.error(
          "Circle wallet creation error:",
          error
        );
        reject(error);
        return;
      }

      console.log(
        "Circle multi-chain wallet creation approved:",
        result
      );

      resolve(result);
    });
  });

  setStatus(
    "Circle wallets created. Loading wallets...",
    "success"
  );

  await new Promise((resolve) =>
    setTimeout(resolve, 3000)
  );

  await loadCircleWallet(userToken);
  return;
}

const address = extractWalletAddress(walletData);

if (address) {
  circleWalletEl.textContent = address;

  clearWeb3WalletLocal();

  activeWalletType = "circle";
  updateWalletChip(address, null);

  const hasProfile = await checkUserProfile(address);

  if (!hasProfile) {
    return;
  }

  setStatus(
  "Circle wallet and workspace created.",
  "success"
);

if (!isInvoicePaymentMode()) {
  showTab("dashboard");
  updateTopbarTitle("dashboard");
  window.location.hash = "dashboard";
}

return;
}
        await loadCircleWallet(userToken);
      } catch (err) {
        if (String(err.message || "").includes("already")) {
          await loadCircleWallet(userToken);
          return;
        }
        throw err;
      }
    });
  } catch (err) {
    console.error(err);
    setStatus("Setup PIN failed: " + err.message, "error");
  }
}

/* =========================
   INVOICES
========================= */

async function createInvoice() {
  console.log("CREATE INVOICE CLICKED");

let currentWorkspace = null;

try {
  currentWorkspace = JSON.parse(
    localStorage.getItem("currentWorkspace") || "null"
  );
} catch {
  currentWorkspace = null;
}

if (!currentWorkspace?.id) {
  setStatus(
    "Please select a workspace first.",
    "error"
  );
  return;
}

  try {
    const appKitAccount = getAccount(wagmiAdapter.wagmiConfig);
    const appKitWallet = appKitAccount?.address || null;

    const circleWallet =
      circleWalletEl?.textContent &&
      circleWalletEl.textContent.startsWith("0x")
        ? circleWalletEl.textContent.trim()
        : null;

    const recipientAddress =
      recipientEl.value && recipientEl.value.trim() !== ""
        ? recipientEl.value.trim()
        : (metamaskWallet || appKitWallet || circleWallet);

    if (!recipientAddress) {
      setStatus("Please connect MetaMask or Circle Wallet before creating invoice.", "error");
      return;
    }

    const recipientEmail = document.getElementById("invoiceEmail").value;

    const body = {
      title: titleEl.value,
      amount: amountEl.value,
      recipientEmail,
      dueDate: document.getElementById("invoiceDueDate").value,
      recipientAddress,
      targetChain: "Arc",
      note: noteEl.value,
      workspaceId: currentWorkspace.id,
    };

    // =========================
    // CASE 1: MetaMask create invoice
    // =========================
    if (metamaskWallet && window.ethereum) {
  setStatus("Checking Arc Testnet network...");

  await switchArc();

  const activeChainId = await window.ethereum.request({
    method: "eth_chainId",
  });

  if (
    String(activeChainId).toLowerCase() !==
    String(ARC_CHAIN_HEX).toLowerCase()
  ) {
    throw new Error("Please switch your wallet to Arc Testnet.");
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const contract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        signer
      );

      const tx = await contract.createInvoice(
        recipientAddress,
        ethers.parseUnits(amountEl.value, 6),
        noteEl.value
      );

      const receipt = await tx.wait();

      let onchainId = null;

      for (const log of receipt.logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          const id = parsed.args.invoiceId ?? parsed.args.id ?? parsed.args[0];

          if (id !== undefined) {
            onchainId = Number(id);
            break;
          }
        } catch (e) {}
      }

      if (onchainId === null) {
        throw new Error("Cannot read onchain invoice id from contract event");
      }

      body.txHash = tx.hash;
      body.onchainId = onchainId;
    }

else if (appKitWallet) {
  setStatus("AppKit: creating invoice on contract...");

  const nextId = await readContract(wagmiAdapter.wagmiConfig, {
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "nextInvoiceId",
  });

  const hash = await writeContract(wagmiAdapter.wagmiConfig, {
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "createInvoice",
    args: [
      recipientAddress,
      parseUnits(String(amountEl.value), 6),
      noteEl.value || "",
    ],
  });

  await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash });

  body.txHash = hash;
  body.onchainId = Number(nextId);
}

    // =========================
    // CASE 2: Circle create invoice
    // =========================
    else if (circleWallet) {
      const cfg = await api("/api/circle/config");
      const appId = cfg?.config?.circleAppId;

      if (!appId) {
        throw new Error("Missing CIRCLE_APP_ID.");
      }

      const { userToken, encryptionKey } = await getCircleAuth();

      const walletList = await listCircleWallets(userToken);
      const wallet = extractWallet(walletList);

      if (!wallet || !wallet.id) {
        throw new Error("No Circle wallet found.");
      }

      const readProvider = new ethers.JsonRpcProvider(ARC_RPC);
      const readContract = new ethers.Contract(
        CONTRACT_ADDRESS,
        CONTRACT_ABI,
        readProvider
      );

      const nextId = await readContract.nextInvoiceId();
      const onchainId = Number(nextId);

      const sdk = new W3SSdk({ appSettings: { appId } });
      sdk.setAuthentication({ userToken, encryptionKey });

      setStatus("Circle: creating invoice on contract...");

      const createData = await api("/api/circle/contract-execution", {
        method: "POST",
        body: JSON.stringify({
          userToken,
          walletId: wallet.id,
          contractAddress: CONTRACT_ADDRESS,
          abiFunctionSignature: "createInvoice(address,uint256,string)",
          abiParameters: [
            recipientAddress,
            toTokenUnits(amountEl.value, USDC_DECIMALS),
            noteEl.value || ""
          ]
        })
      });

      const challengeId =
        createData?.data?.challengeId || createData?.challengeId;

      if (!challengeId) {
        throw new Error("No Circle createInvoice challengeId returned.");
      }

      await new Promise((resolve, reject) => {
        sdk.execute(challengeId, (error, result) => {
          if (error) {
            reject(error);
            return;
          }
          console.log("Circle createInvoice approved:", result);
          resolve(result);
        });
      });

      await new Promise((resolve) => setTimeout(resolve, 9000));

      const txData = await api("/api/circle/transactions", {
        method: "POST",
        body: JSON.stringify({ userToken })
      });

      const tx =
        txData?.data?.transactions?.find((t) => {
          const contract =
            String(t.contractAddress || t.destinationAddress || "").toLowerCase();
          return contract === CONTRACT_ADDRESS.toLowerCase();
        }) ||
        txData?.data?.transactions?.[0] ||
        null;

      body.txHash =
        tx?.txHash ||
        tx?.transactionHash ||
        tx?.blockchainTxHash ||
        tx?.id ||
        "circle_create_pending";

      body.onchainId = onchainId;
    }

    const data = await api("/api/invoices", {
      method: "POST",
      body: JSON.stringify(body)
    });

    selectedInvoice = data.invoice;
    renderSelectedInvoice();
    await loadInvoices();

    setStatus("Invoice created.", "success");
  } catch (err) {
    setStatus("Create invoice failed: " + err.message, "error");
  }
}

async function saveBusinessProfile() {
  try {
    const currentWorkspace = JSON.parse(
      localStorage.getItem("currentWorkspace") || "null"
    );

    if (!currentWorkspace?.id) {
      setStatus(
        "Please select a workspace first.",
        "error"
      );
      return;
    }

    // Web3/AppKit wallet
    const appKitAccount = getAccount(
      wagmiAdapter.wagmiConfig
    );

    const appKitWallet =
      appKitAccount?.address || null;

    // Circle Wallet
    const circleWallet =
      circleWalletEl?.textContent &&
      circleWalletEl.textContent.trim().startsWith("0x")
        ? circleWalletEl.textContent.trim()
        : null;

    // Wallet entered manually in Business form
    const businessWallet =
      String(bizWalletEl.value || "").trim();

    // Prefer manual value, then Web3, then Circle
    const resolvedWallet =
      businessWallet ||
      metamaskWallet ||
      appKitWallet ||
      circleWallet;

    if (!resolvedWallet) {
      setStatus(
        "Please connect a Web3 wallet or Circle Wallet first.",
        "error"
      );
      return;
    }

    const body = {
      workspaceId: currentWorkspace.id,
      name: String(
        bizNameEl.value || ""
      ).trim(),
      email: String(
        bizEmailEl.value || ""
      )
        .trim()
        .toLowerCase(),
      wallet: resolvedWallet
    };

    const data = await api(
      "/api/business-profile",
      {
        method: "POST",
        body: JSON.stringify(body)
      }
    );

    // Keep the Business wallet field synchronized
    bizWalletEl.value = resolvedWallet;

    setStatus(
      data.message ||
        "Business profile saved.",
      "success"
    );
  } catch (err) {
    console.error(
      "Save business profile error:",
      err
    );

    setStatus(
      err.message ||
        "Business profile save failed.",
      "error"
    );
  }
}

async function loadBusinessProfile() {
  try {
    const currentWorkspace = JSON.parse(
      localStorage.getItem("currentWorkspace") || "null"
    );

    if (!currentWorkspace?.id) {
      bizNameEl.value = "";
      bizEmailEl.value = "";
      bizWalletEl.value = "";
      return;
    }

    const data = await api(
      `/api/business-profile?workspaceId=${encodeURIComponent(
        currentWorkspace.id
      )}`
    );

    const profile = data.profile || null;

    bizNameEl.value = profile?.name || "";
    bizEmailEl.value = profile?.email || "";
    bizWalletEl.value = profile?.wallet || "";
  } catch (err) {
    console.error(
      "Load business profile error:",
      err
    );

    bizNameEl.value = "";
    bizEmailEl.value = "";
    bizWalletEl.value = "";
  }
}

function renderCustomerDropdown() {
  if (!customerSelectEl) return;

  const customers = getWorkspaceCustomers();

  const previousValue =
    customerSelectEl.value || "";

  customerSelectEl.innerHTML =
    `<option value="">-- Choose customer --</option>`;

  customers.forEach((customer) => {
    const option = document.createElement("option");

    option.value = customer.id;

    const walletPreview = customer.wallet
      ? `${customer.wallet.slice(0, 6)}...${customer.wallet.slice(-4)}`
      : "no wallet";

    option.textContent =
      `${customer.name || "Customer"} (${walletPreview})`;

    customerSelectEl.appendChild(option);
  });

  if (
    previousValue &&
    customers.some(
      (customer) =>
        customer.id === previousValue
    )
  ) {
    customerSelectEl.value = previousValue;
  }

  customerSelectEl.classList.add(
    "tror-native-select-hidden"
  );

  let root =
    document.getElementById(
      "customerSelectCustom"
    );

  if (!root) {
    root = document.createElement("div");
    root.id = "customerSelectCustom";
    root.className = "tror-customer-select";

    const button = document.createElement("button");
    button.id = "customerSelectCustomButton";
    button.type = "button";
    button.className =
      "tror-customer-select__button";
    button.setAttribute(
      "aria-haspopup",
      "listbox"
    );
    button.setAttribute(
      "aria-expanded",
      "false"
    );

    const menu = document.createElement("div");
    menu.id = "customerSelectCustomMenu";
    menu.className =
      "tror-customer-select__menu";
    menu.setAttribute("role", "listbox");
    menu.hidden = true;

    root.appendChild(button);
    root.appendChild(menu);

    customerSelectEl.insertAdjacentElement(
      "afterend",
      root
    );

    button.addEventListener(
      "click",
      (event) => {
        event.stopPropagation();

        const willOpen = menu.hidden;
        menu.hidden = !willOpen;
        root.classList.toggle(
          "is-open",
          willOpen
        );

        button.setAttribute(
          "aria-expanded",
          String(willOpen)
        );
      }
    );
  }

  const button =
    document.getElementById(
      "customerSelectCustomButton"
    );

  const menu =
    document.getElementById(
      "customerSelectCustomMenu"
    );

  if (!button || !menu) return;

  const closeMenu = () => {
    menu.hidden = true;
    root.classList.remove("is-open");
    button.setAttribute(
      "aria-expanded",
      "false"
    );
  };

  const selectedCustomer =
    customers.find(
      (customer) =>
        customer.id === customerSelectEl.value
    ) || null;

  button.textContent = selectedCustomer
    ? selectedCustomer.name || "Customer"
    : "-- Choose customer --";

  menu.innerHTML = "";

  const placeholder =
    document.createElement("button");

  placeholder.type = "button";
  placeholder.className =
    "tror-customer-select__option";

  if (!selectedCustomer) {
    placeholder.classList.add(
      "is-selected"
    );
  }

  placeholder.textContent =
    "-- Choose customer --";

  placeholder.addEventListener(
    "click",
    () => {
      closeMenu();
      customerSelectEl.value = "";
      customerSelectEl.dispatchEvent(
        new Event("change", {
          bubbles: true
        })
      );
      renderCustomerDropdown();
    }
  );

  menu.appendChild(placeholder);

  customers.forEach((customer) => {
    const option =
      document.createElement("button");

    option.type = "button";
    option.className =
      "tror-customer-select__option";

    const walletPreview = customer.wallet
      ? `${customer.wallet.slice(0, 6)}...${customer.wallet.slice(-4)}`
      : "no wallet";

    const isSelected =
      customer.id === customerSelectEl.value;

    if (isSelected) {
      option.classList.add(
        "is-selected"
      );
    }

    const label =
      document.createElement("span");

    label.textContent =
      `${customer.name || "Customer"} (${walletPreview})`;

    option.appendChild(label);

    if (isSelected) {
      const check =
        document.createElement("span");
      check.textContent = "✓";
      check.style.fontWeight = "900";
      check.style.color = "#9b762b";
      option.appendChild(check);
    }

    option.addEventListener(
      "click",
      () => {
        closeMenu();

        customerSelectEl.value =
          customer.id;

        customerSelectEl.dispatchEvent(
          new Event("change", {
            bubbles: true
          })
        );

        renderCustomerDropdown();
      }
    );

    menu.appendChild(option);
  });

  if (!window.__trorCustomerOutsideClickBound) {
    window.__trorCustomerOutsideClickBound = true;

    document.addEventListener(
      "click",
      (event) => {
        const currentRoot =
          document.getElementById(
            "customerSelectCustom"
          );

        if (
          currentRoot &&
          !currentRoot.contains(event.target)
        ) {
          const currentMenu =
            document.getElementById(
              "customerSelectCustomMenu"
            );

          const currentButton =
            document.getElementById(
              "customerSelectCustomButton"
            );

          if (currentMenu) {
            currentMenu.hidden = true;
          }

          currentRoot.classList.remove(
            "is-open"
          );

          currentButton?.setAttribute(
            "aria-expanded",
            "false"
          );
        }
      }
    );
  }
}

async function loadInvoices() {
  try {
    let currentWorkspace = null;

try {
  currentWorkspace = JSON.parse(
    localStorage.getItem("currentWorkspace") || "null"
  );
} catch {
  currentWorkspace = null;
}

if (!currentWorkspace?.id) {
  invoiceListEl.innerHTML =
    `<div class="box">Select a workspace to view invoices.</div>`;
  return;
}

const data = await api(
  "/api/invoices?workspaceId=" +
    encodeURIComponent(currentWorkspace.id)
);
    const invoices = data.invoices || [];

    invoiceListEl.innerHTML = "";

    if (!invoices.length) {
      invoiceListEl.innerHTML = `<div class="box">No invoices yet.</div>`;
      return;
    }

    invoices.forEach((inv) => {
      // Mark overdue if past due date and not paid
      if (inv.status !== "PAID" && inv.dueDate && new Date() > new Date(inv.dueDate)) {
        inv.status = "OVERDUE";
      }

      const div = document.createElement("div");
      div.className = "invoice";

      div.innerHTML = `
        <div class="invoice-title">${escapeHtml(inv.title)}</div>
        <div>${formatUsdc(inv.amount)} USDC</div>
        <div>
          <b>Status:</b>
          <span class="${
            inv.status === "PAID" ? "status-paid" :
            inv.status === "OVERDUE" ? "status-overdue" :
            inv.status === "REMINDER" ? "status-reminder" :
            "status-created"
          }">
            ${escapeHtml(inv.status)}
          </span>
        </div>
        <div><b>ID:</b> ${escapeHtml(inv.id)}</div>
        <div><b>Due:</b> ${inv.dueDate || "No due date"}</div>
        <div><b>Recipient:</b> ${escapeHtml(inv.recipientAddress)}</div>
        <div class="row">
          <button data-open="${escapeHtml(inv.id)}">Open</button>
        </div>
      `;

      invoiceListEl.appendChild(div);
    });

    invoiceListEl.querySelectorAll("[data-open]").forEach((btn) => {
      btn.addEventListener("click", () => openInvoice(btn.dataset.open));
    });
  } catch (err) {
    setStatus("Load invoices failed: " + err.message, "error");
  }
}

async function openInvoice(id) {
  try {
    const data = await api("/api/invoices/" + encodeURIComponent(id));
    selectedInvoice = data.invoice;

    renderSelectedInvoice();
    openInvoiceSheet(selectedInvoice);
    setStatus("Invoice opened.", "success");
  } catch (err) {
    setStatus("Open invoice failed: " + err.message, "error");
  }
}

function openInvoiceSheet(inv) {
  const sheet = document.getElementById("invoiceSheet");
  const sheetTitle = document.getElementById("sheetTitle");
  const sheetBody = document.getElementById("sheetBody");
  const sheetQR = document.getElementById("sheetQR");
  const copyBtn = document.getElementById("sheetCopyLink");
  const payBtn = document.getElementById("sheetPayInvoice");

  if (!sheet || !inv) return;

  const payUrl = getInvoicePayUrl(inv);
  const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(payUrl);

  if (sheetTitle) sheetTitle.textContent = inv.title || "Invoice";

  if (sheetBody) {
    sheetBody.innerHTML = `
      <div><b>${escapeHtml(inv.title || "")}</b></div>
      <div>${formatUsdc(inv.amount)} USDC</div>
      <div>Status: ${escapeHtml(inv.status || "")}</div>
      <div>ID: ${escapeHtml(inv.id || "")}</div>
      <div>Recipient: ${escapeHtml(inv.recipientAddress || "")}</div>

<div style="margin-top:12px;">
  <label style="display:block;font-size:12px;opacity:.8;margin-bottom:6px;">
    Payment Memo / Reference (optional)
  </label>
  <input
    id="paymentMemoInput"
    type="text"
    maxlength="120"
    placeholder="Example: Coffee payment, Invoice #1025"
    style="width:100%;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);color:white;"
  />
</div>
    `;
  }

  if (sheetQR) {
    sheetQR.innerHTML = `
      <div class="sheet-qr-card">
        <img class="sheet-qr-img" src="${qrUrl}" alt="Invoice QR" />
        <div class="sheet-link-card">
          <div class="sheet-link-label">Payment Link</div>
          <a href="${payUrl}" target="_blank" rel="noreferrer">${payUrl}</a>
          <div class="row" style="margin-top:12px;">
          </div>
        </div>
      </div>
    `;
  }

  sheet.classList.remove("hidden");

  if (copyBtn) {
    copyBtn.onclick = async () => {
      await navigator.clipboard.writeText(payUrl);
      setStatus("Payment link copied.", "success");
    };
  }

  const copyRecipientBtn = document.getElementById("sheetCopyRecipient");
  if (copyRecipientBtn) {
    copyRecipientBtn.onclick = async () => {
      await navigator.clipboard.writeText(inv.recipientAddress || "");
      setStatus("Recipient address copied.", "success");
    };
  }

if (payBtn) {
  if (inv.status === "PAID") {
    payBtn.textContent = "Paid";
    payBtn.disabled = true;
    payBtn.style.opacity = "0.6";
    payBtn.style.cursor = "not-allowed";
  } else {
    payBtn.textContent = "Pay Invoice";
    payBtn.disabled = false;
    payBtn.style.opacity = "1";
    payBtn.style.cursor = "pointer";
  }
}

  if (payBtn) {
  payBtn.onclick = async () => {
    if (metamaskWallet && window.ethereum) {
  await payWithArcMemoMetaMask();
  return;
}

const appKitAccount = getAccount(wagmiAdapter.wagmiConfig);
if (appKitAccount?.address) {
  await payWithAppKit();
  return;
}

    const circleAddress = circleWalletEl?.textContent?.trim();
    if (circleAddress && circleAddress.startsWith("0x")) {
      await payWithCircleWallet();
      return;
    }

    setStatus("Please connect Web3 wallet or Circle Wallet first.", "error");
  };
}
}

function closeInvoiceSheet() {
  document.getElementById("invoiceSheet")?.classList.add("hidden");
}

function renderSelectedInvoice() {
  if (!selectedInvoice) {
    if (selectedInvoiceEl) selectedInvoiceEl.textContent = "No invoice selected.";
    renderQR(null);
    return;
  }

  if (selectedInvoiceEl) {
    selectedInvoiceEl.innerHTML = `
      <div><b>${escapeHtml(selectedInvoice.title || "")}</b></div>
      <div>${formatUsdc(selectedInvoice.amount)} USDC</div>
      <div>Status: ${escapeHtml(selectedInvoice.status || "")}</div>
      <div>ID: ${escapeHtml(selectedInvoice.id || "")}</div>
      <div>Recipient: ${escapeHtml(selectedInvoice.recipientAddress || "")}</div>
      ${selectedInvoice.status === "PAID" && selectedInvoice.txHash ? `
<div>
  TX:
  <a
    href="https://testnet.arcscan.app/tx/${selectedInvoice.txHash}"
    target="_blank"
  >
    View TX
  </a>
</div>
${selectedInvoice.paymentMemo ? `
<div>
  <strong>Payment Memo:</strong><br>
  ${escapeHtml(selectedInvoice.paymentMemo)}
</div>
` : ""}
` : `
<div>
  TX: -
</div>
`}
    `;
  }

  renderQR(selectedInvoice);
}

/* =========================
   METAMASK PAYMENT
========================= */

function isInvoicePaymentMode() {
  const invoiceId =
    new URLSearchParams(
      window.location.search
    ).get("invoice");

  const savedReturnPath =
    localStorage.getItem("invoiceReturnPath");

  return Boolean(
    invoiceId || savedReturnPath
  );
}

async function checkUserProfile(walletAddress) {

  if (isInvoicePaymentMode()) {
    await restoreInvoiceAfterConnect();

    setStatus(
      "Wallet connected. Ready to pay invoice.",
      "success"
    );

    return true;
  }

console.log("CHECK PROFILE WALLET:", walletAddress);

  try {
    const response = await fetch(
      `${API_BASE}/api/users/${encodeURIComponent(
        walletAddress.toLowerCase()
      )}`
    );

    const data = await response.json().catch(() => ({}));

    console.log("PROFILE RESPONSE:", data);

    if (response.status === 404 || data.exists === false) {
      localStorage.removeItem("currentUser");
      localStorage.removeItem("currentWorkspace");

      openCreateProfileModal(walletAddress);

return false;

      return false;
    }

    if (!response.ok) {
      throw new Error(
        data.error || "Failed to check user profile."
      );
    }

    localStorage.setItem(
  "currentUser",
  JSON.stringify(data.user)
);

await loadUserWorkspaces(walletAddress);

await restoreInvoiceAfterConnect();

return true;

  } catch (err) {
    console.error("Check user profile error:", err);

    setStatus(
      "Profile check failed: " + err.message,
      "error"
    );

    return false;
  }
}

async function loadUserWorkspaces(walletAddress) {
console.log("LOADING WORKSPACES FOR:", walletAddress);

  const data = await api(
    "/api/workspaces/" +
      encodeURIComponent(walletAddress.toLowerCase())
  );

  const workspaces = data.workspaces || [];

  localStorage.setItem(
    "userWorkspaces",
    JSON.stringify(workspaces)
  );

  let currentWorkspace = null;

  try {
    currentWorkspace = JSON.parse(
      localStorage.getItem("currentWorkspace") || "null"
    );
  } catch {
    currentWorkspace = null;
  }

  const stillExists = workspaces.find(
    (workspace) =>
      workspace.id === currentWorkspace?.id
  );

  if (!stillExists && workspaces.length > 0) {
    currentWorkspace = workspaces[0];

    localStorage.setItem(
      "currentWorkspace",
      JSON.stringify(currentWorkspace)
    );
  }

  renderWorkspaceSwitcher(workspaces, currentWorkspace);

  return workspaces;
}

async function createBusinessWorkspace() {
  const appKitAccount = getAccount(
    wagmiAdapter.wagmiConfig
  );

  const appKitWallet =
    appKitAccount?.address || null;

  const circleWallet =
    circleWalletEl?.textContent &&
    circleWalletEl.textContent.trim().startsWith("0x")
      ? circleWalletEl.textContent.trim()
      : null;

  const wallet =
    metamaskWallet ||
    appKitWallet ||
    circleWallet;

  if (!wallet) {
    alert(
      "Please connect a Web3 wallet or Circle Wallet first."
    );
    return;
  }

  const workspaceName = prompt(
    "Business workspace name:"
  );

  if (!workspaceName?.trim()) {
    return;
  }

  try {
    const data = await api(
      "/api/workspaces",
      {
        method: "POST",
        body: JSON.stringify({
          walletAddress: wallet,
          workspaceName:
            workspaceName.trim()
        })
      }
    );

    if (!data?.workspace) {
      throw new Error(
        "Workspace was not returned."
      );
    }

    localStorage.setItem(
      "currentWorkspace",
      JSON.stringify(data.workspace)
    );

    await loadUserWorkspaces(wallet);

    window.dispatchEvent(
      new CustomEvent(
        "workspaceChanged",
        {
          detail: {
            workspace:
              data.workspace
          }
        }
      )
    );

    alert(
      "Business workspace created."
    );
  } catch (err) {
    console.error(
      "Create business workspace error:",
      err
    );

    alert(
      err?.message ||
        "Business workspace creation failed."
    );
  }
}

function renderWorkspaceSwitcher(
  workspaces,
  currentWorkspace
) {
  console.log(
    "RENDER WORKSPACE SWITCHER:",
    workspaces,
    currentWorkspace
  );

  let switcher =
    document.getElementById("workspaceSwitcher");

  const oldCreateBtn =
    document.getElementById(
      "createBusinessWorkspaceBtn"
    );

  if (oldCreateBtn) {
    oldCreateBtn.remove();
  }

  if (!switcher || switcher.tagName === "SELECT") {
    if (switcher) switcher.remove();

    switcher = document.createElement("div");
    switcher.id = "workspaceSwitcher";
    switcher.className = "tror-custom-select";

    const button = document.createElement("button");
    button.id = "workspaceSwitcherButton";
    button.type = "button";
    button.className = "tror-custom-select__button";
    button.setAttribute("aria-haspopup", "listbox");
    button.setAttribute("aria-expanded", "false");

    const menu = document.createElement("div");
    menu.id = "workspaceSwitcherMenu";
    menu.className = "tror-custom-select__menu";
    menu.setAttribute("role", "listbox");
    menu.hidden = true;

    switcher.appendChild(button);
    switcher.appendChild(menu);

    const walletChip =
      document.getElementById("walletChip");

    const connectButton =
      document.getElementById("btnConnectWallet");

    const targetElement =
      walletChip || connectButton;

    if (targetElement?.parentElement) {
      targetElement.parentElement.insertBefore(
        switcher,
        targetElement
      );
    } else {
      document.body.appendChild(switcher);
      switcher.style.position = "fixed";
      switcher.style.top = "18px";
      switcher.style.right = "220px";
      switcher.style.zIndex = "999999";
    }

    button.addEventListener("click", (event) => {
      event.stopPropagation();

      const willOpen = menu.hidden;
      menu.hidden = !willOpen;
      switcher.classList.toggle("is-open", willOpen);
      button.setAttribute(
        "aria-expanded",
        String(willOpen)
      );
    });
  }

  const button =
    document.getElementById(
      "workspaceSwitcherButton"
    );

  const menu =
    document.getElementById(
      "workspaceSwitcherMenu"
    );

  if (!button || !menu) return;

  const closeWorkspaceMenu = () => {
    menu.hidden = true;
    switcher.classList.remove("is-open");
    button.setAttribute("aria-expanded", "false");
  };

  const getWorkspaceLabel = (workspace) =>
    workspace?.workspace_type === "BUSINESS"
      ? `🏢 ${workspace.workspace_name}`
      : `👤 ${workspace.workspace_name}`;

  const activeWorkspace =
    workspaces.find(
      (workspace) =>
        workspace.id === currentWorkspace?.id
    ) ||
    workspaces[0] ||
    null;

  button.textContent = activeWorkspace
    ? getWorkspaceLabel(activeWorkspace)
    : "Select workspace";

  switcher.dataset.value =
    activeWorkspace?.id || "";

  menu.innerHTML = "";

  const applyWorkspace = (selectedWorkspace) => {
    if (!selectedWorkspace) return;

    localStorage.setItem(
      "currentWorkspace",
      JSON.stringify(selectedWorkspace)
    );

    selectedInvoice = null;
    renderSelectedInvoice();
    closeInvoiceSheet();
    renderCustomerDropdown();

    loadWorkspaceClaims().catch((err) => {
      console.error(
        "Reload workspace claims error:",
        err
      );
    });

    loadInvoices().catch((err) => {
      console.error(
        "Reload workspace invoices error:",
        err
      );
    });

    loadEmployees().catch((err) => {
      console.error(
        "Reload workspace employees error:",
        err
      );
    });

    setStatus(
      `Workspace switched to ${selectedWorkspace.workspace_name}.`,
      "success"
    );

    window.dispatchEvent(
      new CustomEvent("workspaceChanged", {
        detail: selectedWorkspace
      })
    );

    renderWorkspaceSwitcher(
      workspaces,
      selectedWorkspace
    );
  };

  workspaces.forEach((workspace) => {
    const option =
      document.createElement("button");

    option.type = "button";
    option.className =
      "tror-custom-select__option";

    const isSelected =
      workspace.id === activeWorkspace?.id;

    if (isSelected) {
      option.classList.add("is-selected");
    }

    option.setAttribute(
      "aria-selected",
      String(isSelected)
    );

    const label = document.createElement("span");
    label.textContent = getWorkspaceLabel(workspace);
    option.appendChild(label);

    if (isSelected) {
      const check = document.createElement("span");
      check.className = "tror-custom-select__check";
      check.textContent = "✓";
      option.appendChild(check);
    }

    option.addEventListener("click", () => {
      closeWorkspaceMenu();

      if (workspace.id === activeWorkspace?.id) {
        return;
      }

      applyWorkspace(workspace);
    });

    menu.appendChild(option);
  });

  const createBusinessOption =
    document.createElement("button");

  createBusinessOption.type = "button";
  createBusinessOption.className =
    "tror-custom-select__create";
  createBusinessOption.textContent =
    "+ Create business workspace";

  createBusinessOption.addEventListener(
    "click",
    () => {
      closeWorkspaceMenu();
      createBusinessWorkspace();
    }
  );

  menu.appendChild(createBusinessOption);

  if (!window.__trorWorkspaceOutsideClickBound) {
    window.__trorWorkspaceOutsideClickBound = true;

    document.addEventListener("click", (event) => {
      const root =
        document.getElementById(
          "workspaceSwitcher"
        );

      if (root && !root.contains(event.target)) {
        const rootMenu =
          document.getElementById(
            "workspaceSwitcherMenu"
          );

        const rootButton =
          document.getElementById(
            "workspaceSwitcherButton"
          );

        if (rootMenu) rootMenu.hidden = true;
        root.classList.remove("is-open");
        rootButton?.setAttribute(
          "aria-expanded",
          "false"
        );
      }
    });
  }
}

async function connectMetaMask() {
  try {
    if (!window.ethereum) {
      setStatus("Install a Web3 wallet first.", "error");
      return;
    }

    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    metamaskWallet = accounts[0] || null;
    metamaskWalletEl.textContent = metamaskWallet || "Disconnected";

    // Update topbar wallet chip
    updateWalletChip(metamaskWallet, null);
    clearCircleWalletLocal();
    activeWalletType = "web3";
    const hasProfile =
  await checkUserProfile(metamaskWallet);

  if (!hasProfile) {
    return;
  }
    setStatus("Wallet connected.", "success");
  } catch (err) {
    setStatus("MetaMask connect failed: " + err.message, "error");
  }
}

function disconnectMetaMask() {
  metamaskWallet = null;
  if (metamaskWalletEl) metamaskWalletEl.textContent = "Disconnected";

  // Reset topbar wallet chip
  updateWalletChip(null, null);
  setStatus("MetaMask disconnected locally.", "success");
}

// Switch to Arc Testnet or add it when missing
async function switchArc() {
  if (!window.ethereum) {
    throw new Error("No Web3 wallet detected.");
  }

  const currentChainId = await window.ethereum.request({
    method: "eth_chainId",
  });

  // Already on Arc Testnet
  if (
    String(currentChainId).toLowerCase() ===
    String(ARC_CHAIN_HEX).toLowerCase()
  ) {
    return true;
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_CHAIN_HEX }],
    });

    return true;
  } catch (switchError) {
    const errorCode = Number(switchError?.code);

    // 4902 = wallet does not have this network yet
    if (errorCode !== 4902) {
      throw switchError;
    }
  }

  await window.ethereum.request({
    method: "wallet_addEthereumChain",
    params: [
      {
        chainId: ARC_CHAIN_HEX,
        chainName: ARC_CHAIN_NAME,

        nativeCurrency: {
          name: "USDC",
          symbol: "USDC",
          decimals: 18,
        },

        rpcUrls: [ARC_RPC],
        blockExplorerUrls: [ARC_EXPLORER],
      },
    ],
  });

  // Some wallets add the network but do not switch automatically
  await window.ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: ARC_CHAIN_HEX }],
  });

  return true;
}

async function payWithMetaMask() {
  try {
    if (!window.ethereum) {
      setStatus("Install a Web3 wallet first.", "error");
      return;
    }

    if (!metamaskWallet) await connectMetaMask();
    if (!metamaskWallet) {
      setStatus("Connect wallet first.", "error");
      return;
    }

    if (!selectedInvoice) {
      setStatus("Open invoice first.", "error");
      return;
    }

    const chainId = await window.ethereum.request({ method: "eth_chainId" });

    if (parseInt(chainId, 16) !== ARC_CHAIN_ID) {
      setStatus("Switching to Arc network...");
      await switchArc();

      const newChainId = await window.ethereum.request({ method: "eth_chainId" });
      if (parseInt(newChainId, 16) !== ARC_CHAIN_ID) {
        setStatus("Wrong network. Please switch to Arc Testnet in wallet.", "error");
        return;
      }
    }

    if (selectedInvoice.status === "PAID") {
      setStatus("Invoice already paid.", "success");
      return;
    }

    const web3 = new Web3(window.ethereum);
    web3.eth.transactionBlockTimeout = 200;
    web3.eth.transactionPollingTimeout = 900;
    web3.eth.transactionConfirmationBlocks = 1;

    const token = new web3.eth.Contract(ERC20_ABI, USDC_TOKEN);
    const amountUnits = toTokenUnits(selectedInvoice.amount, USDC_DECIMALS);

    setStatus("Sending MetaMask USDC transaction...");

    const contract = new web3.eth.Contract(
  CONTRACT_ABI,
  CONTRACT_ADDRESS
);

setStatus("Approving USDC...");

console.log("Invoice amount:", selectedInvoice.amount);
console.log("USDC decimals:", USDC_DECIMALS);
console.log("amountUnits:", amountUnits);

await token.methods
  .approve(CONTRACT_ADDRESS, amountUnits)
  .send({
    from: metamaskWallet,
    gas: 120000
  });

setStatus("Paying invoice onchain...");

if (
  selectedInvoice.onchainId === undefined ||
  selectedInvoice.onchainId === null
) {
  throw new Error("Missing onchainId");
}
const tx = await contract.methods
  .payInvoice(selectedInvoice.onchainId)
  .send({
    from: metamaskWallet,
    gas: 250000
  });

await markInvoicePaid(tx.transactionHash, metamaskWallet);

setStatus(
  "Invoice paid onchain: " + tx.transactionHash,
  "success"
);
    setStatus("MetaMask payment success: " + tx.transactionHash, "success");
  } catch (err) {
    setStatus("MetaMask payment failed: " + err.message, "error");
  }
}

async function payWithArcMemoMetaMask() {
  try {
    if (!window.ethereum) {
      setStatus("Install a Web3 wallet first.", "error");
      return;
    }

    if (!metamaskWallet) await connectMetaMask();
    if (!metamaskWallet) {
      setStatus("Connect wallet first.", "error");
      return;
    }

    if (!selectedInvoice) {
      setStatus("Open invoice first.", "error");
      return;
    }

setStatus("Checking Arc Testnet network...");

await switchArc();

const activeChainId = await window.ethereum.request({
  method: "eth_chainId",
});

if (
  String(activeChainId).toLowerCase() !==
  String(ARC_CHAIN_HEX).toLowerCase()
) {
  throw new Error("Please switch your wallet to Arc Testnet.");
}

const paymentMemo =
  document.getElementById("paymentMemoInput")?.value?.trim() || "";

    if (selectedInvoice.status === "PAID") {
      setStatus("Invoice already paid.", "success");
      return;
    }

    if (selectedInvoice.onchainId === undefined || selectedInvoice.onchainId === null) {
      throw new Error("Missing onchainId");
    }

    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();

    const token = new ethers.Contract(
      USDC_TOKEN,
      ["function approve(address spender, uint256 amount) returns (bool)"],
      signer
    );

    const invoice = new ethers.Contract(
      CONTRACT_ADDRESS,
      CONTRACT_ABI,
      signer
    );

    const memo = new ethers.Contract(
      MEMO_ADDRESS,
      MEMO_ABI,
      signer
    );

    const amountUnits = ethers.parseUnits(String(selectedInvoice.amount), 6);

    setStatus("Approving USDC for TROR contract...");

    const approveTx = await token.approve(CONTRACT_ADDRESS, amountUnits);
    await approveTx.wait();

    const payData = invoice.interface.encodeFunctionData("payInvoice", [
      BigInt(selectedInvoice.onchainId)
    ]);

    const memoId = ethers.id(`tror-invoice-${selectedInvoice.onchainId}`);

    const memoText =
  paymentMemo !== ""
    ? paymentMemo
    : `TROR invoice payment | invoiceId=${selectedInvoice.id} | onchainId=${selectedInvoice.onchainId} | amount=${selectedInvoice.amount} USDC`;

const memoData = ethers.hexlify(
  ethers.toUtf8Bytes(memoText)
);

    setStatus("Paying invoice with Arc Memo...");

    const tx = await memo.memo(
      CONTRACT_ADDRESS,
      payData,
      memoId,
      memoData
    );

    await tx.wait();

    await markInvoicePaid(tx.hash, metamaskWallet);

    setStatus("Invoice paid with Arc Memo: " + tx.hash, "success");
  } catch (err) {
    console.error(err);
    setStatus("Arc Memo payment failed: " + (err.message || err), "error");
  }
}

async function payWithAppKit() {
  try {
    if (!selectedInvoice) {
      setStatus("No invoice selected.", "error");
      return;
    }

const paymentMemo =
  document.getElementById("paymentMemoInput")?.value?.trim() || "";

    const account = getAccount(wagmiAdapter.wagmiConfig);

    if (!account?.address) {
      walletModalMode = "pay";
      await openAppKitWallet();
      return;
    }

setStatus("Switching wallet to Arc Testnet...");

await appKit.switchNetwork(arcTestnet);

const activeAccount = getAccount(wagmiAdapter.wagmiConfig);

if (
  Number(activeAccount?.chainId) !== ARC_CHAIN_ID
) {
  throw new Error(
    "Please approve switching your wallet to Arc Testnet."
  );
}

    const recipient =
      selectedInvoice.recipientAddress ||
      selectedInvoice.recipient ||
      selectedInvoice.merchantAddress;

    const amount = parseUnits(String(selectedInvoice.amount), 6);

    const contractInvoiceId =
  selectedInvoice.onchainId ?? selectedInvoice.contractInvoiceId;

if (contractInvoiceId === undefined || contractInvoiceId === null || contractInvoiceId === "") {
  throw new Error("Missing onchain invoice id. Please recreate this invoice.");
}

setStatus("AppKit: approving USDC...", "info");

const approveHash = await writeContract(wagmiAdapter.wagmiConfig, {
  address: USDC_TOKEN,
  abi: ERC20_ABI,
  functionName: "approve",
  args: [CONTRACT_ADDRESS, amount],
});

await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, {
  hash: approveHash,
});

setStatus("AppKit: paying invoice with Arc Memo...", "info");

const invoiceInterface = new ethers.Interface(CONTRACT_ABI);

const payData = invoiceInterface.encodeFunctionData("payInvoice", [
  BigInt(contractInvoiceId),
]);

const memoId = ethers.id(`tror-invoice-${contractInvoiceId}`);

const memoText =
  paymentMemo !== ""
    ? paymentMemo
    : `TROR invoice payment | invoiceId=${selectedInvoice.id} | onchainId=${contractInvoiceId} | amount=${selectedInvoice.amount} USDC`;

const memoData = ethers.hexlify(
  ethers.toUtf8Bytes(memoText)
);

const hash = await writeContract(wagmiAdapter.wagmiConfig, {
  address: MEMO_ADDRESS,
  abi: MEMO_ABI,
  functionName: "memo",
  args: [
    CONTRACT_ADDRESS,
    payData,
    memoId,
    memoData,
  ],
});

    await waitForTransactionReceipt(wagmiAdapter.wagmiConfig, { hash });

    await api(`/api/invoices/${selectedInvoice.id}/mark-paid`, {
      method: "POST",
      body: JSON.stringify({
        txHash: hash,
        fromAddress: account.address,
      }),
    });

    setStatus("Invoice paid with AppKit wallet.", "success");
    await openInvoice(selectedInvoice.id);
  } catch (err) {
    console.error("AppKit pay failed:", err);
    setStatus("AppKit pay failed: " + (err.message || err), "error");
  }
}

/* =========================
   CIRCLE WALLET PAYMENT
========================= */

async function sendClaimWithCircleWallet() {
  try {
    const recipientEmail = claimEmailEl.value.trim().toLowerCase();
    const amount = claimAmountEl.value;
    const memo = claimMessageEl.value || "";

    if (!recipientEmail || !amount) {
      setStatus("Please enter recipient email and amount.", "error");
      return;
    }

    const cfg = await api("/api/circle/config");
    const appId = cfg?.config?.circleAppId;

    if (!appId) {
      setStatus("Missing CIRCLE_APP_ID.", "error");
      return;
    }

    const { userToken, encryptionKey } = await getCircleAuth();

    setStatus("Loading Circle wallet...");

    const walletList = await listCircleWallets(userToken);
    const wallet = extractWallet(walletList);
    const walletAddress = extractWalletAddress(walletList);

    if (!wallet?.id || !walletAddress) {
      setStatus("No Circle wallet found.", "error");
      return;
    }

    circleWalletEl.textContent = walletAddress;

    const amountUnits = ethers.parseUnits(String(amount), 6);
    const emailHash = ethers.keccak256(
      ethers.toUtf8Bytes(recipientEmail)
    );

    const expiresAt =
      Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

    const usdc = await findUsdcToken(userToken, wallet.id);

    if (
      !Number.isFinite(usdc.balance) ||
      usdc.balance < Number(amount)
    ) {
      setStatus(
        `Not enough USDC in Circle wallet. Balance: ${usdc.balance} USDC`,
        "error"
      );
      return;
    }

    const sdk = new W3SSdk({
      appSettings: { appId }
    });

    sdk.setAuthentication({
      userToken,
      encryptionKey
    });

    // STEP 1: Circle approve USDC
    setStatus("Circle: approving USDC for Claim contract...");

    const approveData = await api(
      "/api/circle/contract-execution",
      {
        method: "POST",
        body: JSON.stringify({
          userToken,
          walletId: wallet.id,
          contractAddress: USDC_TOKEN,
          abiFunctionSignature: "approve(address,uint256)",
          abiParameters: [
            CLAIM_CONTRACT_ADDRESS,
            amountUnits.toString()
          ]
        })
      }
    );

    const approveChallengeId =
      approveData?.data?.challengeId ||
      approveData?.challengeId;

    if (!approveChallengeId) {
      throw new Error("No Circle approve challengeId returned.");
    }

    await new Promise((resolve, reject) => {
      sdk.execute(approveChallengeId, (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      });
    });

    await new Promise((resolve) => setTimeout(resolve, 6000));

    // STEP 2: Circle createClaim
    setStatus("Circle: creating Gmail Claim on-chain...");

    const createData = await api(
      "/api/circle/contract-execution",
      {
        method: "POST",
        body: JSON.stringify({
          userToken,
          walletId: wallet.id,
          contractAddress: CLAIM_CONTRACT_ADDRESS,
          abiFunctionSignature:
            "createClaim(bytes32,uint256,string,uint256)",
          abiParameters: [
            emailHash,
            amountUnits.toString(),
            memo,
            String(expiresAt)
          ]
        })
      }
    );

    const createChallengeId =
      createData?.data?.challengeId ||
      createData?.challengeId;

    if (!createChallengeId) {
      throw new Error("No Circle createClaim challengeId returned.");
    }

    await new Promise((resolve, reject) => {
      sdk.execute(createChallengeId, (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      });
    });

    setStatus("Circle Claim approved. Waiting for transaction...");

    let createTxHash = "";

    for (let i = 0; i < 15; i++) {
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const txData = await api("/api/circle/transactions", {
        method: "POST",
        body: JSON.stringify({ userToken })
      });

      const transactions =
        txData?.data?.transactions || [];

      const tx = transactions.find((item) => {
        const hash =
          item?.blockchainTxHash ||
          item?.txHash ||
          item?.transactionHash ||
          "";

        const complete =
          item?.state === "COMPLETE" ||
          item?.status === "COMPLETE";

        return (
          item?.operation === "CONTRACT_EXECUTION" &&
          complete &&
          hash.startsWith("0x")
        );
      });

      createTxHash =
        tx?.blockchainTxHash ||
        tx?.txHash ||
        tx?.transactionHash ||
        "";

      if (createTxHash) break;
    }

    if (!createTxHash) {
      throw new Error(
        "Circle createClaim was approved, but its transaction hash is not ready."
      );
    }

    // Read receipt from Arc RPC
    setStatus("Reading Circle Claim on-chain...");

    const rpcProvider = new ethers.JsonRpcProvider(
  import.meta.env.VITE_ARC_RPC_URL ||
    "https://rpc.testnet.arc.network"
);

    const receipt =
      await rpcProvider.waitForTransaction(createTxHash);

    if (!receipt) {
      throw new Error("Circle Claim receipt not found.");
    }

    const claimInterface = new ethers.Interface([
      "event ClaimCreated(uint256 indexed claimId, address indexed sender, bytes32 indexed emailHash, uint256 amount, string memo, uint256 expiresAt)"
    ]);

    let onchainClaimId = null;

    for (const log of receipt.logs || []) {
      try {
        const parsed = claimInterface.parseLog({
          topics: log.topics,
          data: log.data
        });

        if (parsed?.name === "ClaimCreated") {
          onchainClaimId =
            parsed.args.claimId.toString();
          break;
        }
      } catch {}
    }

    if (!onchainClaimId) {
      throw new Error(
        "Could not read Circle on-chain claimId."
      );
    }

    const data = await api("/api/claims/send-email", {
      method: "POST",
      body: JSON.stringify({
        claimId: onchainClaimId,
        recipientEmail,
        amount,
        message: memo,
        txHash: createTxHash,
        workspaceId: currentWorkspace.id
      })
    });

    claimResultEl.innerHTML = `
      <div style="margin-bottom:12px;">
        Status: <span id="claimStatus">PENDING</span>
      </div>

      <div style="margin-bottom:12px;">
        <a
          href="${data.claimLink}"
          target="_blank"
          style="color:#67e8f9;font-weight:bold;"
        >
          Open Claim Page
        </a>
      </div>

      <div style="word-break:break-all;">
        ${data.claimLink}
      </div>

      <div id="claimInfo" style="margin-top:12px;"></div>
    `;

    setStatus(
      "Claim email sent with Circle Wallet.",
      "success"
    );
  } catch (err) {
    console.error("Circle Gmail Claim error:", err);

    setStatus(
      "Circle Gmail Claim failed: " +
        (err.message || String(err)),
      "error"
    );
  }
}

async function payWithCircleWallet() {
  try {
    console.log("Circle contract pay clicked");

    if (!selectedInvoice) {
      setStatus("Open invoice first.", "error");
      return;
    }

const paymentMemo =
  document.getElementById("paymentMemoInput")?.value?.trim() || "";

    if (selectedInvoice.status === "PAID") {
      setStatus("Invoice already paid.", "success");
      return;
    }

    if (
      selectedInvoice.onchainId === undefined ||
      selectedInvoice.onchainId === null
    ) {
      setStatus("Missing onchainId. This invoice was not created on contract.", "error");
      return;
    }

    const cfg = await api("/api/circle/config");
    const appId = cfg?.config?.circleAppId;

    if (!appId) {
      setStatus("Missing CIRCLE_APP_ID.", "error");
      return;
    }

    const { userToken, encryptionKey } = await getCircleAuth();

    setStatus("Loading Circle wallet...");

    const walletList = await listCircleWallets(userToken);
    const wallet = extractWallet(walletList);
    const walletAddress = extractWalletAddress(walletList);

    if (!wallet || !wallet.id || !walletAddress) {
      setStatus("No Circle wallet found.", "error");
      return;
    }

    circleWalletEl.textContent = walletAddress;

    const usdc = await findUsdcToken(userToken, wallet.id);
    const invoiceAmount = Number(selectedInvoice.amount || 0);

    if (!Number.isFinite(usdc.balance) || usdc.balance < invoiceAmount) {
      setStatus(`Not enough USDC in Circle wallet. Balance: ${usdc.balance} USDC`, "error");
      return;
    }

    const amountUnits = toTokenUnits(selectedInvoice.amount, USDC_DECIMALS);

    const sdk = new W3SSdk({ appSettings: { appId } });
    sdk.setAuthentication({ userToken, encryptionKey });

    // STEP 1: approve USDC for TROR invoice contract
    setStatus("Circle: approving USDC for TROR contract...");

    const approveData = await api("/api/circle/contract-execution", {
      method: "POST",
      body: JSON.stringify({
        userToken,
        walletId: wallet.id,
        contractAddress: USDC_TOKEN,
        abiFunctionSignature: "approve(address,uint256)",
        abiParameters: [
          CONTRACT_ADDRESS,
          amountUnits
        ]
      })
    });

    console.log("Circle approve response:", approveData);

    const approveChallengeId =
      approveData?.data?.challengeId || approveData?.challengeId;

    if (!approveChallengeId) {
      setStatus("No approve challengeId returned.", "error");
      return;
    }

    await new Promise((resolve, reject) => {
      sdk.execute(approveChallengeId, (error, result) => {
        if (error) {
          console.error("Circle approve error:", error);
          reject(error);
          return;
        }
        console.log("Circle approve approved:", result);
        resolve(result);
      });
    });

    // small delay so approve is indexed
    await new Promise((resolve) => setTimeout(resolve, 6000));

    // STEP 2: pay through Arc Memo
    setStatus("Circle: preparing Arc Memo...");

    const invoiceInterface = new ethers.Interface(CONTRACT_ABI);

const encodedPayData = invoiceInterface.encodeFunctionData("payInvoice", [
  BigInt(selectedInvoice.onchainId),
]);

const memoId = ethers.id(
  `tror-invoice-${selectedInvoice.onchainId}`
);

const memoText =
  paymentMemo !== ""
    ? paymentMemo
    : `TROR invoice payment | invoiceId=${selectedInvoice.id} | onchainId=${selectedInvoice.onchainId} | amount=${selectedInvoice.amount} USDC`;

const memoData = ethers.hexlify(
  ethers.toUtf8Bytes(memoText)
);

setStatus("Circle: paying invoice with Arc Memo...");

const payData = await api("/api/circle/contract-execution", {
  method: "POST",
  body: JSON.stringify({
    userToken,
    walletId: wallet.id,
    contractAddress: MEMO_ADDRESS,
    abiFunctionSignature: "memo(address,bytes,bytes32,bytes)",
    abiParameters: [
      CONTRACT_ADDRESS,
      encodedPayData,
      memoId,
      memoData
    ]
  })
});

    console.log(
  "Circle payInvoice response:",
  JSON.stringify(payData, null, 2)
);

    const payChallengeId =
      payData?.data?.challengeId || payData?.challengeId;

    if (!payChallengeId) {
      setStatus("No payInvoice challengeId returned.", "error");
      return;
    }

    await new Promise((resolve, reject) => {
      sdk.execute(payChallengeId, (error, result) => {
        if (error) {
          console.error("Circle payInvoice error:", error);
          reject(error);
          return;
        }
        console.log("Circle payInvoice approved:", result);
        resolve(result);
      });
    });

    setStatus("Circle contract payment approved. Waiting for tx hash...");

    for (let i = 0; i < 10; i++) {
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const txData = await api("/api/circle/transactions", {
    method: "POST",
    body: JSON.stringify({ userToken })
  });

  console.log(
    `Circle transactions attempt ${i + 1}:`,
    JSON.stringify(txData, null, 2)
  );

  const tx =
  txData?.data?.transactions?.find((t) => {
    return (
      t.operation === "CONTRACT_EXECUTION" &&
      (t.state === "COMPLETE" || t.status === "COMPLETE") &&
      (t.txHash || t.blockchainTxHash || t.transactionHash)
    );
  }) ||
  txData?.data?.transactions?.[0] ||
  null;

  const txHash =
    tx?.blockchainTxHash ||
    tx?.txHash ||
    tx?.transactionHash ||
    tx?.networkFeeTransactionId ||
    tx?.operation?.txHash ||
    "";

  if (txHash && txHash.startsWith("0x")) {
    await markInvoicePaid(txHash, walletAddress);

    setStatus(
      "Circle invoice paid through Arc Memo: " + txHash,
      "success"
    );

    return;
  }
}

throw new Error(
  "Circle payment approved, but blockchain tx hash is not ready yet. Please wait a moment and try refreshing."
);

  } catch (err) {
    console.error(err);
    setStatus("Pay with Circle contract failed: " + (err.message || JSON.stringify(err)), "error");
  }
}

/* =========================
   MARK INVOICE PAID
========================= */

async function markInvoicePaid(txHash, fromAddress) {
  const paymentMemo =
    document.getElementById("paymentMemoInput")?.value?.trim() || "";

  await api(
    "/api/invoices/" + encodeURIComponent(selectedInvoice.id) + "/mark-paid",
    {
      method: "POST",
      body: JSON.stringify({
        txHash,
        fromAddress,
        paymentMemo
      })
    }
  );

  selectedInvoice.status = "PAID";
  selectedInvoice.txHash = txHash;

  renderSelectedInvoice();
  await loadInvoices();
}

/* =========================
   AI INVOICE DRAFT
========================= */

window.generateAIDraft = async function () {
  const prompt = document.getElementById("aiPrompt").value;

  if (!prompt) {
    alert("Please enter invoice prompt");
    return;
  }

  const lower = prompt.toLowerCase();
  let amount = "0";
  let title = "General Service";

  const amountMatch = lower.match(/(\d+(\.\d+)?)/);
  if (amountMatch) amount = amountMatch[1];

  // Detect invoice title from keywords
  if (lower.includes("coffee") || lower.includes("cà phê")) title = "Coffee";
  if (lower.includes("design")) title = "Design Work";
  if (lower.includes("salary") || lower.includes("lương")) title = "Salary";
  if (lower.includes("game")) title = "Game Service";

  document.getElementById("title").value = title;
  document.getElementById("amount").value = amount;

  document.getElementById("aiResult").textContent = `
🧠 AI UNDERSTOOD

Intent: ${title}

Title: ${document.getElementById("title").value}

Amount: ${document.getElementById("amount").value} USDC
`;
};

/* =========================
   DASHBOARD
========================= */

function shortTx(tx) {
  if (!tx) return "-";
  return tx.slice(0, 8) + "..." + tx.slice(-6);
}

async function loadDashboard() {
  try {
    const currentWorkspace = JSON.parse(
      localStorage.getItem("currentWorkspace") || "null"
    );

    if (!currentWorkspace?.id) {
      return;
    }

    const data = await api(
      `/api/dashboard?workspaceId=${encodeURIComponent(
        currentWorkspace.id
      )}`
    );

    document.getElementById("dashTotal").innerText = Number(data.totalReceived || 0).toFixed(2) + " USDC";
    document.getElementById("dashPaid").innerText = data.paidCount || 0;
    document.getElementById("dashPending").innerText = data.pendingCount || 0;
    document.getElementById("dashLatestTx").innerText = data.latestPayment?.txHash ? shortTx(data.latestPayment.txHash) : "-";
    document.getElementById("dashTotalInvoices").innerText = data.totalInvoices || 0;
    document.getElementById("dashTotalPayrolls").innerText = data.totalPayrolls || 0;
    document.getElementById("dashTotalClaims").innerText = data.totalClaims || 0;
    document.getElementById("dashTotalVolume").innerText = Number(data.totalVolume || 0).toFixed(2) + " USDC";

    // Update wallet chip balance from dashboard data
    const totalBalance = Number(data.totalVolume || data.totalReceived || 0).toFixed(2);
    if (metamaskWallet) {
      updateWalletChip(metamaskWallet, totalBalance);
    }

    // Render recent activity feed
    const feed = document.getElementById("activityFeed");
    if (feed) {
      const items = data.recentActivity || [];
      const getActivityIcon = (text = "") => {
  const value = text.toLowerCase();

  if (value.includes("invoice paid")) return "✅";
  if (value.includes("payroll")) return "💰";
  if (value.includes("claim")) return "📧";
  if (value.includes("failed") || value.includes("error")) return "❌";
  if (value.includes("pending")) return "⏳";

  return "🔹";
};

const getActivityClass = (text = "") => {
  const value = text.toLowerCase();

  if (value.includes("invoice paid")) return "activity-success";
  if (value.includes("payroll")) return "activity-payroll";
  if (value.includes("claim")) return "activity-claim";
  if (value.includes("failed") || value.includes("error")) return "activity-failed";
  if (value.includes("pending")) return "activity-pending";

  return "activity-default";
};

feed.innerHTML = items.length
  ? items
      .map((item) => {
        const text = item.text || "";
        return `
          <div class="activity-item ${getActivityClass(text)}">
            <span class="activity-icon">${getActivityIcon(text)}</span>
            <span>${text}</span>
          </div>
        `;
      })
      .join("")
  : "No activity yet.";
  const ticker = document.getElementById("activityTicker");

if (ticker) {
  const tickerItems = items.length ? items : [];

  ticker.innerHTML = tickerItems.length
    ? tickerItems
        .map((item) => {
          const text = item.text || "";
          const icon = getActivityIcon(text);

          return `
<button
  type="button"
  class="ticker-item"
  data-text="${text.replace(/"/g, "&quot;")}"
>
  ${icon} ${text}
</button>`;
        })
        .join("")
    : `<button type="button" class="ticker-item">No recent activity yet.</button>`;

  ticker.onclick = (event) => {
    const item = event.target.closest(".ticker-item");
    if (!item) return;

    const text = (item.dataset.text || item.textContent || "").toLowerCase();

    if (text.includes("invoice")) return document.querySelector('[data-tab="invoices"]')?.click();
    if (text.includes("payroll")) return document.querySelector('[data-tab="payroll"]')?.click();
    if (text.includes("claim")) return document.querySelector('[data-tab="gmail-claim"]')?.click();
    if (text.includes("payout")) return document.querySelector('[data-tab="payouts"]')?.click();
  };
 }
}
 } catch (err) {
    console.error("loadDashboard error:", err);
  }
}

/* =========================
   CLAIM PAGE
========================= */

async function loadClaimWithdrawalStatus(claimId) {
  try {
    const response = await fetch(
      `/api/withdrawals/claim/${encodeURIComponent(claimId)}`
    );

    if (response.status === 404) {
      return null;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to load withdrawal status");
    }

    const button = document.getElementById("btnRequestWithdraw");
    const statusEl = document.getElementById("claimStatus");
    const bankForm = document.getElementById("bankWithdrawForm");

    const statusOrder = [
      "PENDING",
      "REVIEW",
      "APPROVED",
      "COMPLETED"
    ];

    const currentStatusIndex = statusOrder.indexOf(data.status);

const formatStatusTime = (value) => {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString();
};

    const timelineSteps = [
  {
    status: "PENDING",
    title: "Withdrawal Requested",
    description: "Your bank withdrawal request has been submitted.",
    time: data.created_at
  },
  {
    status: "REVIEW",
    title: "Under Review",
    description: "TROR is reviewing your withdrawal request.",
    time: data.reviewed_at
  },
  {
    status: "APPROVED",
    title: "Approved",
    description: "Your withdrawal has been approved for processing.",
    time: data.approved_at
  },
  {
    status: "COMPLETED",
    title: "Completed",
    description: "Your bank withdrawal has been completed.",
    time: data.completed_at
  }
];

    if (button) {
      button.disabled = true;

      if (data.status === "PENDING") {
        button.textContent = "Withdrawal Requested";
      } else if (data.status === "REVIEW") {
        button.textContent = "Under Review";
      } else if (data.status === "APPROVED") {
        button.textContent = "Withdrawal Approved";
      } else if (data.status === "COMPLETED") {
        button.textContent = "Withdrawal Completed";
      } else if (data.status === "REJECTED") {
        button.textContent = "Withdrawal Rejected";
      }
    }

    if (data.status === "COMPLETED" && bankForm) {
      bankForm.style.display = "none";
    }

    if (statusEl) {
      if (data.status === "REJECTED") {
        statusEl.innerHTML = `
          <div style="
            padding:16px;
            border-radius:12px;
            background:rgba(239,68,68,0.12);
            border:1px solid rgba(239,68,68,0.35);
            color:#fca5a5;
            font-weight:700;
          ">
            ❌ Your bank withdrawal request was rejected.
          </div>
        `;
      } else {
        statusEl.innerHTML = `
          <div style="
            margin-top:16px;
            padding:18px;
            border-radius:16px;
            background:rgba(15,23,42,0.72);
            border:1px solid rgba(148,163,184,0.18);
          ">
            <div style="
              font-size:16px;
              font-weight:800;
              margin-bottom:16px;
              color:#ffffff;
            ">
              Bank withdrawal progress
            </div>

            ${timelineSteps
              .map((step, index) => {
                const isCompleted =
                  currentStatusIndex >= index &&
                  currentStatusIndex !== -1;

                const isCurrent =
                  data.status === step.status;

                return `
                  <div style="
                    display:flex;
                    gap:12px;
                    position:relative;
                    padding-bottom:${index === timelineSteps.length - 1 ? "0" : "18px"};
                  ">
                    <div style="
                      display:flex;
                      flex-direction:column;
                      align-items:center;
                    ">
                      <div style="
                        width:28px;
                        height:28px;
                        border-radius:50%;
                        display:flex;
                        align-items:center;
                        justify-content:center;
                        font-weight:800;
                        background:${
                          isCompleted
                            ? "rgba(34,197,94,0.2)"
                            : "rgba(148,163,184,0.12)"
                        };
                        border:1px solid ${
                          isCompleted
                            ? "rgba(34,197,94,0.55)"
                            : "rgba(148,163,184,0.22)"
                        };
                        color:${
                          isCompleted
                            ? "#86efac"
                            : "#64748b"
                        };
                      ">
                        ${isCompleted ? "✓" : index + 1}
                      </div>

                      ${
                        index !== timelineSteps.length - 1
                          ? `
                            <div style="
                              width:2px;
                              flex:1;
                              min-height:34px;
                              background:${
                                currentStatusIndex > index
                                  ? "rgba(34,197,94,0.45)"
                                  : "rgba(148,163,184,0.18)"
                              };
                              margin-top:4px;
                            "></div>
                          `
                          : ""
                      }
                    </div>

                    <div style="padding-top:3px;">
                      <div style="
                        font-weight:800;
                        color:${
                          isCurrent
                            ? "#ffffff"
                            : isCompleted
                            ? "#cbd5e1"
                            : "#64748b"
                        };
                      ">
                        ${step.title}
                      </div>

                      <div style="
                        margin-top:4px;
                        font-size:13px;
                        line-height:1.45;
                        color:${
                          isCompleted
                            ? "#94a3b8"
                            : "#475569"
                        };
                      ">
                        ${step.description}
                        ${
  step.time
    ? `
      <div style="
        margin-top:5px;
        font-size:12px;
        color:#94a3b8;
      ">
        ${formatStatusTime(step.time)}
      </div>
    `
    : ""
}
                      </div>
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        `;
      }
    }

    return data;
  } catch (err) {
    console.error("Load withdrawal status error:", err);
    return null;
  }
}

async function loadClaimPage() {
  const path = window.location.pathname;

  let claimId = null;

  if (path.startsWith("/claim/")) {
    claimId = path.split("/claim/")[1]?.split("?")[0];
  } else {
    claimId = new URLSearchParams(
      window.location.search
    ).get("claim");
  }

  if (!claimId) return;

  let claimData = null;
  let googleVerified = false;

  document.body.innerHTML = `
    <div
      style="
        padding:40px 20px;
        max-width:560px;
        margin:auto;
        color:white;
        font-family:sans-serif;
      "
    >
      <h2 style="margin-bottom:8px;">
        Claim your USDC
      </h2>

      <p id="claimInfo">Loading...</p>

      <!-- GOOGLE VERIFICATION -->
      <div
        id="googleVerifyBox"
        style="
          margin-top:24px;
          padding:20px;
          border-radius:18px;
          background:rgba(255,255,255,0.08);
        "
      >
        <h3 style="margin-top:0;">
          Verify your Gmail
        </h3>

        <p style="color:#cbd5e1;line-height:1.5;">
          Sign in with the Google account that received
          this TROR claim.
        </p>

        <button
          id="btnClaimGoogle"
          style="
            width:100%;
            padding:16px;
            border:none;
            border-radius:14px;
            cursor:pointer;
            background:white;
            color:#111827;
            font-size:16px;
            font-weight:bold;
          "
        >
          Continue with Google
        </button>

        <p
          id="googleVerifyStatus"
          style="margin-top:14px;"
        ></p>
      </div>

      <!-- RECEIVE OPTIONS -->
      <div
        id="receiveOptions"
        style="display:none;margin-top:28px;"
      >
        <h3 style="margin-bottom:8px;">
          Choose how you want to receive your USDC
        </h3>

        <p style="color:#cbd5e1;margin-top:0;">
          Select one receiving method.
        </p>

        <div
          style="
            display:flex;
            flex-direction:column;
            gap:14px;
            margin-top:18px;
          "
        >
          <button
            id="btnWalletOption"
            style="
              padding:18px;
              border:none;
              border-radius:16px;
              cursor:pointer;
              background:linear-gradient(135deg,#38bdf8,#8b5cf6);
              color:white;
              font-size:16px;
              text-align:left;
            "
          >
            <b>🦊 Web3 Wallet</b><br>

            <span style="font-size:13px;opacity:.88;">
              MetaMask • OKX • Coinbase • WalletConnect
            </span>
          </button>

          <button
            id="btnBankOption"
            style="
              padding:18px;
              border:none;
              border-radius:16px;
              cursor:pointer;
              background:linear-gradient(135deg,#0ea5e9,#10b981);
              color:white;
              font-size:16px;
              text-align:left;
            "
          >
            <b>🏦 Withdraw to Bank</b><br>

            <span style="font-size:13px;opacity:.88;">
              Use the existing TROR withdrawal flow
            </span>
          </button>
        </div>
      </div>

      <!-- WEB3 WALLET BOX -->
      <div
        id="walletBox"
        style="
          display:none;
          margin-top:24px;
          padding:20px;
          border-radius:18px;
          background:rgba(255,255,255,0.07);
        "
      >
        <h3 style="margin-top:0;">
          Receive with Web3 Wallet
        </h3>

        <input
          id="walletInput"
          placeholder="0x..."
          style="
            width:100%;
            padding:14px;
            border-radius:12px;
            border:none;
            box-sizing:border-box;
          "
        />

        <button
          id="btnClaim"
          style="
            width:100%;
            margin-top:16px;
            padding:15px;
            border:none;
            border-radius:12px;
            background:linear-gradient(135deg,#38bdf8,#d946ef);
            color:white;
            font-size:16px;
            font-weight:bold;
            cursor:pointer;
          "
        >
          Claim to Web3 Wallet
        </button>
      </div>

      <!-- BANK BOX -->
      <div
        id="bankBox"
        style="
          display:none;
          margin-top:24px;
          padding:20px;
          border-radius:18px;
          background:rgba(255,255,255,0.07);
        "
      >
        <h3 style="margin-top:0;">
          Withdraw to Bank
        </h3>

        <div
          id="bankWithdrawForm"
          style="
            display:flex;
            flex-direction:column;
            gap:12px;
          "
        >
          <input
            id="bankCountry"
            placeholder="Country"
            style="
              padding:14px;
              border-radius:12px;
              border:none;
            "
          />

          <input
            id="bankName"
            placeholder="Bank Name"
            style="
              padding:14px;
              border-radius:12px;
              border:none;
            "
          />

          <input
            id="bankAccount"
            placeholder="Account Number"
            style="
              padding:14px;
              border-radius:12px;
              border:none;
            "
          />

          <input
            id="bankHolder"
            placeholder="Account Holder"
            style="
              padding:14px;
              border-radius:12px;
              border:none;
            "
          />

          <button
            id="btnRequestWithdraw"
            style="
              padding:16px;
              border:none;
              border-radius:14px;
              background:linear-gradient(135deg,#0ea5e9,#10b981);
              color:white;
              font-weight:bold;
              cursor:pointer;
            "
          >
            Request Bank Withdraw
          </button>
        </div>
      </div>

      <p
        id="claimStatus"
        style="
          margin-top:22px;
          line-height:1.5;
        "
      ></p>
    </div>
  `;

  try {
    claimData = await api(`/api/claims/${claimId}`);

    if (!claimData || !claimData.amount) {
      document.body.innerHTML =
        "<div style='padding:40px;color:white;'>❌ Claim not found</div>";
      return;
    }

    document.getElementById("claimInfo").innerText =
      `You received ${claimData.amount} USDC`;

    if (claimData.status === "CLAIMED") {
      document.getElementById(
        "googleVerifyBox"
      ).style.display = "none";

      document.getElementById(
        "claimStatus"
      ).innerText =
        "This claim has already been claimed.";

      return;
    }
  } catch (err) {
    document.body.innerHTML =
      "<div style='padding:40px;color:white;'>❌ Claim not found</div>";

    return;
  }

  async function verifyCurrentGoogleUser() {
    const googleAccessToken =
      localStorage.getItem("googleToken");

    if (!googleAccessToken) {
      return false;
    }

    try {
      const result = await api(
        `/api/claims/${claimId}/verify-google`,
        {
          method: "POST",
          body: JSON.stringify({
            googleAccessToken
          })
        }
      );

      if (!result.verified) {
        return false;
      }

      googleVerified = true;

      document.getElementById(
        "googleVerifyStatus"
      ).innerText =
        `Verified: ${result.email}`;

      document.getElementById(
        "googleVerifyStatus"
      ).style.color = "#22c55e";

      document.getElementById(
        "btnClaimGoogle"
      ).style.display = "none";

      document.getElementById(
        "receiveOptions"
      ).style.display = "block";

      return true;
    } catch (err) {
      googleVerified = false;

      document.getElementById(
        "googleVerifyStatus"
      ).innerText =
        err.message ||
        "This Google account is not the intended recipient.";

      document.getElementById(
        "googleVerifyStatus"
      ).style.color = "#f87171";

      return false;
    }
  }

  document.getElementById(
    "btnClaimGoogle"
  ).onclick = async () => {
    const verified =
      await verifyCurrentGoogleUser();

    if (verified) return;

    localStorage.setItem(
      "claimReturnPath",
      window.location.pathname
    );

    await connectGoogleCircle();
  };

  await verifyCurrentGoogleUser();

  await loadClaimWithdrawalStatus(claimData.id);

  document.getElementById(
    "btnWalletOption"
  ).onclick = () => {
    if (!googleVerified) return;

    document.getElementById(
      "walletBox"
    ).style.display = "block";

    document.getElementById(
      "circleBox"
    ).style.display = "none";

    document.getElementById(
      "bankBox"
    ).style.display = "none";
  };

  document.getElementById(
    "btnBankOption"
  ).onclick = () => {
    if (!googleVerified) return;

    document.getElementById(
      "bankBox"
    ).style.display = "block";

    document.getElementById(
      "walletBox"
    ).style.display = "none";

    document.getElementById(
      "circleBox"
    ).style.display = "none";
  };

  document.getElementById(
    "btnClaim"
  ).onclick = async () => {
    const walletAddress =
      document.getElementById(
        "walletInput"
      ).value.trim();

    const googleAccessToken =
      localStorage.getItem("googleToken");

    if (
      !walletAddress ||
      !ethers.isAddress(walletAddress)
    ) {
      document.getElementById(
        "claimStatus"
      ).innerText =
        "Enter a valid Web3 wallet address.";

      return;
    }

    if (!googleAccessToken) {
      document.getElementById(
        "claimStatus"
      ).innerText =
        "Please verify your Gmail first.";

      return;
    }

    try {
      const result = await api(
        `/api/claims/${claimId}/claim`,
        {
          method: "POST",
          body: JSON.stringify({
            walletAddress,
            googleAccessToken
          })
        }
      );

      document.getElementById(
        "claimStatus"
      ).innerText =
        result.success
          ? "Claimed successfully!"
          : "Error: " + result.error;
    } catch (err) {
      document.getElementById(
        "claimStatus"
      ).innerText =
        "Error: " + err.message;
    }
  };

  document.getElementById(
    "btnRequestWithdraw"
  ).onclick = async () => {
    if (!googleVerified) {
      document.getElementById(
        "claimStatus"
      ).innerText =
        "Please verify your Gmail first.";

      return;
    }

    const country =
      document.getElementById(
        "bankCountry"
      ).value.trim();

    const bankName =
      document.getElementById(
        "bankName"
      ).value.trim();

    const account =
      document.getElementById(
        "bankAccount"
      ).value.trim();

    const holder =
      document.getElementById(
        "bankHolder"
      ).value.trim();

    if (
      !country ||
      !bankName ||
      !account ||
      !holder
    ) {
      document.getElementById(
        "claimStatus"
      ).innerText =
        "Please complete all bank information.";

      return;
    }

    try {

const currentWorkspace = getCurrentWorkspace();

if (!currentWorkspace?.id) {
  throw new Error("Please select a workspace.");
}

      const result = await api(
        "/api/withdrawals",
        {
          method: "POST",
          body: JSON.stringify({
            workspaceId: currentWorkspace.id,
            email:
              claimData?.recipientEmail || "",
            amount:
              claimData?.amount || 0,
            country,
            bankName,
            accountHolder: holder,
            accountNumber: account,
            claimId: claimData?.id
          })
        }
      );

      document.getElementById(
        "claimStatus"
      ).innerText =
        result.success === false
          ? "Bank withdrawal request failed."
          : "Bank withdrawal request submitted.";
    } catch (err) {
  console.error("Bank withdrawal error:", err);

  document.getElementById(
    "claimStatus"
  ).innerText =
    "Error: " +
    (
      err?.message ||
      err?.error ||
      JSON.stringify(err)
    );
}
  };
}

/* =========================
   EVENT LISTENERS + INIT
========================= */

document.getElementById("btnMobileMenu")
  ?.addEventListener("click", () => {
    document.querySelector(".sidebar")?.classList.toggle("open");
  });

document.addEventListener("click", (e) => {
  const sidebar = document.querySelector(".sidebar");
  const btnMobileMenu = document.getElementById("btnMobileMenu");

  if (
    sidebar?.classList.contains("open") &&
    !sidebar.contains(e.target) &&
    !btnMobileMenu?.contains(e.target)
  ) {
    sidebar.classList.remove("open");
  }
});

btnSaveCustomer?.addEventListener("click", saveCustomer);

btnSendClaimEmail?.addEventListener("click", async () => {
  const paymentMethod =
    document.querySelector(
      'input[name="paymentMethod"]:checked'
    )?.value;

  if (paymentMethod === "card") {
    alert("Visa/Mastercard flow coming soon");
    return;
  }

  const circleAddress =
    circleWalletEl?.textContent?.trim() || "";

  if (
    circleAddress &&
    circleAddress !== "-" &&
    circleAddress.startsWith("0x")
  ) {
    await sendClaimWithCircleWallet();
  } else {
    await sendClaimEmail();
  }
});

btnSaveBiz?.addEventListener("click", saveBusinessProfile);

btnDisconnectWallet?.addEventListener("click", disconnectMetaMask);

// Close wallet modal
document.getElementById("btnCloseWalletModal")?.addEventListener("click", () => {
  document.getElementById("walletModal")?.classList.add("hidden");
});

let walletModalMode = "connect";

// MetaMask option in modal
document.getElementById("btnChooseMetaMask")?.addEventListener("click", async () => {
  document.getElementById("walletModal")?.classList.add("hidden");

  if (walletModalMode === "pay") {
  await payWithMetaMask();
  return;
}

  await openAppKitWallet();
});

// OKX Wallet — real connection
async function connectOKX() {
  const okx = window.okxwallet;
  if (!okx) {
    setStatus("OKX Wallet not installed.", "error");
    window.open("https://www.okx.com/download", "_blank");
    return;
  }
  try {
    const accounts = await okx.request({ method: "eth_requestAccounts" });
    metamaskWallet = accounts[0] || null;
    if (metamaskWalletEl) metamaskWalletEl.textContent = metamaskWallet || "Disconnected";
    updateWalletChip(metamaskWallet, null);
    clearCircleWalletLocal();
activeWalletType = "web3";
    setStatus("OKX Wallet connected.", "success");
  } catch (err) {
    setStatus("OKX connect failed: " + err.message, "error");
  }
}

// Coinbase Wallet — real connection
async function connectCoinbase() {
  const cb = window.coinbaseWalletExtension || window.ethereum;
  if (!cb) {
    setStatus("Coinbase Wallet not installed.", "error");
    window.open("https://www.coinbase.com/wallet/downloads", "_blank");
    return;
  }
  try {
    const accounts = await cb.request({ method: "eth_requestAccounts" });
    metamaskWallet = accounts[0] || null;
    if (metamaskWalletEl) metamaskWalletEl.textContent = metamaskWallet || "Disconnected";
    updateWalletChip(metamaskWallet, null);
    clearCircleWalletLocal();
activeWalletType = "web3";
    setStatus("Coinbase Wallet connected.", "success");
  } catch (err) {
    setStatus("Coinbase connect failed: " + err.message, "error");
  }
}

document.getElementById("btnChooseWeb3")?.addEventListener("click", async () => {
  saveInvoiceReturnPath();
  document.getElementById("walletModal")?.classList.add("hidden");
  await openAppKitWallet();
});

// Google / Circle option in modal
document.getElementById("btnChooseCircle")?.addEventListener("click", async () => {
  saveInvoiceReturnPath();
  document.getElementById("walletModal")?.classList.add("hidden");
  if (walletModalMode === "pay") {
    await payWithCircleWallet();
    return;
  }
  await connectGoogleCircle();
});

// Google button in modal header — same as Circle option
btnGoogle?.addEventListener("click", async () => {
  document.getElementById("walletModal")?.classList.add("hidden");
  await connectGoogleCircle();
});

btnSetupPin?.addEventListener("click", setupCirclePin);
btnSwitchArc?.addEventListener("click", switchArc);

// Pay Invoice button opens wallet modal in pay mode
btnPay?.addEventListener("click", async () => {
  if (metamaskWallet) {
    await payWithMetaMask();
    return;
  }

const appKitAccount = getAccount(wagmiAdapter.wagmiConfig);
if (appKitAccount?.address) {
  await payWithAppKit();
  return;
}

  const circleAddress = circleWalletEl?.textContent?.trim();
  if (circleAddress && circleAddress.startsWith("0x")) {
    await payWithCircleWallet();
    return;
  }

  setStatus("Please connect Web3 wallet or Circle Wallet first.", "error");
});

btnPayCircle?.addEventListener("click", payWithCircleWallet);
btnCreateInvoice?.addEventListener("click", createInvoice);
btnLoadInvoices?.addEventListener("click", loadInvoices);

btnRefresh?.addEventListener("click", () => {
  window.location.reload();
});

btnLogoutGoogle?.addEventListener("click", () => {
  localStorage.removeItem("googleUser");
  localStorage.removeItem("googleToken");
  localStorage.removeItem("circleUserToken");
  localStorage.removeItem("circleEncryptionKey");
  if (emailEl) emailEl.textContent = "-";
  if (circleWalletEl) circleWalletEl.textContent = "-";
  setStatus("Google / Circle logged out.", "success");
});

customerSelectEl?.addEventListener("change", () => {
  const customers = getWorkspaceCustomers();

  const selectedCustomer = customers.find(
    (customer) =>
      customer.id === customerSelectEl.value
  );

  if (!selectedCustomer) {
    return;
  }

  if (recipientEl) {
    recipientEl.value =
      selectedCustomer.wallet || "";
  }

  const recipientEmailEl =
    document.getElementById("recipientEmail");

  if (recipientEmailEl) {
    recipientEmailEl.value =
      selectedCustomer.email || "";
  }
});

// Listen for account changes from MetaMask
if (window.ethereum) {
  window.ethereum.on("accountsChanged", (accounts) => {
    metamaskWallet = accounts?.[0] || null;
    if (metamaskWalletEl) metamaskWalletEl.textContent = metamaskWallet || "Disconnected";
    updateWalletChip(metamaskWallet, null);
  });
}

/* =========================
   PAGE INIT
========================= */

const initClaimId = new URLSearchParams(window.location.search).get("claim");

if (window.location.pathname.startsWith("/claim/") || initClaimId) {
  if (initClaimId) {
    window.history.replaceState(null, "", `/claim/${initClaimId}`);
  }
  loadClaimPage();
} else {
  renderQR(null);
  handleGoogleRedirect();

  loadInvoices().then(async () => {
    const invoiceId = new URLSearchParams(window.location.search).get("invoice");
    if (invoiceId) await openInvoice(invoiceId);
  });

  renderCustomerDropdown();
  loadWorkspaceClaims();
  loadDashboard();
  loadBusinessProfile();
  window.addEventListener(
  "workspaceChanged",
  loadDashboard
);

window.addEventListener(
  "workspaceChanged",
  loadBusinessProfile
);

  // Poll for invoice and dashboard updates every 5 seconds
  setInterval(async () => {
    try {
      await loadInvoices();
      if (selectedInvoice?.id) {
        const data = await api("/api/invoices/" + encodeURIComponent(selectedInvoice.id));
        selectedInvoice = data.invoice;
        renderSelectedInvoice();
      }
    } catch (err) {
      console.warn("Realtime poll error:", err.message);
    }
  }, 5000);

  setInterval(loadDashboard, 5000);
}

// Invoice sheet close handlers
document.getElementById("btnCloseInvoiceSheet")?.addEventListener("click", closeInvoiceSheet);
document.getElementById("closeInvoiceSheet")?.addEventListener("click", closeInvoiceSheet);

// Swipe down to close invoice sheet on mobile
let sheetStartY = 0;
let sheetCurrentY = 0;

const invoiceSheetEl = document.getElementById("invoiceSheet");

invoiceSheetEl?.addEventListener("touchstart", (e) => {
  sheetStartY = e.touches[0].clientY;
});

invoiceSheetEl?.addEventListener("touchmove", (e) => {
  sheetCurrentY = e.touches[0].clientY;
});

invoiceSheetEl?.addEventListener("touchend", () => {
  const distance = sheetCurrentY - sheetStartY;
  if (distance > 90) closeInvoiceSheet();
  sheetStartY = 0;
  sheetCurrentY = 0;
});

console.log("GLOBAL openCardPayment:", typeof globalThis.openCardPayment);
console.log("GLOBAL openCardPayment:", typeof window.openCardPayment);

// Mount React panels
const payoutRoot = document.getElementById("payout-root");
const payrollRoot = document.getElementById("payroll-anchor");

if (payoutRoot) createRoot(payoutRoot).render(<PayoutPanel />);
if (payrollRoot) createRoot(payrollRoot).render(<PayrollPanel />);

closeInvoiceModalEl?.addEventListener("click", () => {
  invoiceModalEl?.classList.add("hidden");
});

invoiceModalEl?.addEventListener("click", (e) => {
  if (e.target === invoiceModalEl) invoiceModalEl.classList.add("hidden");
});

/* =========================
   VOICE AI INVOICE
========================= */

btnVoiceInvoice?.addEventListener("click", () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    setStatus("Speech recognition not supported.", "error");
    return;
  }

  const recognition = new SpeechRecognition();
  const selectedLang = voiceLangEl?.value || "en-US";

  recognition.lang = selectedLang === "auto" ? "en-US" : selectedLang;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  setStatus("🎤 Listening... Speak naturally.");

  // Prevent duplicate recognition sessions
  if (window.__voiceRunning) return;
  window.__voiceRunning = true;

  setTimeout(() => { recognition.start(); }, 300);

  recognition.onresult = async (event) => {
    const transcript = event.results[0][0].transcript;
    console.log("VOICE TRANSCRIPT:", transcript);

    const aiPrompt = document.getElementById("aiPrompt");
    if (aiPrompt) {
      aiPrompt.value = transcript;
      parseInvoicePrompt(transcript);
      recognition.stop();
    }

    setStatus("Voice captured.", "success");

    // Auto-generate AI draft from voice input
    if (typeof window.generateAIDraft === "function") {
      await window.generateAIDraft();
    }
  };

  recognition.onerror = (event) => {
    console.error(event);
    window.__voiceRunning = false;
    setStatus("Voice recognition failed: " + event.error, "error");
  };

  recognition.onend = () => {
    window.__voiceRunning = false;
    console.log("Voice recognition ended.");
  };
});

/* =========================
   TAB NAVIGATION
========================= */

function showTab(tabId) {
  const dashboardTop = document.getElementById("dashboard-top");

  // Show the large dashboard only on the Dashboard tab
  if (dashboardTop) {
    dashboardTop.classList.toggle(
      "hidden-section",
      tabId !== "dashboard"
    );
  }

  // Display only the selected tab content
  document.querySelectorAll(".app-section").forEach((section) => {
    section.classList.toggle(
      "hidden-section",
      section.id !== tabId
    );
  });

  // Highlight the active navigation tab
  document.querySelectorAll("[data-tab]").forEach((link) => {
    link.classList.toggle(
      "active-tab",
      link.dataset.tab === tabId
    );
  });

  // Scroll the active section into view
  const activeSection =
    tabId === "dashboard"
      ? dashboardTop
      : document.getElementById(tabId);

  if (activeSection) {
    window.scrollTo({
      top: Math.max(
        0,
        activeSection.getBoundingClientRect().top +
          window.scrollY -
          105
      ),
      behavior: "smooth"
    });
  }
}

document.querySelectorAll("[data-tab]").forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const tabId = link.dataset.tab;
    window.location.hash = tabId;
    showTab(tabId);
  });
});

const isClaimRoute =
  window.location.pathname.startsWith("/claim/") ||
  new URLSearchParams(window.location.search).get("claim");

if (isClaimRoute) {
  loadClaimPage();
} else {
  showTab(window.location.hash.replace("#", "") || "dashboard");
}

/* =========================
   AI INVOICE API CALL
========================= */

async function parseInvoicePrompt(prompt) {
  try {
    const res = await fetch("/api/ai/invoice-draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    const data = await res.json();
    console.log("AI RESULT:", data);

    document.getElementById("title").value = data.draft?.title || "Invoice";
    document.getElementById("amount").value = data.draft?.amount || "";
  } catch (err) {
    console.error(err);
  }
}

/* =========================
   WITHDRAWALS
========================= */

/* =========================
   EMPLOYEES
========================= */

let currentEmployeeStatus = "";

function getEmployeeStatusClass(status) {
  const value = String(status || "").toUpperCase();

  if (value === "ACTIVE") return "employee-status-active";
  if (value === "INACTIVE") return "employee-status-inactive";
  return "employee-status-terminated";
}

async function loadEmployees(status = currentEmployeeStatus) {
  try {
    currentEmployeeStatus = status || "";

    const currentWorkspace = getCurrentWorkspace();

if (!currentWorkspace?.id) {
  const list = document.getElementById("employeesList");

  if (list) {
    list.innerHTML = "Please select a workspace.";
  }

  return [];
}

const workspaceQuery =
  `workspaceId=${encodeURIComponent(currentWorkspace.id)}`;

const query = currentEmployeeStatus
  ? `?${workspaceQuery}&status=${encodeURIComponent(
      currentEmployeeStatus
    )}`
  : `?${workspaceQuery}`;

const [rows, allEmployees] = await Promise.all([
  api(`/api/employees${query}`),
  api(`/api/employees?${workspaceQuery}`)
]);

const totalEmployeesEl =
  document.getElementById("payrollEmployees");

if (totalEmployeesEl) {
  totalEmployeesEl.textContent = Array.isArray(allEmployees)
    ? allEmployees.length
    : 0;
}

const list = document.getElementById("employeesList");

if (!list) return;

    document.querySelectorAll(".employee-filter").forEach((button) => {
      const buttonStatus = button.dataset.employeeStatus || "";

      button.classList.toggle(
        "is-active",
        buttonStatus === currentEmployeeStatus
      );
    });

    if (!Array.isArray(rows) || rows.length === 0) {
      list.innerHTML = "No employees yet.";
      return;
    }

    list.innerHTML = rows
      .map((employee) => {
        const status =
          String(employee.employment_status || "ACTIVE").toUpperCase();

        return `
          <div class="employee-card">
            <div>
              <h4>${employee.employee_name || "-"}</h4>

              <p>Email: ${employee.employee_email || "-"}</p>

              <p>Wallet: ${employee.wallet || "-"}</p>

              <p>
                Base salary:
                ${Number(employee.base_salary || 0).toFixed(2)} USDC
              </p>

              <span class="
                employee-status
                ${getEmployeeStatusClass(status)}
              ">
                ${status}
              </span>
            </div>

            <div class="employee-card-actions">
              ${
                status !== "ACTIVE"
                  ? `
                    <button
                      type="button"
                      onclick="updateEmployeeStatus(
                        '${employee.id}',
                        'ACTIVE'
                      )"
                    >
                      Activate
                    </button>
                  `
                  : `
                    <button
                      type="button"
                      onclick="updateEmployeeStatus(
                        '${employee.id}',
                        'INACTIVE'
                      )"
                    >
                      Inactive
                    </button>
                  `
              }

              ${
                status !== "TERMINATED"
                  ? `
                    <button
                      type="button"
                      onclick="updateEmployeeStatus(
                        '${employee.id}',
                        'TERMINATED'
                      )"
                    >
                      Mark as Left
                    </button>
                  `
                  : ""
              }
            </div>
          </div>
        `;
      })
      .join("");
  } catch (err) {
    console.error("Load employees error:", err);

    const list = document.getElementById("employeesList");

    if (list) {
      list.textContent = `Error: ${err.message}`;
    }
  }
}

window.updateEmployeeStatus = async function (id, status) {
  try {
    await api(`/api/employees/${id}/status`, {
      method: "POST",
      body: JSON.stringify({ status })
    });

    await loadEmployees();
  } catch (err) {
    alert(err.message);
  }
};

document
  .getElementById("btnToggleEmployeeForm")
  ?.addEventListener("click", () => {
    const form = document.getElementById("employeeForm");

    if (form) {
      form.style.display =
        form.style.display === "block" ? "none" : "block";
    }
  });

document
  .getElementById("btnCancelEmployee")
  ?.addEventListener("click", () => {
    const form = document.getElementById("employeeForm");

    if (form) {
      form.style.display = "none";
    }
  });

document
  .getElementById("btnSaveEmployee")
  ?.addEventListener("click", async () => {
    const name =
      document.getElementById("employeeName")?.value.trim() || "";

    const email =
      document.getElementById("employeeEmail")?.value.trim() || "";

    const wallet =
      document.getElementById("employeeWallet")?.value.trim() || "";

    const salary =
      document.getElementById("employeeSalary")?.value || "0";

    const startedAt =
      document.getElementById("employeeStartDate")?.value || "";

    const statusEl =
      document.getElementById("employeeFormStatus");

    if (!name) {
      if (statusEl) {
        statusEl.textContent = "Employee name is required.";
      }
      return;
    }

const currentWorkspace = getCurrentWorkspace();

if (!currentWorkspace?.id) {
  if (statusEl) {
    statusEl.textContent =
      "Please select a workspace first.";
  }

  return;
}

    try {
      if (statusEl) {
        statusEl.textContent = "Saving employee...";
      }

      await api("/api/employees", {
        method: "POST",
        body: JSON.stringify({
          employeeName: name,
          employeeEmail: email,
          wallet,
          baseSalary: Number(salary),
          startedAt,
          workspaceId: currentWorkspace.id
        })
      });

      document.getElementById("employeeName").value = "";
      document.getElementById("employeeEmail").value = "";
      document.getElementById("employeeWallet").value = "";
      document.getElementById("employeeSalary").value = "";
      document.getElementById("employeeStartDate").value = "";

      const form = document.getElementById("employeeForm");

      if (form) {
        form.style.display = "none";
      }

      if (statusEl) {
        statusEl.textContent = "Employee added successfully.";
      }

      await loadEmployees();
    } catch (err) {
      if (statusEl) {
        statusEl.textContent = `Error: ${err.message}`;
      }
    }
  });

document
  .getElementById("btnRefreshEmployees")
  ?.addEventListener("click", () => {
    loadEmployees();
  });

document
  .querySelectorAll(".employee-filter")
  .forEach((button) => {
    button.addEventListener("click", () => {
      loadEmployees(button.dataset.employeeStatus || "");
    });
  });

loadEmployees();

async function loadWithdrawals() {
  try {

const currentWorkspace = JSON.parse(
  localStorage.getItem("currentWorkspace") || "null"
);

if (!currentWorkspace?.id) {
  const el = document.getElementById("withdrawalsList");

  if (el) {
    el.innerHTML = "Please select a workspace.";
  }

  return;
}

    const rows = await api(
  "/api/withdrawals?workspaceId=" +
    encodeURIComponent(currentWorkspace.id)
);

    const el = document.getElementById("withdrawalsList");
    if (!el) return;

    if (!Array.isArray(rows) || rows.length === 0) {
      el.innerHTML = "No withdrawals found";
      return;
    }

    el.innerHTML = rows.map((w) => `
      <div style="padding:12px;margin:10px 0;background:#111827;border-radius:10px;">
        <div><b>${w.account_holder || "-"}</b></div>
        <div>${w.bank_name || "-"}</div>
        <div>${w.account_number || "-"}</div>
        <div>${w.amount || 0} USDC</div>
        <div>Status: ${w.status || "PENDING"}</div>
        ${w.status === "PENDING" ? `<button onclick="updateWithdrawalStatus('${w.id}','REVIEW')">Review</button>` : ""}
        ${w.status === "REVIEW" ? `
          <button onclick="updateWithdrawalStatus('${w.id}','APPROVED')">Approve</button>
          <button onclick="updateWithdrawalStatus('${w.id}','REJECTED')">Reject</button>
        ` : ""}
        ${w.status === "APPROVED" ? `<button onclick="updateWithdrawalStatus('${w.id}','COMPLETED')">Complete</button>` : ""}
      </div>
    `).join("");
  } catch (err) {
    console.error(err);
  }
}

window.updateWithdrawalStatus = async function (id, status) {
  const currentWorkspace = JSON.parse(
    localStorage.getItem("currentWorkspace") || "null"
  );

  if (!currentWorkspace?.id) {
    alert("Please select a workspace.");
    return;
  }

  await api(`/api/withdrawals/${id}/status`, {
    method: "POST",
    body: JSON.stringify({
      status,
      workspaceId: currentWorkspace.id
    })
  });

  await loadWithdrawals();
};

window.addEventListener(
  "workspaceChanged",
  loadWithdrawals
);
document.getElementById("btnLoadWithdrawals")?.addEventListener("click", loadWithdrawals);

// Sync AppKit wallet address with TROR
import { watchAccount } from "@wagmi/core";

async function loadWeb3UsdcBalance(account) {
  try {
    if (!account?.address || !account?.chainId) {
      return null;
    }

    const chainId = Number(account.chainId);

    const usdcToken =
      WEB3_USDC_BY_CHAIN[chainId];

    if (!usdcToken) {
      console.log(
        "TROR Web3 USDC token not configured:",
        chainId
      );

      return null;
    }

    const rawBalance = await readContract(
      wagmiAdapter.wagmiConfig,
      {
        address: usdcToken,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [account.address]
      }
    );

    const balance =
      Number(
        ethers.formatUnits(
          rawBalance,
          USDC_DECIMALS
        )
      );

    console.log("TROR Web3 USDC balance:", {
      chainId,
      address: account.address,
      usdcToken,
      balance
    });

    return balance;

  } catch (err) {
    console.error(
      "TROR Web3 balance error:",
      err
    );

    return null;
  }
}

async function loadTrorUnifiedBalance(address) {
  try {
    if (!address) {
      return null;
    }

    console.log(
      "TROR: loading Circle Unified Balance:",
      address
    );

    const result =
      await getTrorUnifiedBalance(address);

    console.log(
      "TROR Unified Balance result:",
      result
    );

    const balance =
      Number(
        result?.totalConfirmedBalance ?? 0
      );

const pendingBalance =
  Number(
    result?.totalPendingBalance ?? 0
  );

    const balanceEl =
      document.getElementById(
        "trorUnifiedBalance"
      );

    if (balanceEl) {
      balanceEl.textContent =
        `${balance.toFixed(6)} USDC`;
    }

const pendingEl =
  document.getElementById(
    "trorUnifiedPendingBalance"
  );

if (pendingEl) {
  pendingEl.textContent =
    `${pendingBalance.toFixed(6)} USDC`;
}

    return balance;

  } catch (err) {
    console.error(
      "TROR Unified Balance error:",
      err
    );

    const balanceEl =
      document.getElementById(
        "trorUnifiedBalance"
      );

    if (balanceEl) {
      balanceEl.textContent =
        "Unavailable";
    }

    return null;
  }
}

async function switchWeb3Network(chainId) {
  try {
    const targetChain =
      TROR_NETWORKS.find(
        (network) =>
          Number(network.id) === Number(chainId)
      );

    if (!targetChain) {
      throw new Error(
        `Unsupported Web3 network: ${chainId}`
      );
    }

    setStatus(
      `Switching Web3 wallet to ${targetChain.name}...`
    );

    await appKit.switchNetwork(targetChain);

    console.log(
      "TROR Web3 network switched:",
      {
        chainId: targetChain.id,
        name: targetChain.name
      }
    );

setStatus(
  `Web3 wallet switched to ${targetChain.name}.`,
  "success"
);

  } catch (err) {
    console.error(
      "TROR Web3 network switch error:",
      err
    );

    setStatus(
      err?.message ||
        "Failed to switch Web3 network.",
      "error"
    );
  }
}

let lastProfileCheckedWallet = null;

watchAccount(wagmiAdapter.wagmiConfig, {
  async onChange(account) {
    if (account.address) {
      metamaskWallet = account.address;

      const web3UsdcBalance =
  await loadWeb3UsdcBalance(account);

if (metamaskWalletEl) {
  const networkOptions =
    TROR_NETWORKS
      .map(
        (network) => `
          <option
            value="${network.id}"
            ${
              Number(network.id) ===
              Number(account.chainId)
                ? "selected"
                : ""
            }
          >
            ${network.name}
          </option>
        `
      )
      .join("");

  metamaskWalletEl.innerHTML = `
    <div style="
      word-break:break-all;
      margin-bottom:10px;
    ">
      ${account.address}
    </div>

    <div style="
      font-size:11px;
      color:#9ca3af;
      margin-bottom:5px;
      text-transform:uppercase;
      letter-spacing:.08em;
    ">
      Network
    </div>

    <select
      id="web3NetworkSelect"
      style="
        width:100%;
        box-sizing:border-box;
        padding:9px 10px;
        margin-bottom:12px;
        border-radius:10px;
        border:1px solid rgba(214,175,74,.75);
        background:#111318;
        color:#fff;
        outline:none;
      "
    >
      ${networkOptions}
    </select>

    <div style="
      font-size:11px;
      color:#9ca3af;
      margin-bottom:3px;
      text-transform:uppercase;
      letter-spacing:.08em;
    ">
      USDC Balance
    </div>

    <div
  id="web3UsdcBalance"
  style="
    font-size:18px;
    font-weight:800;
  "
>
  ${
    web3UsdcBalance === null
      ? "-"
      : `${web3UsdcBalance} USDC`
  }
</div>

<div
  style="
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:10px;
    margin-top:12px;
  "
>
  <div
    style="
      padding:10px 12px;
      border-radius:10px;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08);
    "
  >
    <div
      style="
        font-size:10px;
        color:#9ca3af;
        text-transform:uppercase;
        letter-spacing:.08em;
        margin-bottom:4px;
      "
    >
      Account
    </div>

    <div
      id="trorWeb3AccountMode"
      style="
        font-size:13px;
        font-weight:800;
      "
    >
      Standard EOA
    </div>
  </div>

  <div
    style="
      padding:10px 12px;
      border-radius:10px;
      background:rgba(255,255,255,.04);
      border:1px solid rgba(255,255,255,.08);
    "
  >
    <div
      style="
        font-size:10px;
        color:#9ca3af;
        text-transform:uppercase;
        letter-spacing:.08em;
        margin-bottom:4px;
      "
    >
      Gas
    </div>

    <div
      id="trorWeb3GasMode"
      style="
        font-size:13px;
        font-weight:800;
      "
    >
      Checking...
    </div>
  </div>
</div>

<div style="
  margin-top:14px;
  padding-top:12px;
  border-top:1px solid rgba(255,255,255,0.10);
">
  <div style="
    font-size:11px;
    color:#9ca3af;
    margin-bottom:3px;
    text-transform:uppercase;
    letter-spacing:.08em;
  ">
    Unified Balance
  </div>

  <div
    id="trorUnifiedBalance"
    style="
      font-size:18px;
      font-weight:800;
    "
  >
    -
  </div>

<div style="
  margin-top:8px;
  font-size:11px;
  color:#9ca3af;
  text-transform:uppercase;
  letter-spacing:.08em;
">
  Pending
</div>

<div
  id="trorUnifiedPendingBalance"
  style="
    margin-top:3px;
    font-size:14px;
    font-weight:700;
  "
>
  -
</div>

<div
  style="
    display:flex;
    gap:8px;
    margin-top:12px;
  "
>
  <button
    id="trorUnifiedDepositBtn"
    type="button"
    style="
      flex:1;
      padding:10px 8px;
      border-radius:10px;
      border:1px solid rgba(214,175,74,.75);
      background:rgba(214,175,74,.12);
      color:#fff;
      font-weight:800;
      cursor:pointer;
    "
  >
    Deposit
  </button>

  <button
    id="trorUnifiedSpendBtn"
    type="button"
    style="
      flex:1;
      padding:10px 8px;
      border-radius:10px;
      border:1px solid rgba(255,255,255,.20);
      background:rgba(255,255,255,.06);
      color:#fff;
      font-weight:800;
      cursor:pointer;
    "
  >
    Send
  </button>
</div>

<div
  id="trorUnifiedSendForm"
  style="
    display:none;
    position:fixed;
    top:0;
    right:0;
    bottom:0;
    left:0;
    width:100vw;
    height:100vh;
    z-index:2147483000;
    align-items:center;
    justify-content:center;
    box-sizing:border-box;
    padding:20px;
    margin:0;
    background:rgba(0,0,0,.72);
  "
>

<div
  style="
    width:100%;
    max-width:380px;
    max-height:90vh;
    overflow-y:auto;
    box-sizing:border-box;
    padding:20px;
    border-radius:18px;
    background:#121a2b;
    border:1px solid rgba(214,175,74,.35);
    box-shadow:0 24px 70px rgba(0,0,0,.45);
    color:#fff;
  "
>

<div
  style="
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    margin-bottom:12px;
  "
>
  <div
    style="
      font-size:12px;
      font-weight:800;
    "
  >
    Send from Unified Balance
  </div>

  <button
    id="trorUnifiedSendCloseBtn"
    type="button"
    aria-label="Close"
    style="
      width:32px;
      height:32px;
      padding:0;
      border-radius:50%;
      border:1px solid rgba(255,255,255,.14);
      background:rgba(255,255,255,.06);
      color:#fff;
      font-size:20px;
      line-height:1;
      cursor:pointer;
    "
  >
    ×
  </button>
</div>

  <input
    id="trorUnifiedRecipient"
    type="text"
    placeholder="Recipient 0x..."
    style="
      width:100%;
      box-sizing:border-box;
      padding:10px;
      margin-bottom:8px;
      border-radius:10px;
      border:1px solid rgba(255,255,255,.18);
      background:#111318;
      color:#fff;
    "
  />

  <input
    id="trorUnifiedAmount"
    type="number"
    min="0"
    step="0.000001"
    placeholder="Amount USDC"
    value="0.05"
    style="
      width:100%;
      box-sizing:border-box;
      padding:10px;
      margin-bottom:8px;
      border-radius:10px;
      border:1px solid rgba(255,255,255,.18);
      background:#111318;
      color:#fff;
    "
  />

  <select
    id="trorUnifiedDestination"
    style="
      width:100%;
      box-sizing:border-box;
      padding:10px;
      margin-bottom:10px;
      border-radius:10px;
      border:1px solid rgba(214,175,74,.75);
      background:#111318;
      color:#fff;
    "
  >
    <option value="5042002">
      Arc Testnet
    </option>

    <option value="11155111">
      Ethereum Sepolia
    </option>

    <option value="84532">
      Base Sepolia
    </option>

    <option value="421614">
      Arbitrum Sepolia
    </option>

    <option value="43113">
      Avalanche Fuji
    </option>

    <option value="11155420">
      Optimism Sepolia
    </option>

    <option value="80002">
      Polygon Amoy
    </option>

    <option value="1301">
      Unichain Sepolia
    </option>
  </select>

<div
  style="
    margin-bottom:10px;
    padding:10px;
    border-radius:10px;
    background:rgba(255,255,255,.04);
    border:1px solid rgba(255,255,255,.10);
  "
>
  <div
    style="
      display:flex;
      justify-content:space-between;
      gap:12px;
      margin-bottom:6px;
      font-size:12px;
      color:#9ca3af;
    "
  >
    <span>Estimated Fee</span>

    <span
      id="trorUnifiedSpendFee"
      style="color:#fff;font-weight:700;"
    >
      -
    </span>
  </div>

  <div
    style="
      display:flex;
      justify-content:space-between;
      gap:12px;
      font-size:12px;
      color:#9ca3af;
    "
  >
    <span>Estimated Total</span>

    <span
      id="trorUnifiedSpendTotal"
      style="color:#fff;font-weight:800;"
    >
      -
    </span>
  </div>
</div>

  <button
    id="trorUnifiedSendConfirmBtn"
    type="button"
    style="
      width:100%;
      padding:10px 12px;
      border-radius:10px;
      border:1px solid rgba(214,175,74,.75);
      background:rgba(214,175,74,.16);
      color:#fff;
      font-weight:800;
      cursor:pointer;
    "
  >
    Send USDC
  </button>
</div>
</div>
</div>
  `;

try {
  const gasInfo =
    await getTrorGasCapability();

  const accountModeEl =
    document.getElementById(
      "trorWeb3AccountMode"
    );

  const gasModeEl =
    document.getElementById(
      "trorWeb3GasMode"
    );

  /*
    ARC
    Native USDC gas.
  */
  if (
    gasInfo.gasMode ===
    "native-usdc"
  ) {
    if (accountModeEl) {
      accountModeEl.textContent =
        "Standard EOA";
    }

    if (gasModeEl) {
      gasModeEl.textContent =
        "USDC ✓";
    }
  }

  /*
    WALLET-NATIVE SMART ACCOUNT
    Example verified:
    MetaMask + Base Sepolia.
  */
  else if (
    gasInfo.gasMode ===
    "wallet-sponsored"
  ) {
    if (accountModeEl) {
      accountModeEl.textContent =
        "EIP-7702 ✓";
    }

    if (gasModeEl) {
      gasModeEl.textContent =
        "Sponsored ✓";
    }
  }

  /*
    WALLET-EXPOSED PAYMASTER
  */
  else if (
    gasInfo.gasMode ===
    "circle-paymaster"
  ) {
    if (accountModeEl) {
      accountModeEl.textContent =
        "Smart enabled ✓";
    }

    if (gasModeEl) {
      gasModeEl.textContent =
        "USDC ✓";
    }
  }

  /*
    NORMAL NATIVE GAS FALLBACK
  */
  else {
    if (accountModeEl) {
      accountModeEl.textContent =
        "Standard EOA";
    }

    const nativeGasSymbols = {
      11155111: "ETH required",
      84532: "ETH required",
      421614: "ETH required",
      43113: "AVAX required",
      11155420: "ETH required",
      80002: "POL required",
      1301: "ETH required"
    };

    if (gasModeEl) {
      gasModeEl.textContent =
        nativeGasSymbols[
          gasInfo.chainId
        ] ||
        "Native gas required";
    }
  }

  console.log(
    "TROR Connected Wallet gas UI:",
    {
      chainId:
        gasInfo.chainId,

      chainName:
        gasInfo.chainName,

      gasMode:
        gasInfo.gasMode
    }
  );

} catch (error) {
  console.warn(
    "TROR gas status unavailable:",
    error
  );

  const accountModeEl =
    document.getElementById(
      "trorWeb3AccountMode"
    );

  const gasModeEl =
    document.getElementById(
      "trorWeb3GasMode"
    );

  if (accountModeEl) {
    accountModeEl.textContent =
      "Standard EOA";
  }

  if (gasModeEl) {
    gasModeEl.textContent =
      "Unavailable";
  }
}

// Move Unified Balance Send modal outside
// the Connected Wallet card.
// This prevents fixed-position flickering.
const oldUnifiedSendModal =
  document.querySelector(
    "body > #trorUnifiedSendForm"
  );

if (oldUnifiedSendModal) {
  oldUnifiedSendModal.remove();
}

const unifiedSendModal =
  metamaskWalletEl.querySelector(
    "#trorUnifiedSendForm"
  );

if (unifiedSendModal) {
  document.body.appendChild(
    unifiedSendModal
  );

document
  .getElementById(
    "trorUnifiedSendCloseBtn"
  )
  ?.addEventListener(
    "click",
    () => {
      const form =
        document.getElementById(
          "trorUnifiedSendForm"
        );

      if (form) {
        form.style.display = "none";
      }
    }
  );

}

  document
    .getElementById("web3NetworkSelect")
    ?.addEventListener(
      "change",
      async (event) => {
        const chainId =
          Number(event.target.value);

        await switchWeb3Network(chainId);
      }
    );
}

document
  .getElementById("trorUnifiedDepositBtn")
  ?.addEventListener(
    "click",
    async () => {
      try {
        const amount = window.prompt(
          "Enter USDC amount to deposit:",
          "0.10"
        );

        if (!amount) {
          return;
        }

        const numericAmount = Number(amount);

        if (
          !Number.isFinite(numericAmount) ||
          numericAmount <= 0
        ) {
          setStatus(
            "Enter a valid USDC amount.",
            "error"
          );
          return;
        }

        setStatus(
  "Checking Web3 wallet capabilities..."
);

const capabilities =
  await checkTrorWeb3Capabilities();

console.log(
  "TROR Web3 capabilities before Unified deposit:",
  capabilities
);

let gasAnalysis = null;

try {
  gasAnalysis =
    await analyzeTrorWeb3GasCapabilities();

  console.log(
    "TROR Web3 gas capabilities before Unified deposit:",
    gasAnalysis
  );
} catch (error) {
  console.warn(
    "TROR Web3 gas capability check skipped:",
    error
  );
}

let support7702 = null;

try {
  support7702 =
    await checkTror7702BrowserSupport();

  console.log(
    "TROR EIP-7702 browser test:",
    support7702
  );
} catch (error) {
  console.warn(
    "TROR EIP-7702 browser test failed:",
    error
  );
}

const account7702 =
  await createTror7702Account();

const providerInspection =
  await inspectTrorWalletProvider();

const atomicInspection =
  await inspectTrorAtomicCapabilities();

console.log(
  "TROR atomic capability test:",
  atomicInspection
);

const rpc7702Inspection =
  await inspectTror7702RpcSupport();

console.log(
  "TROR 7702 RPC test:",
  rpc7702Inspection
);

console.log(
  "TROR wallet provider test:",
  providerInspection
);

console.log(
  "TROR 7702 same-address test:",
  {
    ownerAddress:
      account7702.ownerAddress,

    smartAccountAddress:
      account7702.smartAccountAddress,

    sameAddress:
      account7702.sameAddress,

    chainId:
      account7702.chainId,

    chainName:
      account7702.chainName
  }
);

setStatus(
  `Depositing ${amount} USDC to Unified Balance...`
);

const result =
  await depositToTrorUnifiedBalance(
    amount
  );

        console.log(
          "TROR Unified deposit result:",
          result
        );

        await loadTrorUnifiedBalance(
          account.address
        );

        setStatus(
          `Deposited ${amount} USDC to Unified Balance.`,
          "success"
        );
      } catch (err) {
        console.error(
          "TROR Unified deposit error:",
          err
        );

        setStatus(
          err?.message ||
            "Unified Balance deposit failed.",
          "error"
        );
      }
    }
  );

document
  .getElementById("trorUnifiedSpendBtn")
  ?.addEventListener(
    "click",
    () => {
      const form =
        document.getElementById(
          "trorUnifiedSendForm"
        );

      if (!form) {
        return;
      }

      const isHidden =
        form.style.display === "none";

      form.style.display =
  isHidden ? "flex" : "none";
    }
  );

async function handleTrorUnifiedSpendEstimate() {
  const recipientAddress =
    document.getElementById(
      "trorUnifiedRecipient"
    )?.value?.trim();

  const amount =
    document.getElementById(
      "trorUnifiedAmount"
    )?.value?.trim();

  const destinationChainId =
    Number(
      document.getElementById(
        "trorUnifiedDestination"
      )?.value
    );

  const feeEl =
    document.getElementById(
      "trorUnifiedSpendFee"
    );

  const totalEl =
    document.getElementById(
      "trorUnifiedSpendTotal"
    );

  if (
    !recipientAddress ||
    !amount ||
    !destinationChainId
  ) {
    if (feeEl) {
      feeEl.textContent = "-";
    }

    if (totalEl) {
      totalEl.textContent = "-";
    }

    return;
  }

  try {
    if (feeEl) {
      feeEl.textContent = "Estimating...";
    }

    const estimate =
      await estimateTrorUnifiedSpend({
        recipientAddress,
        amount,
        destinationChainId
      });

    const fees =
      Array.isArray(estimate?.fees)
        ? estimate.fees
        : [];

    const totalFee =
      fees.reduce(
        (sum, fee) =>
          sum + Number(fee?.amount || 0),
        0
      );

    const total =
      Number(amount) + totalFee;

    if (feeEl) {
      feeEl.textContent =
        `${totalFee.toFixed(6)} USDC`;
    }

    if (totalEl) {
      totalEl.textContent =
        `${total.toFixed(6)} USDC`;
    }

    console.log(
      "TROR Unified Spend estimate:",
      {
        amount,
        fees,
        totalFee,
        total
      }
    );

  } catch (err) {
    console.error(
      "TROR Unified Spend estimate error:",
      err
    );

    if (feeEl) {
      feeEl.textContent =
        "Unavailable";
    }

    if (totalEl) {
      totalEl.textContent = "-";
    }
  }
}

document
  .getElementById("trorUnifiedAmount")
  ?.addEventListener(
    "input",
    () => {
      handleTrorUnifiedSpendEstimate();
    }
  );

document
  .getElementById("trorUnifiedRecipient")
  ?.addEventListener(
    "input",
    () => {
      handleTrorUnifiedSpendEstimate();
    }
  );

document
  .getElementById("trorUnifiedDestination")
  ?.addEventListener(
    "change",
    () => {
      handleTrorUnifiedSpendEstimate();
    }
  );

  document
  .getElementById(
    "trorUnifiedSendConfirmBtn"
  )
  ?.addEventListener(
    "click",
    async () => {
      try {
        const recipientAddress =
          document
            .getElementById(
              "trorUnifiedRecipient"
            )
            ?.value
            ?.trim();

        const amount =
          document
            .getElementById(
              "trorUnifiedAmount"
            )
            ?.value
            ?.trim();

        const destinationChainId =
          Number(
            document
              .getElementById(
                "trorUnifiedDestination"
              )
              ?.value
          );

        if (!recipientAddress) {
          setStatus(
            "Recipient address is required.",
            "error"
          );
          return;
        }

        const numericAmount =
          Number(amount);

        if (
          !Number.isFinite(numericAmount) ||
          numericAmount <= 0
        ) {
          setStatus(
            "Enter a valid USDC amount.",
            "error"
          );
          return;
        }

        const sendBtn =
          document.getElementById(
            "trorUnifiedSendConfirmBtn"
          );

        if (sendBtn) {
          sendBtn.disabled = true;
          sendBtn.textContent =
            "Sending...";
        }

        setStatus(
          `Sending ${amount} USDC from Unified Balance...`
        );

        const result =
          await spendFromTrorUnifiedBalance({
            recipientAddress,
            amount,
            destinationChainId
          });

        console.log(
          "TROR Unified spend UI result:",
          result
        );

        await loadTrorUnifiedBalance(
          account.address
        );

        setStatus(
          `Sent ${amount} USDC from Unified Balance.`,
          "success"
        );

        const form =
          document.getElementById(
            "trorUnifiedSendForm"
          );

        if (form) {
          form.style.display = "none";
        }

      } catch (err) {
        console.error(
          "TROR Unified spend UI error:",
          err
        );

        setStatus(
          err?.message ||
            "Unified Balance spend failed.",
          "error"
        );
      } finally {
        const sendBtn =
          document.getElementById(
            "trorUnifiedSendConfirmBtn"
          );

        if (sendBtn) {
          sendBtn.disabled = false;
          sendBtn.textContent =
            "Send USDC";
        }
      }
    }
  );

updateWalletChip(
  account.address,
  web3UsdcBalance
);

loadTrorUnifiedBalance(account.address);

clearCircleWalletLocal();
activeWalletType = "web3";

      const normalizedWallet =
        account.address.toLowerCase();

      if (
        lastProfileCheckedWallet !== normalizedWallet
      ) {
        lastProfileCheckedWallet = normalizedWallet;

        const hasProfile =
          await checkUserProfile(account.address);

        if (!hasProfile) {
          setStatus(
            "Please create your TROR profile.",
            "error"
          );
          return;
        }

        setStatus(
  "Wallet and profile connected.",
  "success"
);

// Close AppKit after successful wallet connection
appKit?.close?.();

document
  .getElementById("walletModal")
  ?.classList.add("hidden");

// Normal Connect flow -> stay on Dashboard.
// Invoice payment flow -> keep invoice page open.
if (!isInvoicePaymentMode()) {
  showTab("dashboard");
  updateTopbarTitle("dashboard");
  window.location.hash = "dashboard";
}
      }
    } else {
      metamaskWallet = null;
      lastProfileCheckedWallet = null;

      updateWalletChip(null, null);

      localStorage.removeItem("currentUser");
      localStorage.removeItem("currentWorkspace");

      if (activeWalletType === "web3") {
        activeWalletType = null;
      }
    }
  }
});