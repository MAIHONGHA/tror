import { useEffect, useState } from "react";

import {
  getAccount
} from "@wagmi/core";

import {
  wagmiAdapter
} from "./appkit.js";

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

export default function PayrollPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [batches, setBatches] = useState([]);
  const [selectedBatchItems, setSelectedBatchItems] = useState([]);
  const [csvText, setCsvText] = useState("");
  const [employeesLoading, setEmployeesLoading] = useState(false);

  const [newPayroll, setNewPayroll] = useState({
  title: "Monthly Payroll",
  frequency: "monthly",
  pay_date: "",
  employees: [],
});

  async function loadPayroll() {
    setLoading(true);

    try {
      const currentWorkspace = getCurrentWorkspace();

if (!currentWorkspace?.id) {
  setItems([]);
  return;
}

const res = await fetch(
  `${API_BASE}/api/payroll-items?workspaceId=${encodeURIComponent(
    currentWorkspace.id
  )}`
);
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error(err);
      alert("Failed to load payroll");
    } finally {
      setLoading(false);
    }
  }

  async function loadPayrollBatches() {
  try {
    const currentWorkspace = getCurrentWorkspace();

    if (!currentWorkspace?.id) {
      setBatches([]);
      return;
    }

    const res = await fetch(
      `${API_BASE}/api/payroll-batches?workspaceId=${encodeURIComponent(
        currentWorkspace.id
      )}`
    );

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.error || "Failed to load payroll history"
      );
    }

    setBatches(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error("Load payroll batches error:", err);
    alert(err.message);
  }
}

async function loadActiveEmployees() {
  setEmployeesLoading(true);

  try {
    const currentWorkspace = getCurrentWorkspace();

if (!currentWorkspace?.id) {
  setNewPayroll((current) => ({
    ...current,
    employees: [],
  }));

  return;
}

const res = await fetch(
  `${API_BASE}/api/employees?workspaceId=${encodeURIComponent(
    currentWorkspace.id
  )}&status=ACTIVE`
);

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.error || "Failed to load active employees"
      );
    }

    const employees = Array.isArray(data)
      ? data.map((employee) => ({
          employee_id: employee.id,
          employee_name: employee.employee_name || "",
          employee_email: employee.employee_email || "",
          wallet: employee.wallet || "",
          base_salary: String(employee.base_salary || 0),
          overtime_hours: "0",
          overtime_rate: "0",
          allowance: "0",
          bonus: "0",
          deduction: "0",
        }))
      : [];

    setNewPayroll((current) => ({
      ...current,
      employees,
    }));
  } catch (err) {
    console.error("Load active employees error:", err);
    alert(err.message);
  } finally {
    setEmployeesLoading(false);
  }
}

function importEmployeesFromCsv() {
  const lines = csvText.trim().split("\n");

  const employees = lines.slice(1).map((line) => {
    const [employee_name, employee_email, wallet, base_salary, bonus] =
      line.split(",").map((v) => v.trim());

    return {
      employee_name,
      employee_email,
      wallet,
      base_salary: base_salary || "0",
      overtime_hours: "0",
      overtime_rate: "0",
      allowance: "0",
      bonus: bonus || "0",
      deduction: "0",
    };
  });

  setNewPayroll({
    ...newPayroll,
    employees,
  });

  alert(`Imported ${employees.length} employees ✅`);
}

