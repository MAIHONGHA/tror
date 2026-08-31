import { useEffect, useState } from "react";

import {
  getAccount,
  writeContract,
  waitForTransactionReceipt
} from "@wagmi/core";

import { ethers } from "ethers";
import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";

import {
  wagmiAdapter
} from "./appkit.js";

const API_BASE = window.location.origin;

const ARC_CHAIN_ID = 5042002;

const USDC_ADDRESS =
  "0x3600000000000000000000000000000000000000";

const TROR_PAYOUT_CONTRACT_ADDRESS =
  "0xaD91ad41D59cACA639D3Da3123d14DA009b8f3f5";

const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "spender",
        type: "address"
      },
      {
        name: "amount",
        type: "uint256"
      }
    ],
    outputs: [
      {
        name: "",
        type: "bool"
      }
    ]
  }
];

const TROR_PAYOUT_ABI = [
  {
    type: "function",
    name: "executePayout",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "payoutId",
        type: "bytes32"
      },
      {
        name: "recipient",
        type: "address"
      },
      {
        name: "amount",
        type: "uint256"
      }
    ],
    outputs: []
  }
];

function getCurrentWorkspace() {
  try {
    return JSON.parse(
      localStorage.getItem("currentWorkspace") || "null"
    );
  } catch {
    return null;
  }
}

function getCirclePayoutWallet() {
  const wallet =
    window.trorActiveCircleWallet;

  if (!wallet?.address) {
    return null;
  }

  const walletId =
    wallet.walletId ||
    wallet.id ||
    null;

  if (!walletId) {
    return null;
  }

  if (
    String(
      wallet.blockchain || ""
    ).toUpperCase() !==
    "ARC-TESTNET"
  ) {
    return null;
  }

  return {
    ...wallet,
    walletId
  };
}

