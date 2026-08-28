import { useEffect, useState } from "react";
import {
  getAccount,
  writeContract,
  waitForTransactionReceipt
} from "@wagmi/core";
import {
  wagmiAdapter
} from "./appkit.js";
import { ethers } from "ethers";
import { W3SSdk } from "@circle-fin/w3s-pw-web-sdk";

const API_BASE = window.location.origin;

const ARC_CHAIN_ID = 5042002;

const USDC_ADDRESS =
  "0x3600000000000000000000000000000000000000";

const TROR_PAYROLL_CONTRACT_ADDRESS =
  "0xE92413d559aCed050ef10c62DC79AAc568F377F0";

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

const TROR_PAYROLL_ABI = [
  {
    type: "function",
    name: "executePayroll",
    stateMutability: "nonpayable",
    inputs: [
      {
        name: "payrollId",
        type: "bytes32"
      },
      {
        name: "recipients",
        type: "address[]"
      },
      {
        name: "amounts",
        type: "uint256[]"
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

function getCirclePayrollWallet() {
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

async function executeCirclePayrollChallenge(
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

if (
  !String(
    newPayroll.pay_date || ""
  ).trim()
) {
  alert(
    newPayroll.frequency === "monthly"
      ? "First pay date and time is required for monthly payroll."
      : "Pay date and time is required."
  );

  return;
}

const selectedPayDate =
  new Date(newPayroll.pay_date);

if (
  Number.isNaN(
    selectedPayDate.getTime()
  )
) {
  alert(
    "Please select a valid pay date and time."
  );

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
      pay_date: selectedPayDate.toISOString(),
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

    const circleWallet =
      getCirclePayrollWallet();

    if (!account?.address && !circleWallet) {
  alert(
    "Connect a Web3 wallet or Circle Wallet before executing payroll."
  );
  return;
}

    /*
      Payroll v1 runs on Arc Testnet.
    */
    if (
  account?.address &&
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

      const useWeb3 =
  Boolean(account?.address);

const payerAddress =
  useWeb3
    ? account.address
    : circleWallet.address;

const payerType =
  useWeb3
    ? "WEB3"
    : "CIRCLE";

const payerChainId =
  useWeb3
    ? account.chainId
    : ARC_CHAIN_ID;

    window.pendingPayrollPayment = {
  ...data,

  payerAddress,

  payerType,

  chainId:
    payerChainId,

  circleWalletId:
    !useWeb3
      ? circleWallet.walletId
      : null
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
        `Payer (${payerType}):\n${payerAddress}\n\n` +
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

    const recipients =
  data.items.map(
    (item) => item.recipient
  );

const amounts =
  data.items.map(
    (item) =>
      BigInt(item.amountUnits)
  );

const totalAmountUnits =
  amounts.reduce(
    (sum, amount) =>
      sum + amount,
    0n
  );

const payrollId =
  ethers.keccak256(
    ethers.toUtf8Bytes(
      `tror-payroll-${batchId}`
    )
  );

let approveHash = "";
let payrollHash = "";

if (useWeb3) {
  alert(
    "Step 1/2: Approve USDC for TRORPayroll."
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
          TROR_PAYROLL_CONTRACT_ADDRESS,
          totalAmountUnits
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
    "Step 2/2: Confirm payroll execution in your wallet."
  );

  payrollHash =
    await writeContract(
      wagmiAdapter.wagmiConfig,
      {
        address:
          TROR_PAYROLL_CONTRACT_ADDRESS,

        abi:
          TROR_PAYROLL_ABI,

        functionName:
          "executePayroll",

        args: [
          payrollId,
          recipients,
          amounts
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
          payrollHash
      }
    );

  if (
    !receipt ||
    receipt.status !== "success"
  ) {
    throw new Error(
      "Payroll transaction failed."
    );
  }
} else {
  if (
    typeof window.getCircleAuth !==
    "function"
  ) {
    throw new Error(
      "Circle authentication is not available."
    );
  }

  const {
    userToken,
    encryptionKey
  } =
    await window.getCircleAuth();

  if (
    !userToken ||
    !encryptionKey
  ) {
    throw new Error(
      "Missing Circle authentication."
    );
  }

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
          userToken,

          walletId:
            circleWallet.walletId,

          contractAddress:
            USDC_ADDRESS,

          abiFunctionSignature:
            "approve(address,uint256)",

          abiParameters: [
            TROR_PAYROLL_CONTRACT_ADDRESS,
            totalAmountUnits.toString()
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

  await executeCirclePayrollChallenge(
    approveChallengeId,
    userToken,
    encryptionKey
  );

  await new Promise(
    (resolve) =>
      setTimeout(resolve, 6000)
  );

  alert(
    "Step 2/2: Confirm payroll execution in Circle Wallet."
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
          userToken,

          walletId:
            circleWallet.walletId,

          contractAddress:
            TROR_PAYROLL_CONTRACT_ADDRESS,

          abiFunctionSignature:
            "executePayroll(bytes32,address[],uint256[])",

          abiParameters: [
            payrollId,
            recipients,
            amounts.map(
              (amount) =>
                amount.toString()
            )
          ]
        })
      }
    );

  const executeData =
    await executeRes.json();

  if (!executeRes.ok) {
    throw new Error(
      executeData?.error ||
      "Circle payroll execution failed."
    );
  }

  const executeChallengeId =
    executeData?.data?.challengeId ||
    executeData?.challengeId;

  if (!executeChallengeId) {
    throw new Error(
      "Circle payroll challengeId was not returned."
    );
  }

  await executeCirclePayrollChallenge(
    executeChallengeId,
    userToken,
    encryptionKey
  );

  for (
    let i = 0;
    i < 20;
    i++
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
            userToken
          })
        }
      );

    const txData =
      await txRes.json();

    if (!txRes.ok) {
      continue;
    }

    const transactions =
      txData?.data?.transactions ||
      [];

console.log(
  "CIRCLE PAYROLL TRANSACTIONS:",
  transactions
);

    const tx =
      transactions.find(
        (item) => {
          const operation =
            String(
              item?.operation || ""
            ).toUpperCase();

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

          const hash =
            item?.blockchainTxHash ||
            item?.txHash ||
            item?.transactionHash ||
            "";

          return (
            operation ===
              "CONTRACT_EXECUTION" &&
            state ===
              "COMPLETE" &&
            contractAddress ===
              TROR_PAYROLL_CONTRACT_ADDRESS.toLowerCase() &&
            String(hash).startsWith(
              "0x"
            )
          );
        }
      );

    if (tx) {
      payrollHash =
        tx.blockchainTxHash ||
        tx.txHash ||
        tx.transactionHash ||
        "";

      break;
    }
  }

  if (
    !payrollHash ||
    !String(
      payrollHash
    ).startsWith("0x")
  ) {
    throw new Error(
      "Circle payroll was approved, but the Arc transaction hash was not found yet."
    );
  }
}

const confirmRes =
  await fetch(
    `${API_BASE}/api/payroll-batches/${batchId}/confirm`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        txHash:
          payrollHash,
        payerAddress:
          payerAddress
      })
    }
  );

const confirmData =
  await confirmRes.json();

if (!confirmRes.ok) {
  throw new Error(
    confirmData?.error ||
    "Failed to confirm payroll."
  );
}

await loadPayroll();
await loadPayrollBatches();

console.log(
  "TRORPayroll transaction:",
  {
    batchId,
    payrollId,
    payer:
      payerAddress,
    employeeCount:
      recipients.length,
    totalAmount:
      data.totalAmount,
    approveTxHash:
      approveHash,
    payrollTxHash:
      payrollHash
  }
);

alert(
  "Payroll transaction confirmed on Arc."
);

window.pendingPayrollPayment = {
  ...window.pendingPayrollPayment,
  payrollId,
  approveTxHash:
    approveHash,
  txHash:
    payrollHash
};

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

  function applyAIPayrollDraft(event) {
    let draft =
      event?.detail ||
      null;

    if (!draft) {
      try {
        draft =
          JSON.parse(
            localStorage.getItem(
              "pendingAIPayrollDraft"
            ) || "null"
          );
      } catch {
        draft = null;
      }
    }

    if (!draft) {
      return;
    }

    setNewPayroll((current) => ({
      ...current,

      title:
        draft.title ||
        "Monthly Payroll",

      frequency:
        draft.frequency ||
        "once"
    }));

    localStorage.removeItem(
      "pendingAIPayrollDraft"
    );

    loadActiveEmployees();
  }

  reloadWorkspacePayroll();

  window.addEventListener(
    "workspaceChanged",
    reloadWorkspacePayroll
  );

  window.addEventListener(
    "aiPayrollDraftReady",
    applyAIPayrollDraft
  );

  applyAIPayrollDraft();

  return () => {
    window.removeEventListener(
      "workspaceChanged",
      reloadWorkspacePayroll
    );

    window.removeEventListener(
      "aiPayrollDraftReady",
      applyAIPayrollDraft
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