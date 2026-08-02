import { useEffect, useState } from "react";

const API_BASE = window.location.origin;

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
    const shouldConfirm = window.confirm(
      "Confirm and send payout now?"
    );

    if (!shouldConfirm) {
      return;
    }

    const currentWorkspace = getCurrentWorkspace();

    if (!currentWorkspace?.id) {
      alert("Please select a workspace first.");
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}/api/payouts/${id}/confirm`,
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
          data.error || "Confirm payout failed"
        );
      }

      await loadPayouts();
    } catch (err) {
      console.error("Confirm payout error:", err);

      alert(
        err.message || "Confirm payout failed"
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