async function executeCirclePayoutChallenge(
  challengeId,
  userToken,
  encryptionKey
) {
  if (!challengeId) {
    throw new Error(
      "Missing Circle challengeId."
    );
  }

  const configRes =
    await fetch(
      `${API_BASE}/api/circle/config`
    );

  const configData =
    await configRes.json();

  if (!configRes.ok) {
    throw new Error(
      configData?.error ||
      "Failed to load Circle config."
    );
  }

  const appId =
    configData?.config?.circleAppId;

  if (!appId) {
    throw new Error(
      "Missing CIRCLE_APP_ID."
    );
  }

  const sdk =
    new W3SSdk({
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

export default function PayoutPanel() {
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(false);

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [mode, setMode] = useState("now");
  const [frequency, setFrequency] = useState("once");
  const [scheduledAt, setScheduledAt] = useState("");

  async function loadPayouts() {
    setLoading(true);

    try {
      const currentWorkspace = getCurrentWorkspace();

      if (!currentWorkspace?.id) {
        setPayouts([]);
        return;
      }

      const res = await fetch(
        `${API_BASE}/api/payouts?workspaceId=${encodeURIComponent(
          currentWorkspace.id
        )}`
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Failed to load payouts"
        );
      }

      setPayouts(
        Array.isArray(data) ? data : []
      );
    } catch (err) {
      console.error("Load payouts error:", err);

      alert(
        err.message || "Failed to load payouts"
      );
    } finally {
      setLoading(false);
    }
  }

  async function createPayout() {
    const currentWorkspace = getCurrentWorkspace();

    if (!currentWorkspace?.id) {
      alert("Please select a workspace.");
      return;
    }

    const normalizedRecipient = recipient.trim();
    const numericAmount = Number(amount);

    if (!normalizedRecipient) {
      alert("Please enter a recipient wallet.");
      return;
    }

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      alert("Please enter a valid payout amount.");
      return;
    }

let nextRunAt = null;

if (mode === "scheduled") {
  if (!scheduledAt) {
    alert("Please select a payout date and time.");
    return;
  }

  const scheduledDate = new Date(scheduledAt);

  if (
    Number.isNaN(scheduledDate.getTime()) ||
    scheduledDate.getTime() <= Date.now()
  ) {
    alert("Scheduled time must be in the future.");
    return;
  }

  nextRunAt = scheduledDate.toISOString();
}

    try {
      const res = await fetch(
        `${API_BASE}/api/payouts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recipient: normalizedRecipient,
            amount: numericAmount,
            workspaceId: currentWorkspace.id,
            mode,
            frequency: "once",
            nextRunAt,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Create payout failed"
        );
      }

      setRecipient("");
      setAmount("");
      setMode("now");
      setFrequency("once");
      setScheduledAt("");

      await loadPayouts();

      alert("Payout created.");
    } catch (err) {
      console.error("Create payout error:", err);

      alert(
        err.message || "Create payout failed"
      );
    }
  }

  async function approvePayout(id) {
    const shouldApprove = window.confirm(
      "Approve scheduled payout?"
    );

    if (!shouldApprove) {
      return;
    }

    const currentWorkspace = getCurrentWorkspace();

    if (!currentWorkspace?.id) {
      alert("Please select a workspace first.");
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}/api/payouts/${id}/approve`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            workspaceId: currentWorkspace.id,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.error || "Approve payout failed"
        );
      }

      await loadPayouts();
    } catch (err) {
      console.error("Approve payout error:", err);

      alert(
        err.message || "Approve payout failed"
      );
    }
  }

  async function confirmPayout(id) {
  const shouldConfirm =
    window.confirm(
      "Confirm and send payout now?"
    );

  if (!shouldConfirm) {
    return;
  }

  const currentWorkspace =
    getCurrentWorkspace();

  if (!currentWorkspace?.id) {
    alert(
      "Please select a workspace first."
    );
    return;
  }

  try {
    /*
      Connected wallet is the payer.
      Backend never selects a private-key wallet.
    */
    const account =
  getAccount(
    wagmiAdapter.wagmiConfig
  );

const activeWallet =
  typeof window.getActivePaymentWallet ===
  "function"
    ? window.getActivePaymentWallet()
    : null;

if (!activeWallet) {
  alert(
    "Connect an active payment wallet before sending payout."
  );
  return;
}

const useWeb3 =
  activeWallet.type === "web3";

const circleWallet =
  !useWeb3
    ? getCirclePayoutWallet()
    : null;

if (useWeb3) {
  if (
    !account?.address ||
    account.address.toLowerCase() !==
      activeWallet.address.toLowerCase()
  ) {
    alert(
      "The active Web3 wallet does not match the connected signing wallet."
    );
    return;
  }
} else {
  if (!circleWallet) {
    alert(
      "Active Circle Wallet is not ready on Arc Testnet."
    );
    return;
  }

  if (
    circleWallet.address.toLowerCase() !==
    activeWallet.address.toLowerCase()
  ) {
    alert(
      "The active Circle Wallet does not match the connected Circle wallet."
    );
    return;
  }
}

    if (
  useWeb3 &&
  Number(account?.chainId) !==
    ARC_CHAIN_ID
) {
      alert(
        "Switch your connected wallet to Arc Testnet."
      );
      return;
    }

    /*
      Backend only PREPARES payout data.
    */
    const res =
      await fetch(
        `${API_BASE}/api/payouts/${id}/confirm`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json"
          },
          body: JSON.stringify({
            workspaceId:
              currentWorkspace.id
          })
        }
      );

    const data =
      await res.json();

    if (!res.ok) {
      throw new Error(
        data.error ||
        "Prepare payout failed"
      );
    }

    if (
      data?.mode !==
        "CONNECTED_WALLET" ||
      data?.requiresWalletSignature !==
        true
    ) {
      throw new Error(
        "Invalid payout payment plan."
      );
    }

    const payout =
      data?.payout;

    if (!payout) {
      throw new Error(
        "Payout payment data is missing."
      );
    }

    if (
      !ethers.isAddress(
        payout.recipient
      )
    ) {
      throw new Error(
        "Invalid payout recipient."
      );
    }

    const amountUnits =
      BigInt(
        payout.amountUnits
      );

    if (amountUnits <= 0n) {
      throw new Error(
        "Invalid payout amount."
      );
    }

    const payoutId =
      ethers.keccak256(
        ethers.toUtf8Bytes(
          `tror-payout-${id}`
        )
      );

    const payerAddress =
  activeWallet.address;

const payerType =
  useWeb3
    ? "WEB3"
    : "CIRCLE";

const confirmed =
  window.confirm(
    `TROR Payout\n\n` +
    `Payer (${payerType}):\n${payerAddress}\n\n` +
    `Recipient:\n${payout.recipient}\n\n` +
    `Amount: ${payout.amount} USDC\n\n` +
    `Network: ${data.network?.chainName || "Arc Testnet"}\n\n` +
    `Continue to wallet authorization?`
  );

if (!confirmed) {
  return;
}

let approveHash = "";
let payoutHash = "";

let circleUserToken = null;
let circleEncryptionKey = null;

if (useWeb3) {
  /*
    WEB3 PAYOUT
  */

  alert(
    "Step 1/2: Approve USDC for TRORPayout."
  );

  approveHash =
    await writeContract(
      wagmiAdapter.wagmiConfig,
      {
        address:
          USDC_ADDRESS,

        abi:
          ERC20_APPROVE_ABI,

        functionName:
          "approve",

        args: [
          TROR_PAYOUT_CONTRACT_ADDRESS,
          amountUnits
        ],

        account:
          account.address,

        chainId:
          ARC_CHAIN_ID
      }
    );

  await waitForTransactionReceipt(
    wagmiAdapter.wagmiConfig,
    {
      hash:
        approveHash
    }
  );

  alert(
    "Step 2/2: Confirm payout execution in your wallet."
  );

  payoutHash =
    await writeContract(
      wagmiAdapter.wagmiConfig,
      {
        address:
          TROR_PAYOUT_CONTRACT_ADDRESS,

        abi:
          TROR_PAYOUT_ABI,

        functionName:
          "executePayout",

        args: [
          payoutId,
          payout.recipient,
          amountUnits
        ],

        account:
          account.address,

        chainId:
          ARC_CHAIN_ID
      }
    );

  const receipt =
    await waitForTransactionReceipt(
      wagmiAdapter.wagmiConfig,
      {
        hash:
          payoutHash
      }
    );

  if (
    !receipt ||
    receipt.status !== "success"
  ) {
    throw new Error(
      "Payout transaction failed."
    );
  }

} else {
  /*
    CIRCLE PAYOUT
  */

  if (
    typeof window.getCircleAuth !==
    "function"
  ) {
    throw new Error(
      "Circle authentication is not available."
    );
  }

  const circleAuth =
  await window.getCircleAuth();

circleUserToken =
  circleAuth?.userToken || null;

circleEncryptionKey =
  circleAuth?.encryptionKey || null;

  if (
  !circleUserToken ||
  !circleEncryptionKey
  ) {
    throw new Error(
      "Missing Circle authentication."
    );
  }

  /*
    STEP 1
    Circle approve USDC
  */

  alert(
    "Step 1/2: Approve USDC in Circle Wallet."
  );

  const approveRes =
    await fetch(
      `${API_BASE}/api/circle/contract-execution`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          circleUserToken,

          walletId:
            circleWallet.walletId,

          contractAddress:
            USDC_ADDRESS,

          abiFunctionSignature:
            "approve(address,uint256)",

          abiParameters: [
            TROR_PAYOUT_CONTRACT_ADDRESS,
            amountUnits.toString()
          ]
        })
      }
    );

  const approveData =
    await approveRes.json();

  if (!approveRes.ok) {
    throw new Error(
      approveData?.error ||
      "Circle USDC approve failed."
    );
  }

  const approveChallengeId =
    approveData?.data?.challengeId ||
    approveData?.challengeId;

  if (!approveChallengeId) {
    throw new Error(
      "Circle approve challengeId was not returned."
    );
  }

  await executeCirclePayoutChallenge(
    approveChallengeId,
    circleUserToken,
    circleEncryptionKey
  );

  /*
    Give Circle time to submit
    the approve transaction.
  */
  await new Promise(
    (resolve) =>
      setTimeout(resolve, 6000)
  );

  /*
    Snapshot Circle transactions
    BEFORE executePayout.

    This prevents an old completed
    transaction from being mistaken
    for this payout.
  */
  const beforeTxRes =
    await fetch(
      `${API_BASE}/api/circle/transactions`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          circleUserToken
        })
      }
    );

  const beforeTxData =
    await beforeTxRes.json();

  if (!beforeTxRes.ok) {
    throw new Error(
      beforeTxData?.error ||
      "Failed to snapshot Circle transactions."
    );
  }

  const existingTransactionIds =
    new Set(
      (
        beforeTxData?.data
          ?.transactions ||
        []
      )
        .map(
          (item) =>
            String(
              item?.id || ""
            )
        )
        .filter(Boolean)
    );

  /*
    STEP 2
    Circle executePayout
  */

  alert(
    "Step 2/2: Confirm payout execution in Circle Wallet."
  );

  const executeRes =
    await fetch(
      `${API_BASE}/api/circle/contract-execution`,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({
          circleUserToken,

          walletId:
            circleWallet.walletId,

          contractAddress:
            TROR_PAYOUT_CONTRACT_ADDRESS,

          abiFunctionSignature:
            "executePayout(bytes32,address,uint256)",

          abiParameters: [
            payoutId,
            payout.recipient,
            amountUnits.toString()
          ]
        })
      }
    );

  const executeData =
    await executeRes.json();

  if (!executeRes.ok) {
    throw new Error(
      executeData?.error ||
      "Circle payout execution failed."
    );
  }

  const executeChallengeId =
    executeData?.data?.challengeId ||
    executeData?.challengeId;

  if (!executeChallengeId) {
    throw new Error(
      "Circle payout challengeId was not returned."
    );
  }

  await executeCirclePayoutChallenge(
    executeChallengeId,
    circleUserToken,
    circleEncryptionKey
  );

  /*
    Find the NEW Circle transaction
    created after executePayout.
  */
  for (
    let attempt = 0;
    attempt < 30;
    attempt++
  ) {
    await new Promise(
      (resolve) =>
        setTimeout(resolve, 3000)
    );

    const txRes =
      await fetch(
        `${API_BASE}/api/circle/transactions`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            circleUserToken
          })
        }
      );

    const txData =
      await txRes.json();

    if (!txRes.ok) {
      continue;
    }

    const transactions =
      txData?.data
        ?.transactions ||
      [];

    const transaction =
      transactions.find(
        (item) => {
          const transactionId =
            String(
              item?.id || ""
            );

          const state =
            String(
              item?.state ||
              item?.status ||
              ""
            ).toUpperCase();

          const walletId =
            String(
              item?.walletId || ""
            );

          const hash =
            item?.blockchainTxHash ||
            item?.txHash ||
            item?.transactionHash ||
            "";

          return (
            transactionId &&
            !existingTransactionIds.has(
              transactionId
            ) &&
            walletId ===
              String(
                circleWallet.walletId
              ) &&
            state === "COMPLETE" &&
            String(hash).startsWith(
              "0x"
            )
          );
        }
      );

    payoutHash =
      transaction
        ?.blockchainTxHash ||
      transaction?.txHash ||
      transaction
        ?.transactionHash ||
      "";

    if (payoutHash) {
      break;
    }
  }

  if (!payoutHash) {
    throw new Error(
      "Circle payout was authorized, but the Arc transaction is still confirming."
    );
  }
}

