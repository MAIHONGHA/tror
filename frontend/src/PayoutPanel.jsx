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

    setPayouts(Array.isArray(data) ? data : []);
  } catch (err) {
    alert(err.message || "Failed to load payouts");
    console.error(err);
  } finally {
    setLoading(false);
  }
}

  async function approvePayout(id) {
  if (!confirm("Approve scheduled payout?")) return;

  const currentWorkspace = getCurrentWorkspace();

  if (!currentWorkspace?.id) {
    alert("Please select a workspace first.");
    return;
  }

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
    alert(data.error || "Approve payout failed");
    return;
  }

  loadPayouts();
}

  async function confirmPayout(id) {
  if (!confirm("Confirm & send payout now?")) return;

  const currentWorkspace = getCurrentWorkspace();

  if (!currentWorkspace?.id) {
    alert("Please select a workspace first.");
    return;
  }

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
    alert(data.error || "Confirm payout failed");
    return;
  }

  loadPayouts();
}

  useEffect(() => {
  const reloadWorkspacePayouts = () => {
    setPayouts([]);
    loadPayouts();
  };

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

      <button onClick={loadPayouts}>
        {loading ? "Loading..." : "Refresh"}
      </button>

      <div style={{ marginTop: 12 }}>
        {payouts.length === 0 && !loading && (
  <div>No payouts yet.</div>
)}
        {payouts.map((p) => (
          <div key={p.id} className="card" style={{ marginBottom: 10 }}>
            <div><b>{p.amount} USDC</b></div>
            <div>Recipient: {p.recipient}</div>
            <div>Status: {p.status}</div>
            <div>Mode: {p.mode || "now"}</div>

            {p.tx_hash && (
              <div>
                TX:{" "}
                <a
                  href={`https://testnet.arcscan.app/tx/${p.tx_hash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View TX
                </a>
              </div>
            )}

            {p.status === "PENDING" && (p.mode === "now" || !p.mode) ? (
  <button onClick={() => confirmPayout(p.id)}>
    ⚡ Pay Now
  </button>
) : p.status === "PENDING" && p.mode === "scheduled" ? (
  <button onClick={() => approvePayout(p.id)}>
    🗓 Approve Schedule
  </button>
) : p.status === "REVIEW" ? (
  <button onClick={() => confirmPayout(p.id)}>
    ✅ Confirm & Pay
  </button>
) : p.status === "APPROVED" ? (
  <p style={{ color: "orange" }}>Waiting schedule ⏳</p>
) : p.status === "PAID" ? (
  <p style={{ color: "green" }}>Paid ✅</p>
) : (
  <p style={{ color: "red" }}>{p.status}</p>
)}
          </div>
        ))}
      </div>
    </section>
  );
}