async function createPayrollBatch() {

const currentWorkspace = getCurrentWorkspace();

if (!currentWorkspace?.id) {
  alert("Please select a workspace first.");
  return;
}

    if (newPayroll.employees.length === 0) {
    alert("No active employees available.");
    return;
  }

  const validEmployees = newPayroll.employees.filter(
  (employee) =>
    String(employee.employee_name || "").trim() &&
    String(employee.wallet || "").trim() &&
    Number(employee.base_salary || 0) > 0
);

const skippedEmployees = newPayroll.employees.filter(
  (employee) =>
    !String(employee.employee_name || "").trim() ||
    !String(employee.wallet || "").trim() ||
    Number(employee.base_salary || 0) <= 0
);

if (validEmployees.length === 0) {
  alert(
    "No eligible employees found. Each employee needs a name, wallet and base salary greater than 0."
  );
  return;
}

  const res = await fetch(`${API_BASE}/api/payroll-batches`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      workspaceId: currentWorkspace.id,
      title: newPayroll.title,
      frequency: newPayroll.frequency,
      pay_date: newPayroll.pay_date,
      employees: validEmployees.map((emp) => ({
  employee_name: emp.employee_name,
  employee_email: emp.employee_email,
  wallet: emp.wallet,
  base_salary: Number(emp.base_salary || 0),
  overtime_hours: Number(emp.overtime_hours || 0),
  overtime_rate: Number(emp.overtime_rate || 0),
  allowance: Number(emp.allowance || 0),
  bonus: Number(emp.bonus || 0),
  deduction: Number(emp.deduction || 0),
})),
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.error || "Create payroll failed");
    return;
  }

  if (skippedEmployees.length > 0) {
  const skippedNames = skippedEmployees
    .map(
      (employee) =>
        employee.employee_name || "Unnamed employee"
    )
    .join(", ");

  alert(
    `Payroll created for ${validEmployees.length} employee(s) ✅\n\n` +
    `${skippedEmployees.length} employee(s) skipped:\n${skippedNames}\n\n` +
    `Reason: missing name, wallet or valid base salary.`
  );
} else {
  alert(
    `Payroll created for ${validEmployees.length} employee(s) ✅`
  );
}

  loadPayroll();
  loadPayrollBatches();
}