const verifyRes =
  await fetch(
    `${API_BASE}/api/payouts/${id}/verify`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
  workspaceId:
    currentWorkspace.id,

  txHash:
    payoutHash,

  payerAddress:
    payerAddress,

  walletType:
    activeWallet.type,

  circleUserToken:
    activeWallet.type === "circle"
      ? circleUserToken
      : null,

  circleWalletId:
    activeWallet.type === "circle"
      ? circleWallet.walletId
      : null
})
    }
  );

const verifyData =
  await verifyRes.json();

if (!verifyRes.ok) {
  throw new Error(
    verifyData?.error ||
    "Failed to verify payout."
  );
}

await loadPayouts();

    /*
      Keep result temporarily.
      Backend on-chain confirmation is next.
    */
    window.pendingPayoutPayment = {
      id,
      payoutId,
      workspaceId:
        currentWorkspace.id,
      payerAddress:
        payerAddress,
      recipient:
        payout.recipient,
      amount:
        payout.amount,
      amountUnits:
        payout.amountUnits,
      approveTxHash:
        approveHash,
      txHash:
        payoutHash
    };

    console.log(
      "TRORPayout transaction:",
      window.pendingPayoutPayment
    );

    alert(
      "Payout transaction confirmed on Arc."
    );

  } catch (err) {
    console.error(
      "Payout execution error:",
      err
    );

    alert(
      err?.message ||
      "Payout execution failed."
    );
  }
}

  useEffect(() => {
  function reloadWorkspacePayouts() {
    setPayouts([]);
    loadPayouts();
  }

  function applyAIPayoutDraft(event) {
    let draft =
      event?.detail ||
      null;

    if (!draft) {
      try {
        draft =
          JSON.parse(
            localStorage.getItem(
              "pendingAIPayoutDraft"
            ) || "null"
          );
      } catch {
        draft = null;
      }
    }

    if (!draft) {
      return;
    }

    setRecipient(
      draft.recipient || ""
    );

    setAmount(
      draft.amount !== null &&
      draft.amount !== undefined
        ? String(draft.amount)
        : ""
    );

    setMode(
      draft.mode === "scheduled"
        ? "scheduled"
        : "now"
    );

    setFrequency(
      draft.frequency ||
      "once"
    );

    if (
      draft.mode ===
      "scheduled"
    ) {
      const value =
        String(
          draft.scheduledAt || ""
        );

      setScheduledAt(
        value
          ? value.slice(0, 16)
          : ""
      );
    } else {
      setScheduledAt("");
    }

    localStorage.removeItem(
      "pendingAIPayoutDraft"
    );
  }

  reloadWorkspacePayouts();

  window.addEventListener(
    "workspaceChanged",
    reloadWorkspacePayouts
  );

  window.addEventListener(
    "aiPayoutDraftReady",
    applyAIPayoutDraft
  );

  applyAIPayoutDraft();

  return () => {
    window.removeEventListener(
      "workspaceChanged",
      reloadWorkspacePayouts
    );

    window.removeEventListener(
      "aiPayoutDraftReady",
      applyAIPayoutDraft
    );
  };
}, []);

  return (
    <section className="card">
      <h2>Payouts</h2>

      <button
        type="button"
        onClick={loadPayouts}
        disabled={loading}
      >
        {loading ? "Loading..." : "Refresh"}
      </button>

      <div style={{ margin: "20px 0" }}>
        <input
          type="text"
          placeholder="Recipient Wallet"
          value={recipient}
          onChange={(event) =>
            setRecipient(event.target.value)
          }
        />

        <br />
        <br />

        <input
          type="number"
          min="0"
          step="0.000001"
          placeholder="Amount (USDC)"
          value={amount}
          onChange={(event) =>
            setAmount(event.target.value)
          }
        />

        <br />
        <br />

        <select
  value={mode}
  onChange={(event) => {
    const nextMode = event.target.value;

    setMode(nextMode);
    setFrequency("once");

    if (nextMode === "now") {
      setScheduledAt("");
    }
  }}
>
          <option value="now">
            Pay Now
          </option>

          <option value="scheduled">
            Scheduled
          </option>
        </select>

        <br />
        <br />

        <select
  value="once"
  disabled
>
  <option value="once">
    Once
  </option>
</select>

{mode === "scheduled" && (
  <>
    <br />
    <br />

    <label>
      Scheduled date and time
    </label>

    <br />

    <input
      type="datetime-local"
      value={scheduledAt}
      min={new Date(
        Date.now() - new Date().getTimezoneOffset() * 60000
      )
        .toISOString()
        .slice(0, 16)}
      onChange={(event) =>
        setScheduledAt(event.target.value)
      }
    />
  </>
)}

        <br />
        <br />

        <button
          type="button"
          onClick={createPayout}
        >
          Create Payout
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        {payouts.length === 0 &&
          !loading && (
            <div>No payouts yet.</div>
          )}

        {payouts.map((payout) => (
          <div
            key={payout.id}
            className="card"
            style={{ marginBottom: 10 }}
          >
            <div>
              <b>{payout.amount} USDC</b>
            </div>

            <div>
              Recipient: {payout.recipient}
            </div>

            <div>
              Status: {payout.status}
            </div>

            <div>
              Mode: {payout.mode || "now"}
            </div>

            <div>
              Frequency:{" "}
              {payout.frequency || "once"}
            </div>

{payout.next_run_at && (
  <div>
    Scheduled for:{" "}
    {new Date(
      payout.next_run_at
    ).toLocaleString()}
  </div>
)}

            {payout.tx_hash && (
              <div>
                TX:{" "}
                <a
                  href={`https://testnet.arcscan.app/tx/${payout.tx_hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View TX
                </a>
              </div>
            )}

            {payout.status === "PENDING" &&
            (
              payout.mode === "now" ||
              !payout.mode
            ) ? (
              <button
                type="button"
                onClick={() =>
                  confirmPayout(payout.id)
                }
              >
                ⚡ Pay Now
              </button>
            ) : payout.status === "PENDING" &&
              payout.mode === "scheduled" ? (
              <button
                type="button"
                onClick={() =>
                  approvePayout(payout.id)
                }
              >
                🗓 Approve Schedule
              </button>
            ) : payout.status === "REVIEW" ? (
              <button
                type="button"
                onClick={() =>
                  confirmPayout(payout.id)
                }
              >
                ✅ Confirm & Pay
              </button>
            ) : payout.status === "APPROVED" ? (
  <p>
    Waiting schedule ⏳
  </p>
) : payout.status === "READY_TO_SIGN" ? (
  <button
    type="button"
    onClick={() =>
      confirmPayout(payout.id)
    }
  >
    ⚡ Pay Scheduled Payout
  </button>
) : payout.status === "PAID" ? (
              <p>
                Paid ✅
              </p>
            ) : (
              <p>
                {payout.status}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}