import { useEffect, useState } from "react";

import {
  getAccount,
  writeContract,
  waitForTransactionReceipt
} from "@wagmi/core";

import { ethers } from "ethers";

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

    if (!account?.address) {
      alert(
        "Connect your Web3 wallet before sending payout."
      );
      return;
    }

    if (
      Number(account.chainId) !==
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

    const confirmed =
      window.confirm(
        `TROR Payout\n\n` +
        `Payer:\n${account.address}\n\n` +
        `Recipient:\n${payout.recipient}\n\n` +
        `Amount: ${payout.amount} USDC\n\n` +
        `Network: ${data.network?.chainName || "Arc Testnet"}\n\n` +
        `Continue to wallet authorization?`
      );

    if (!confirmed) {
      return;
    }

    /*
      Step 1:
      Approve only this payout amount.
    */
    alert(
      "Step 1/2: Approve USDC for TRORPayout."
    );

    const approveHash =
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

    /*
      Step 2:
      Execute the real payout.
    */
    alert(
      "Step 2/2: Confirm payout execution in your wallet."
    );

    const payoutHash =
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
          account.address
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
        account.address,
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

    reloadWorkspacePayouts();

    window.addEventListener(
      "workspaceChanged",
      reloadWorkspacePayouts
    );

    return () => {
      window.removeEventListener(
        "workspaceChanged",
        reloadWorkspacePayouts
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