async function viewBatchItems(batchId) {
  const currentWorkspace = getCurrentWorkspace();

  if (!currentWorkspace?.id) {
    alert("Please select a workspace first.");
    return;
  }

  const res = await fetch(
    `${API_BASE}/api/payroll-batches/${batchId}/items?workspaceId=${encodeURIComponent(
      currentWorkspace.id
    )}`
  );
  const data = await res.json();
  setSelectedBatchItems(data);
}

  async function approvePayroll(batchId) {
    if (!confirm("Approve this payroll batch?")) return;

    const res = await fetch(
      `${API_BASE}/api/payroll-batches/${batchId}/approve`,
      {
        method: "POST",
      }
    );

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Approve payroll failed");
      return;
    }

    alert("Payroll approved ✅");

    loadPayroll();
    loadPayrollBatches();
  }

  async function executePayroll(batchId) {
  try {
    /*
      1. Get the real connected Web3 wallet.
      Backend must never choose a payer wallet.
    */
    const account =
      getAccount(
        wagmiAdapter.wagmiConfig
      );

    if (!account?.address) {
      alert(
        "Connect your Web3 wallet before executing payroll."
      );
      return;
    }

    /*
      Payroll v1 runs on Arc Testnet.
    */
    if (
      Number(account.chainId) !==
      5042002
    ) {
      alert(
        "Switch your connected wallet to Arc Testnet before executing payroll."
      );
      return;
    }

    /*
      2. Ask backend only to PREPARE payroll data.
      Backend does not send USDC.
    */
    const res = await fetch(
      `${API_BASE}/api/payroll-batches/${batchId}/execute`,
      {
        method: "POST"
      }
    );

    const data =
      await res.json();

    if (!res.ok) {
      throw new Error(
        data?.error ||
        "Failed to prepare payroll payment."
      );
    }

    if (
      data?.mode !==
        "CONNECTED_WALLET" ||
      data?.requiresWalletSignature !==
        true
    ) {
      throw new Error(
        "Invalid payroll payment plan."
      );
    }

    if (
      !Array.isArray(data?.items) ||
      data.items.length === 0
    ) {
      throw new Error(
        "No payroll payment items were returned."
      );
    }

    /*
      3. Store the payment plan.

      This wallet is now explicitly
      the payroll payer.
    */
    window.pendingPayrollPayment = {
      ...data,

      payerAddress:
        account.address,

      payerType:
        "WEB3",

      chainId:
        account.chainId
    };

    console.log(
      "TROR payroll payment plan:",
      window.pendingPayrollPayment
    );

    /*
      Contract execution comes next.
      For now this proves that the backend
      no longer selects a private-key wallet.
    */
    const confirmed =
      confirm(
        `TROR Payroll\n\n` +
        `Payer:\n${account.address}\n\n` +
        `Employees: ${data.employeeCount}\n` +
        `Total: ${data.totalAmount} ${data.currency}\n\n` +
        `Network: ${data.network?.chainName || "Arc Testnet"}\n\n` +
        `Continue to wallet authorization?`
      );

    if (!confirmed) {
      window.pendingPayrollPayment =
        null;

      return;
    }

    alert(
      "Payroll is ready for wallet authorization.\n\n" +
      "The next step is TRORPayroll contract execution."
    );

  } catch (err) {
    console.error(
      "Prepare payroll payment error:",
      err
    );

    alert(
      err?.message ||
      "Failed to prepare payroll payment."
    );
  }
}

  async function unapprovePayroll(batchId) {
    if (!confirm("Move payroll back to DRAFT?")) return;

    const res = await fetch(
      `${API_BASE}/api/payroll-batches/${batchId}/unapprove`,
      {
        method: "POST",
      }
    );

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Unapprove payroll failed");
      return;
    }

    alert("Payroll moved back to DRAFT ✅");

    loadPayroll();
    loadPayrollBatches();
  }

  async function cancelPayroll(batchId) {
    if (!confirm("Cancel payroll batch?")) return;

    const res = await fetch(
      `${API_BASE}/api/payroll-batches/${batchId}/cancel`,
      {
        method: "POST",
      }
    );

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Cancel payroll failed");
      return;
    }

    alert("Payroll cancelled ❌");

    loadPayroll();
    loadPayrollBatches();
  }

  async function editPayrollItem(item) {
    const base_salary = prompt("Base salary:", item.base_salary);
    if (base_salary === null) return;

    const overtime_hours = prompt(
      "Overtime hours:",
      item.overtime_hours
    );
    if (overtime_hours === null) return;

    const overtime_rate = prompt(
      "Overtime rate:",
      item.overtime_rate
    );
    if (overtime_rate === null) return;

    const allowance = prompt("Allowance:", item.allowance);
    if (allowance === null) return;

    const bonus = prompt("Bonus:", item.bonus);
    if (bonus === null) return;

    const deduction = prompt("Deduction:", item.deduction);
    if (deduction === null) return;

    const res = await fetch(
      `${API_BASE}/api/payroll-items/${item.id}/update`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          base_salary,
          overtime_hours,
          overtime_rate,
          allowance,
          bonus,
          deduction,
        }),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Update payroll failed");
      return;
    }

    alert(`Payroll updated ✅ Final: ${data.finalAmount} USDC`);

    loadPayroll();
    loadPayrollBatches();
  }

  async function sendPayslip(item) {
    if (!confirm(`Send payslip to ${item.employee_email}?`)) return;

    const res = await fetch(
      `${API_BASE}/api/payroll-items/${item.id}/send-payslip`,
      {
        method: "POST",
      }
    );

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Send payslip failed");
      return;
    }

    alert("Payslip sent ✅");
  }

  useEffect(() => {
  const reloadWorkspacePayroll = () => {
    setItems([]);
    setBatches([]);
    setSelectedBatchItems([]);

    setNewPayroll((current) => ({
      ...current,
      employees: [],
    }));

    loadPayroll();
    loadPayrollBatches();
    loadActiveEmployees();
  };

  reloadWorkspacePayroll();

  window.addEventListener(
    "workspaceChanged",
    reloadWorkspacePayroll
  );

  return () => {
    window.removeEventListener(
      "workspaceChanged",
      reloadWorkspacePayroll
    );
  };
}, []);

  const total = items.reduce(
    (sum, item) => sum + Number(item.final_amount || 0),
    0
  );

  return (
    <>
<section className="glass-card">
  <h2>💼 Create Payroll</h2>

  <input
    placeholder="Payroll title"
    value={newPayroll.title}
    onChange={(e) =>
      setNewPayroll({ ...newPayroll, title: e.target.value })
    }
  />

  <select
    value={newPayroll.frequency}
    onChange={(e) =>
      setNewPayroll({ ...newPayroll, frequency: e.target.value })
    }
  >
    <option value="once">Once</option>
    <option value="monthly">Monthly</option>
  </select>

  <input
    type="datetime-local"
    value={newPayroll.pay_date}
    onChange={(e) =>
      setNewPayroll({ ...newPayroll, pay_date: e.target.value })
    }
  />

  <div style={{ marginBottom: 16 }}>
  <div
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      flexWrap: "wrap",
      marginBottom: 12,
    }}
  >
    <h3 style={{ margin: 0 }}>
      Active Employees ({newPayroll.employees.length})
    </h3>

    <button
      type="button"
      onClick={loadActiveEmployees}
      disabled={employeesLoading}
    >
      {employeesLoading
        ? "Loading Employees..."
        : "Reload Active Employees"}
    </button>
  </div>

  {newPayroll.employees.length === 0 ? (
    <div className="card">
      No active employees found. Add or activate an employee
      in Employee Management first.
    </div>
  ) : (
    newPayroll.employees.map((emp, index) => (
      <div
        key={emp.employee_id || index}
        className="card"
        style={{ marginBottom: 12 }}
      >
        <b>{emp.employee_name}</b>

        <div>Email: {emp.employee_email || "-"}</div>
        <div>Wallet: {emp.wallet || "-"}</div>

        <label>Base salary USDC</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={emp.base_salary}
          onChange={(e) => {
            const updated = [...newPayroll.employees];

            updated[index] = {
              ...updated[index],
              base_salary: e.target.value,
            };

            setNewPayroll({
              ...newPayroll,
              employees: updated,
            });
          }}
        />

        <label>Overtime hours</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={emp.overtime_hours}
          onChange={(e) => {
            const updated = [...newPayroll.employees];

            updated[index] = {
              ...updated[index],
              overtime_hours: e.target.value,
            };

            setNewPayroll({
              ...newPayroll,
              employees: updated,
            });
          }}
        />

        <label>Overtime rate</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={emp.overtime_rate}
          onChange={(e) => {
            const updated = [...newPayroll.employees];

            updated[index] = {
              ...updated[index],
              overtime_rate: e.target.value,
            };

            setNewPayroll({
              ...newPayroll,
              employees: updated,
            });
          }}
        />

        <label>Allowance</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={emp.allowance}
          onChange={(e) => {
            const updated = [...newPayroll.employees];

            updated[index] = {
              ...updated[index],
              allowance: e.target.value,
            };

            setNewPayroll({
              ...newPayroll,
              employees: updated,
            });
          }}
        />

        <label>Bonus</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={emp.bonus}
          onChange={(e) => {
            const updated = [...newPayroll.employees];

            updated[index] = {
              ...updated[index],
              bonus: e.target.value,
            };

            setNewPayroll({
              ...newPayroll,
              employees: updated,
            });
          }}
        />

        <label>Deduction</label>
        <input
          type="number"
          min="0"
          step="0.01"
          value={emp.deduction}
          onChange={(e) => {
            const updated = [...newPayroll.employees];

            updated[index] = {
              ...updated[index],
              deduction: e.target.value,
            };

            setNewPayroll({
              ...newPayroll,
              employees: updated,
            });
          }}
        />
        <div
  style={{
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    background: "rgba(15, 23, 42, 0.65)",
    fontWeight: 700,
  }}
>
  Final Amount:{" "}
  {(
    Number(emp.base_salary || 0) +
    Number(emp.overtime_hours || 0) *
      Number(emp.overtime_rate || 0) +
    Number(emp.allowance || 0) +
    Number(emp.bonus || 0) -
    Number(emp.deduction || 0)
  ).toFixed(2)}{" "}
  USDC
</div>
      </div>
    ))
  )}
