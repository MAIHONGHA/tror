import React from "react";
import { createRoot } from "react-dom/client";
import PayoutPanel from "./PayoutPanel.jsx";
import "./style.css";
import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";
import Web3 from "web3";
import PayrollPanel from "./PayrollPanel.jsx";
import { Html5Qrcode } from "html5-qrcode";
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
  arcTestnet
} from "./appkit.js";
import { getAccount, readContract, writeContract, waitForTransactionReceipt } from "@wagmi/core";
import { parseUnits } from "viem";
window.openAppKitWallet = openAppKitWallet;

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
  const dot  = document.getElementById("wcDot");
  const bal  = document.getElementById("walletChipBalance");
  const addr = document.getElementById("walletChipAddress");
  const btn  = document.getElementById("btnConnectWallet");

  if (address && address !== "Disconnected") {
    if (dot)  dot.classList.add("connected");
    if (bal)  bal.textContent = (balance || "0.00") + " USDC";
    if (addr) addr.textContent = address.slice(0,6) + "..." + address.slice(-4) + " ▾";
    if (btn)  {
      btn.textContent = "Connected ▾";
      btn.style.background = "rgba(0,232,135,0.15)";
      btn.style.borderColor = "rgba(0,232,135,0.3)";
    }

// Show/hide action buttons based on connection
const payBtn = document.getElementById("btnPay");
const scanBtn = document.getElementById("btnScanQR");

if (address && address !== "Disconnected") {
  if (payBtn) payBtn.style.display = "block";
  if (scanBtn) scanBtn.style.display = "block";
} else {
  if (payBtn) payBtn.style.display = "none";
  if (scanBtn) scanBtn.style.display = "none";
}

  } else {
    if (dot)  dot.classList.remove("connected");
    if (bal)  bal.textContent = "0.00 USDC";
    if (addr) addr.textContent = "Disconnected ▾";
    if (btn)  {
      btn.textContent = "Connect ▾";
      btn.style.background = "";
      btn.style.borderColor = "";
    }
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

document.querySelectorAll("#walletChip").forEach((chip) => {
  chip.addEventListener("click", () => {
    const menu = document.getElementById("walletMenu");
    if (!menu) return;

    menu.classList.toggle("hidden");

    if (!menu.classList.contains("hidden")) {
      positionWalletMenu(chip);
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
  if (circleWalletEl) {
    circleWalletEl.textContent = "-";
  }

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
document.getElementById("disconnectWalletChip")?.addEventListener("click", () => {
  disconnectMetaMask();
  document.getElementById("walletMenu")?.classList.add("hidden");
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

        modal.style.display = "none";

        setStatus(
          "TROR profile created successfully.",
          "success"
        );

        showTab("dashboard");
        updateTopbarTitle("dashboard");

        window.location.hash = "dashboard";
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

// Extract wallet object from Circle API response
function extractWallet(data) {
  const wallets = data?.data?.wallets || data?.wallets || [];
  return (
    wallets.find((w) => String(w.blockchain || "").toUpperCase() === "ARC-TESTNET") ||
    wallets[0] ||
    data?.data?.wallet ||
    data?.wallet ||
    null
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

// Load and display Circle wallet address
async function loadCircleWallet(userToken) {
  const listData = await listCircleWallets(userToken);
  console.log("List wallets response:", listData);

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

setStatus("Circle wallet loaded.", "success");
  document.getElementById("btnSetupPin")?.classList.add("hidden");

  return { wallet, address };
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

/* =========================
   GOOGLE + CIRCLE LOGIN
========================= */

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
  } catch {}
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
        setStatus("User already initialized. Loading wallet...");
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

        const address = extractWalletAddress(walletData);

if (address) {
  circleWalletEl.textContent = address;

  clearWeb3WalletLocal();

  activeWalletType = "circle";
  updateWalletChip(address, null);

  setStatus("Circle wallet created.", "success");
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

    const body = {
      workspaceId: currentWorkspace.id,
      name: String(bizNameEl.value || "").trim(),
      email: String(bizEmailEl.value || "")
        .trim()
        .toLowerCase(),
      wallet: String(bizWalletEl.value || "").trim()
    };

    const data = await api("/api/business-profile", {
      method: "POST",
      body: JSON.stringify(body)
    });

    setStatus(
      data.message || "Business profile saved.",
      "success"
    );
  } catch (err) {
    console.error(
      "Save business profile error:",
      err
    );

    setStatus(
      err.message || "Business profile save failed.",
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

async function checkUserProfile(walletAddress) {

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

function renderWorkspaceSwitcher(
  workspaces,
  currentWorkspace
) {
console.log(
    "RENDER WORKSPACE SWITCHER:",
    workspaces,
    currentWorkspace
  );

  let switcher = document.getElementById(
    "workspaceSwitcher"
  );

  if (!switcher) {
    switcher = document.createElement("select");
    switcher.id = "workspaceSwitcher";

    switcher.style.cssText = `
  width:210px;
  max-width:210px;
  padding:10px 12px;
  margin-right:10px;
  border-radius:12px;
  border:1px solid rgba(250,204,21,.45);
  color:#f8fafc;
  background:#0f172a;
  font-weight:700;
  cursor:pointer;
  position:relative;
  z-index:10000;
  flex-shrink:0;
`;

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
  }

  switcher.innerHTML = "";

  workspaces.forEach((workspace) => {
    const option = document.createElement("option");

    option.value = workspace.id;
    option.textContent =
      workspace.workspace_type === "BUSINESS"
        ? `🏢 ${workspace.workspace_name}`
        : `👤 ${workspace.workspace_name}`;

    if (workspace.id === currentWorkspace?.id) {
      option.selected = true;
    }

    switcher.appendChild(option);
  });

  switcher.onchange = () => {
    const selectedWorkspace = workspaces.find(
      (workspace) =>
        workspace.id === switcher.value
    );

    if (!selectedWorkspace) return;

    localStorage.setItem(
      "currentWorkspace",
      JSON.stringify(selectedWorkspace)
    );

selectedInvoice = null;

// Clear the selected invoice and previous QR code
renderSelectedInvoice();

// Close the invoice popup if it is open
closeInvoiceSheet();

renderCustomerDropdown();

loadWorkspaceClaims().catch((err) => {
  console.error(
    "Reload workspace claims error:",
    err
  );
});

loadInvoices().catch((err) => {
  console.error("Reload workspace invoices error:", err);
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
  };
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

// Connect button opens wallet modal
btnConnectWallet?.addEventListener("click", () => {
  walletModalMode = "connect";
  document.getElementById("walletModal")?.classList.remove("hidden");
});

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
  document.getElementById("walletModal")?.classList.add("hidden");
  await openAppKitWallet();
});

// Google / Circle option in modal
document.getElementById("btnChooseCircle")?.addEventListener("click", async () => {
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

let lastProfileCheckedWallet = null;

watchAccount(wagmiAdapter.wagmiConfig, {
  async onChange(account) {
    if (account.address) {
      metamaskWallet = account.address;

      if (metamaskWalletEl) {
        metamaskWalletEl.textContent = account.address;
      }

      updateWalletChip(account.address, null);
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