</div>

<div
  style={{
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    background: "rgba(59,130,246,0.12)",
    border: "1px solid rgba(96,165,250,0.25)",
    fontWeight: 800
  }}
>
  Payroll Total:{" "}
  {newPayroll.employees
    .reduce((sum, emp) => {
      return (
        sum +
        Number(emp.base_salary || 0) +
        Number(emp.overtime_hours || 0) *
          Number(emp.overtime_rate || 0) +
        Number(emp.allowance || 0) +
        Number(emp.bonus || 0) -
        Number(emp.deduction || 0)
      );
    }, 0)
    .toFixed(2)}{" "}
  USDC
</div>

<h3>Import Employees CSV</h3>

<textarea
  placeholder={`employee_name,email,wallet,base_salary,bonus
Mai,mai@test.com,0xabc...,100,10
An,an@test.com,0xdef...,80,0`}
  value={csvText}
  onChange={(e) => setCsvText(e.target.value)}
/>

<button onClick={importEmployeesFromCsv}>
  Import CSV
</button>

  <button onClick={createPayrollBatch}>
    Create Payroll
  </button>
</section>

      <section className="card">
  <h2>Payroll</h2>

  <button onClick={loadPayroll}>
    {loading ? "Loading..." : "Refresh Payroll"}
  </button>

  <h3>Total Payroll: {total} USDC</h3>

{items[0]?.batch_id && (
  <div style={{ marginBottom: 12 }}>
    {items[0].status === "DRAFT" && (
      <>
        <button
          onClick={() => approvePayroll(items[0].batch_id)}
        >
          Approve Payroll
        </button>

        <button
          onClick={() => cancelPayroll(items[0].batch_id)}
          style={{ marginLeft: 8 }}
        >
          Cancel Payroll
        </button>
      </>
    )}

    {(items[0]?.status === "APPROVED" ||
      items[0]?.status === "REVIEW") && (
      <>
        <button
          onClick={() => executePayroll(items[0].batch_id)}
        >
          {items[0]?.status === "REVIEW"
            ? "Execute Reviewed Payroll"
            : "Execute Payroll"}
        </button>

        <button
          onClick={() => unapprovePayroll(items[0].batch_id)}
          style={{ marginLeft: 8 }}
        >
          Unapprove Payroll
        </button>

        <button
          onClick={() => cancelPayroll(items[0].batch_id)}
          style={{ marginLeft: 8 }}
        >
          Cancel Payroll
        </button>
      </>
    )}

    {items[0]?.status === "PAID" && (
      <b>Payroll Paid ✅</b>
    )}

    {items[0]?.status === "CANCELLED" && (
      <b>Payroll Cancelled ❌</b>
    )}
  </div>
)}

{items.map((item) => (
  <div
    key={item.id}
    className="card"
    style={{ marginBottom: 10 }}
  >
    <b>{item.employee_name}</b>

    <div>Email: {item.employee_email}</div>
    <div>Wallet: {item.wallet}</div>

    <div>Base Salary: {item.base_salary} USDC</div>

    <div>
      Overtime: {item.overtime_hours}h × {item.overtime_rate}
    </div>

    <div>Allowance: {item.allowance} USDC</div>
    <div>Bonus: {item.bonus} USDC</div>
    <div>Deduction: {item.deduction} USDC</div>

    <hr />

    <b>Final Amount: {Number(item.final_amount || 0).toFixed(2)} USDC</b>

    <div>Status: {item.status}</div>

    <button
      onClick={() => sendPayslip(item)}
      style={{ marginLeft: 8 }}
    >
      📧 Email Payslip
    </button>

    {item.status !== "PAID" && (
      <button onClick={() => editPayrollItem(item)}>
        Edit
      </button>
    )}

    {item.tx_hash && (
      <div>
        TX:{" "}
        <a
          href={`https://testnet.arcscan.app/tx/${item.tx_hash}`}
          target="_blank"
          rel="noreferrer"
        >
          View TX
        </a>
      </div>
    )}
  </div>
))}
</section>

<section className="card">
  <h2>Payroll History</h2>

  <button onClick={loadPayrollBatches}>
    Refresh History
  </button>

  {batches.map((batch) => (
    <div
      key={batch.id}
      className="card"
      style={{ marginBottom: 10 }}
    >
      <b>{batch.title}</b>

      <div>Status: {batch.status}</div>
      <div>Frequency: {batch.frequency}</div>
      <div>Pay Date: {batch.pay_date}</div>
      <div>Total: {batch.total_amount} USDC</div>
      <div>Employees: {batch.employee_count}</div>

      <button onClick={() => viewBatchItems(batch.id)}>
        View Items
      </button>
    </div>
  ))}
</section>

{selectedBatchItems.length > 0 && (
  <div className="card">
    <h3>Selected Batch Items</h3>

    {selectedBatchItems.map((item) => (
      <div
        key={item.id}
        className="card"
        style={{ marginBottom: 10 }}
      >
        <b>{item.employee_name}</b>
        <div>Email: {item.employee_email}</div>
        <div>Final: {item.final_amount} USDC</div>
        <div>Status: {item.status}</div>
      </div>
    ))}
  </div>
)}
</>
);
}