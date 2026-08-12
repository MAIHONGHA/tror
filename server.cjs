require("dotenv").config();
const PDFDocument = require("pdfkit");
const express = require("express");
const OpenAI = require("openai");
const path = require("path");
const cors = require("cors");
const crypto = require("crypto");
const Database = require("better-sqlite3");
const { ethers } = require("ethers");
const cron = require("node-cron");
const { Resend } = require("resend");
const { Web3 } = require("web3");
const ARC_MEMO_ADDRESS = "0x5294E9927c3306DcBaDb03fe70b92e01cCede505";
const CLAIM_CONTRACT_ADDRESS =
  process.env.CLAIM_CONTRACT_ADDRESS ||
  "0xc90F1016E868EAf0A4af3d741D9304420d189213";

const CLAIM_CONTRACT_ABI = [
  "function claimToWallet(uint256 claimId, address receiver) external"
];
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const app = express();
const PORT = Number(process.env.PORT || 3000);
const resend = new Resend(process.env.RESEND_API_KEY);

/* =========================
   AI CONFIG
========================= */
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/* =========================
   CONFIG
========================= */

const GOOGLE_CLIENT_ID = String(process.env.GOOGLE_CLIENT_ID || "");
const CIRCLE_APP_ID = String(process.env.CIRCLE_APP_ID || "");

const CIRCLE_API_KEY = String(
  process.env.CIRCLE_API_KEY ||
    process.env.CIRCLE_API_KEY ||
    ""
);

const ARC_CHAIN_ID = Number(process.env.ARC_CHAIN_ID || 5042002);
const ARC_CHAIN_ID_HEX = String(process.env.ARC_CHAIN_ID_HEX || "0x4cef52");
const ARC_CHAIN_NAME = String(process.env.ARC_CHAIN_NAME || "Arc Testnet");
const ARC_RPC_URL = String(
  process.env.ARC_RPC_URL || "https://rpc.testnet.arc.network"
);
const provider = new ethers.JsonRpcProvider(ARC_RPC_URL);
const PAYOUT_PRIVATE_KEY = process.env.PAYOUT_PRIVATE_KEY || "";
const payoutWallet = PAYOUT_PRIVATE_KEY
  ? new ethers.Wallet(PAYOUT_PRIVATE_KEY, provider)
  : null;

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "event Transfer(address indexed from, address indexed to, uint256 value)"
];

const ARC_EXPLORER_URL = String(
  process.env.ARC_EXPLORER_URL || "https://testnet.arcscan.app"
);

const USDC_ADDRESS = String(
  process.env.USDC_ADDRESS || "0x3600000000000000000000000000000000000000"
);
const USDC_DECIMALS = Number(process.env.USDC_DECIMALS || 6);

const CLAIM_USDC_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)"
];

const MERCHANT_ADDRESS = String(
  process.env.CIRCLE_WALLET_ADDRESS ||
    process.env.MERCHANT_ADDRESS ||
    "0xa59615ffe6cabcdcbcff586c75efd12d2f7dd9f6"
).trim();

/* =========================
   DATABASE
========================= */

const db = new Database(path.join(__dirname, "data.db"));
db.pragma("journal_mode = WAL");

db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT,
    account_type TEXT NOT NULL DEFAULT 'PERSONAL',
    primary_wallet_address TEXT,
    circle_user_id TEXT,
    circle_wallet_id TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    workspace_type TEXT NOT NULL,
    workspace_name TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS workspace_members (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'OWNER',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    invited_by_user_id TEXT,
    joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(workspace_id, user_id)
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS business_profiles (
    workspace_id TEXT PRIMARY KEY,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    wallet TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// payouts table
db.prepare(`
  CREATE TABLE IF NOT EXISTS payouts (
    id TEXT PRIMARY KEY,
    recipient TEXT,
    amount REAL,
    status TEXT,
    tx_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();
try {
  db.prepare(`ALTER TABLE payouts ADD COLUMN mode TEXT DEFAULT 'now'`).run();
} catch {}
try {
  db.prepare(`
    ALTER TABLE payouts
    ADD COLUMN frequency TEXT DEFAULT 'once'
  `).run();
} catch {}

try {
  db.prepare(`
    ALTER TABLE payouts
    ADD COLUMN next_run_at DATETIME
  `).run();
} catch {}

try {
  db.prepare(`
    ALTER TABLE payouts
    ADD COLUMN payroll_item_id TEXT
  `).run();
} catch {}

try {
  db.prepare(`
    ALTER TABLE payouts
    ADD COLUMN workspace_id TEXT
  `).run();

  console.log("workspace_id added to payouts");
} catch {
  console.log("payouts workspace_id already exists");
}

db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_payouts_workspace_id
  ON payouts(workspace_id)
`).run();

db.prepare(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_payouts_payroll_item
  ON payouts(payroll_item_id)
  WHERE payroll_item_id IS NOT NULL
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    amount REAL NOT NULL,
    recipientAddress TEXT NOT NULL,
    targetChain TEXT NOT NULL,
    note TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'CREATED',
    txHash TEXT,
    fromAddress TEXT,
    createdAt TEXT NOT NULL,
    paidAt TEXT,
    reminder_sent INTEGER DEFAULT 0,
    dueDate TEXT
  )
`).run();

try {
  db.prepare(`
    ALTER TABLE invoices
    ADD COLUMN onchainId INTEGER
  `).run();
} catch {}

try {

  db.prepare(`
    ALTER TABLE invoices
    ADD COLUMN dueDate TEXT
  `).run();

} catch {}

try {
  db.prepare(`
    ALTER TABLE invoices
    ADD COLUMN reminder_sent INTEGER DEFAULT 0
  `).run();

  console.log("✅ reminder_sent column added");
} catch (err) {
  console.log("reminder_sent already exists");
}

try {
  db.prepare(`
    ALTER TABLE invoices
    ADD COLUMN recipientEmail TEXT
  `).run();

  console.log("recipientEmail column added");
} catch {
  console.log("recipientEmail already exists");
}

try {
  db.prepare(`
    ALTER TABLE invoices
    ADD COLUMN paymentMemo TEXT
  `).run();

  console.log("paymentMemo column added");
} catch {
  console.log("paymentMemo already exists");
}

try {
  db.prepare(`
    ALTER TABLE invoices
    ADD COLUMN workspace_id TEXT
  `).run();

  console.log("workspace_id added to invoices");
} catch {
  console.log("invoice workspace_id already exists");
}

db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_invoices_workspace_id
  ON invoices(workspace_id)
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    recipientEmail TEXT NOT NULL,
    amount REAL NOT NULL,
    message TEXT,
    status TEXT DEFAULT 'PENDING',
    walletAddress TEXT,
    createdAt TEXT,
    claimedAt TEXT
  )
`).run();

try {
  db.prepare(`
    ALTER TABLE claims
    ADD COLUMN workspace_id TEXT
  `).run();

  console.log("workspace_id added to claims");
} catch {
  console.log("claim workspace_id already exists");
}

db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_claims_workspace_id
  ON claims(workspace_id)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS withdrawals (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    email TEXT,
    amount REAL,
    country TEXT,
    bank_name TEXT,
    account_holder TEXT,
    account_number TEXT,
    claim_id TEXT,
    status TEXT,
    created_at TEXT
)
`).run();

try {
  db.prepare(`
    ALTER TABLE withdrawals
    ADD COLUMN workspace_id TEXT
  `).run();
} catch {}

db.prepare(`
CREATE INDEX IF NOT EXISTS idx_withdrawals_workspace_id
ON withdrawals(workspace_id)
`).run();

// employees master table
db.prepare(`
  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY,
    employee_name TEXT NOT NULL,
    employee_email TEXT,
    wallet TEXT,
    base_salary REAL DEFAULT 0,
    employment_status TEXT DEFAULT 'ACTIVE',
    started_at TEXT,
    ended_at TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

try {
  db.prepare(`
    ALTER TABLE employees
    ADD COLUMN workspace_id TEXT
  `).run();

  console.log("workspace_id added to employees");
} catch {
  console.log("employee workspace_id already exists");
}

db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_employees_workspace_id
  ON employees(workspace_id)
`).run();

db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_employees_status
  ON employees(employment_status)
`).run();

// payroll batches
db.prepare(`
  CREATE TABLE IF NOT EXISTS payroll_batches (
    id TEXT PRIMARY KEY,
    title TEXT,
    pay_date DATETIME,
    status TEXT DEFAULT 'DRAFT',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

// payroll items
db.prepare(`
  CREATE TABLE IF NOT EXISTS payroll_items (
    id TEXT PRIMARY KEY,
    batch_id TEXT,
    employee_name TEXT,
    employee_email TEXT,
    wallet TEXT,
    base_salary REAL DEFAULT 0,
    overtime_hours REAL DEFAULT 0,
    overtime_rate REAL DEFAULT 0,
    allowance REAL DEFAULT 0,
    bonus REAL DEFAULT 0,
    deduction REAL DEFAULT 0,
    final_amount REAL DEFAULT 0,
    status TEXT DEFAULT 'DRAFT',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`).run();

try {
  db.prepare(`
    ALTER TABLE payroll_batches
    ADD COLUMN workspace_id TEXT
  `).run();

  console.log("workspace_id added to payroll_batches");
} catch {
  console.log("payroll_batches workspace_id already exists");
}

try {
  db.prepare(`
    ALTER TABLE payroll_items
    ADD COLUMN workspace_id TEXT
  `).run();

  console.log("workspace_id added to payroll_items");
} catch {
  console.log("payroll_items workspace_id already exists");
}

try {
  db.prepare(`
    ALTER TABLE payroll_items
    ADD COLUMN employee_id TEXT
  `).run();

  console.log("employee_id added to payroll_items");
} catch {
  console.log("payroll_items employee_id already exists");
}

db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_payroll_batches_workspace_id
  ON payroll_batches(workspace_id)
`).run();

db.prepare(`
  CREATE INDEX IF NOT EXISTS idx_payroll_items_workspace_id
  ON payroll_items(workspace_id)
`).run();

try {
  db.prepare(`
    ALTER TABLE payroll_items
    ADD COLUMN tx_hash TEXT
  `).run();
} catch {}

try {
  db.prepare("ALTER TABLE claims ADD COLUMN txHash TEXT").run();
} catch {}

try {
  db.prepare(`
    ALTER TABLE withdrawals
    ADD COLUMN claim_id TEXT
  `).run();
} catch {}

try {
  db.prepare(`
    ALTER TABLE withdrawals
    ADD COLUMN reviewed_at TEXT
  `).run();
} catch {}

try {
  db.prepare(`
    ALTER TABLE withdrawals
    ADD COLUMN approved_at TEXT
  `).run();
} catch {}

try {
  db.prepare(`
    ALTER TABLE withdrawals
    ADD COLUMN completed_at TEXT
  `).run();
} catch {}

try {
  db.prepare(`
    ALTER TABLE withdrawals
    ADD COLUMN rejected_at TEXT
  `).run();
} catch {}

db.prepare(`
  CREATE UNIQUE INDEX IF NOT EXISTS idx_withdrawals_claim_id
  ON withdrawals(claim_id)
  WHERE claim_id IS NOT NULL
`).run();

try {
  db.prepare(`
    ALTER TABLE payroll_batches
    ADD COLUMN frequency TEXT DEFAULT 'once'
  `).run();
} catch {}

try {
  db.prepare(
    "ALTER TABLE payroll_batches ADD COLUMN auto_execute INTEGER DEFAULT 0"
  ).run();
  console.log("✅ Added auto_execute column");
} catch (e) {}

try {
  db.prepare(
    "ALTER TABLE payroll_batches ADD COLUMN requires_approval INTEGER DEFAULT 1"
  ).run();
  console.log("✅ Added requires_approval column");
} catch (e) {}

/* =========================
   MIDDLEWARE
========================= */

app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================
   USERS
========================= */

app.get("/api/users/:wallet", (req, res) => {
  try {
    const wallet = String(req.params.wallet || "")
      .trim()
      .toLowerCase();

    const user = db.prepare(`
      SELECT *
      FROM users
      WHERE lower(primary_wallet_address)=?
    `).get(wallet);

    if (!user) {
      return res.status(404).json({
        exists: false
      });
    }

    res.json({
      exists: true,
      user
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: "Failed to load user"
    });
  }
});

app.post("/api/users", (req, res) => {
  try {
    const fullName = String(req.body.fullName || "").trim();
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();

    const accountType = String(
      req.body.accountType || "PERSONAL"
    )
      .trim()
      .toUpperCase();

    const walletAddress = String(
      req.body.walletAddress || ""
    )
      .trim()
      .toLowerCase();

    const circleUserId = String(
      req.body.circleUserId || ""
    ).trim();

    const circleWalletId = String(
      req.body.circleWalletId || ""
    ).trim();

    if (!fullName) {
      return res.status(400).json({
        success: false,
        error: "Full name is required"
      });
    }

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: "Wallet address is required"
      });
    }

    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: "Invalid wallet address"
      });
    }

    const allowedAccountTypes = [
      "PERSONAL",
      "BUSINESS"
    ];

    if (!allowedAccountTypes.includes(accountType)) {
      return res.status(400).json({
        success: false,
        error: "Invalid account type"
      });
    }

    const existingUser = db.prepare(`
      SELECT *
      FROM users
      WHERE lower(primary_wallet_address) = ?
    `).get(walletAddress);

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: "User profile already exists",
        user: existingUser
      });
    }

    const userId = crypto.randomUUID();
    const workspaceId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const now = new Date().toISOString();

    const createProfile = db.transaction(() => {
      db.prepare(`
        INSERT INTO users (
          id,
          full_name,
          email,
          account_type,
          primary_wallet_address,
          circle_user_id,
          circle_wallet_id,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        fullName,
        email || null,
        accountType,
        walletAddress,
        circleUserId || null,
        circleWalletId || null,
        now,
        now
      );

      db.prepare(`
        INSERT INTO workspaces (
          id,
          workspace_type,
          workspace_name,
          owner_user_id,
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        workspaceId,
        accountType,
        accountType === "BUSINESS"
          ? `${fullName}'s Business`
          : `${fullName}'s Workspace`,
        userId,
        "ACTIVE",
        now,
        now
      );

      db.prepare(`
        INSERT INTO workspace_members (
          id,
          workspace_id,
          user_id,
          role,
          status,
          invited_by_user_id,
          joined_at,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        memberId,
        workspaceId,
        userId,
        "OWNER",
        "ACTIVE",
        null,
        now,
        now
      );
    });

    createProfile();

    const user = db.prepare(`
      SELECT *
      FROM users
      WHERE id = ?
    `).get(userId);

    const workspace = db.prepare(`
      SELECT *
      FROM workspaces
      WHERE id = ?
    `).get(workspaceId);

    return res.status(201).json({
      success: true,
      user,
      workspace
    });
  } catch (err) {
    console.error("Create user profile error:", err);

    return res.status(500).json({
      success: false,
      error: "Failed to create user profile",
      details: err.message
    });
  }
});

/* =========================
   WORKSPACES
========================= */

// Get all workspaces belonging to a wallet
app.get("/api/workspaces/:wallet", (req, res) => {
  try {
    const walletAddress = String(
      req.params.wallet || ""
    )
      .trim()
      .toLowerCase();

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: "Wallet address is required"
      });
    }

    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: "Invalid wallet address"
      });
    }

    const user = db.prepare(`
      SELECT *
      FROM users
      WHERE lower(primary_wallet_address) = ?
    `).get(walletAddress);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User profile not found",
        workspaces: []
      });
    }

    const workspaces = db.prepare(`
      SELECT
        w.*,
        wm.role,
        wm.status AS member_status,
        wm.joined_at
      FROM workspaces w
      INNER JOIN workspace_members wm
        ON wm.workspace_id = w.id
      WHERE wm.user_id = ?
        AND wm.status = 'ACTIVE'
        AND w.status = 'ACTIVE'
      ORDER BY w.created_at ASC
    `).all(user.id);

    return res.json({
      success: true,
      userId: user.id,
      workspaces
    });
  } catch (err) {
    console.error("Load workspaces error:", err);

    return res.status(500).json({
      success: false,
      error: "Failed to load workspaces",
      details: err.message
    });
  }
});

app.post("/api/workspaces", (req, res) => {
  try {
    const walletAddress = String(
      req.body.walletAddress || ""
    )
      .trim()
      .toLowerCase();

    const workspaceName = String(
      req.body.workspaceName || ""
    ).trim();

    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: "Wallet address is required"
      });
    }

    if (!ethers.isAddress(walletAddress)) {
      return res.status(400).json({
        success: false,
        error: "Invalid wallet address"
      });
    }

    if (!workspaceName) {
      return res.status(400).json({
        success: false,
        error: "Workspace name is required"
      });
    }

    const user = db.prepare(`
      SELECT *
      FROM users
      WHERE lower(primary_wallet_address) = ?
    `).get(walletAddress);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User profile not found"
      });
    }

    const duplicate = db.prepare(`
      SELECT *
      FROM workspaces
      WHERE owner_user_id = ?
        AND lower(workspace_name) = lower(?)
        AND status = 'ACTIVE'
    `).get(user.id, workspaceName);

    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: "Workspace name already exists"
      });
    }

    const workspaceId = crypto.randomUUID();
    const memberId = crypto.randomUUID();
    const now = new Date().toISOString();

    const createWorkspace = db.transaction(() => {
      db.prepare(`
        INSERT INTO workspaces (
          id,
          workspace_type,
          workspace_name,
          owner_user_id,
          status,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        workspaceId,
        "BUSINESS",
        workspaceName,
        user.id,
        "ACTIVE",
        now,
        now
      );

      db.prepare(`
        INSERT INTO workspace_members (
          id,
          workspace_id,
          user_id,
          role,
          status,
          invited_by_user_id,
          joined_at,
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        memberId,
        workspaceId,
        user.id,
        "OWNER",
        "ACTIVE",
        null,
        now,
        now
      );
    });

    createWorkspace();

    const workspace = db.prepare(`
      SELECT
        w.*,
        wm.role,
        wm.status AS member_status,
        wm.joined_at
      FROM workspaces w
      INNER JOIN workspace_members wm
        ON wm.workspace_id = w.id
      WHERE w.id = ?
        AND wm.user_id = ?
    `).get(workspaceId, user.id);

    return res.status(201).json({
      success: true,
      workspace
    });
  } catch (err) {
    console.error("Create workspace error:", err);

    return res.status(500).json({
      success: false,
      error: "Failed to create workspace",
      details: err.message
    });
  }
});

app.get("/api/business-profile", (req, res) => {
  try {
    const workspaceId = String(
      req.query.workspaceId || ""
    ).trim();

    if (!workspaceId) {
      return res.status(400).json({
        error: "Workspace is required"
      });
    }

    const workspace = db.prepare(`
      SELECT id
      FROM workspaces
      WHERE id = ?
        AND status = 'ACTIVE'
    `).get(workspaceId);

    if (!workspace) {
      return res.status(404).json({
        error: "Workspace not found"
      });
    }

    const profile = db.prepare(`
      SELECT
        workspace_id AS workspaceId,
        name,
        email,
        wallet,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM business_profiles
      WHERE workspace_id = ?
    `).get(workspaceId);

    return res.json({
      profile: profile || null
    });
  } catch (err) {
    console.error(
      "Load business profile error:",
      err
    );

    return res.status(500).json({
      error: "Failed to load business profile"
    });
  }
});

app.post("/api/business-profile", (req, res) => {
  try {
    const workspaceId = String(
      req.body.workspaceId || ""
    ).trim();

    const name = String(
      req.body.name || ""
    ).trim();

    const email = String(
      req.body.email || ""
    )
      .trim()
      .toLowerCase();

    const wallet = String(
      req.body.wallet || ""
    ).trim();

    if (!workspaceId) {
      return res.status(400).json({
        error: "Workspace is required"
      });
    }

    if (!name) {
      return res.status(400).json({
        error: "Business name is required"
      });
    }

    if (wallet && !ethers.isAddress(wallet)) {
      return res.status(400).json({
        error: "Invalid merchant wallet address"
      });
    }

    const workspace = db.prepare(`
      SELECT id
      FROM workspaces
      WHERE id = ?
        AND status = 'ACTIVE'
    `).get(workspaceId);

    if (!workspace) {
      return res.status(404).json({
        error: "Workspace not found"
      });
    }

    db.prepare(`
      INSERT INTO business_profiles (
        workspace_id,
        name,
        email,
        wallet,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)

      ON CONFLICT(workspace_id)
      DO UPDATE SET
        name = excluded.name,
        email = excluded.email,
        wallet = excluded.wallet,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      workspaceId,
      name,
      email,
      wallet
    );

    const profile = db.prepare(`
      SELECT
        workspace_id AS workspaceId,
        name,
        email,
        wallet,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM business_profiles
      WHERE workspace_id = ?
    `).get(workspaceId);

    return res.json({
      success: true,
      message: "Business profile saved.",
      profile
    });
  } catch (err) {
    console.error(
      "Save business profile error:",
      err
    );

    return res.status(500).json({
      error: "Failed to save business profile"
    });
  }
});

/* =========================
   EMPLOYEES
========================= */

// Get employee list by workspace
app.get("/api/employees", (req, res) => {
  try {
    const status = String(req.query.status || "")
      .trim()
      .toUpperCase();

    const workspaceId = String(
      req.query.workspaceId || ""
    ).trim();

    const allowedStatuses = [
      "ACTIVE",
      "INACTIVE",
      "TERMINATED"
    ];

    if (!workspaceId) {
      return res.status(400).json({
        error: "Workspace is required",
        employees: []
      });
    }

    const workspace = db.prepare(`
      SELECT id
      FROM workspaces
      WHERE id = ?
        AND status = 'ACTIVE'
    `).get(workspaceId);

    if (!workspace) {
      return res.status(404).json({
        error: "Workspace not found",
        employees: []
      });
    }

    let rows;

    if (
      status &&
      allowedStatuses.includes(status)
    ) {
      rows = db.prepare(`
        SELECT *
        FROM employees
        WHERE workspace_id = ?
          AND employment_status = ?
        ORDER BY created_at DESC
      `).all(
        workspaceId,
        status
      );
    } else {
      rows = db.prepare(`
        SELECT *
        FROM employees
        WHERE workspace_id = ?
        ORDER BY created_at DESC
      `).all(workspaceId);
    }

    return res.json(rows);
  } catch (err) {
    console.error(
      "Load employees error:",
      err
    );

    return res.status(500).json({
      error: "Failed to load employees",
      employees: []
    });
  }
});

// Create a new employee
app.post("/api/employees", (req, res) => {
  try {
    const {
      employeeName,
      employeeEmail,
      wallet,
      baseSalary,
      startedAt,
      workspaceId
    } = req.body;

    const name = String(employeeName || "").trim();
    const email = String(employeeEmail || "")
      .trim()
      .toLowerCase();

    const walletAddress = String(wallet || "").trim();
    const salary = Number(baseSalary || 0);
    const startDate =
      startedAt || new Date().toISOString();

    if (!name) {
      return res.status(400).json({
        error: "Employee name is required"
      });
    }

    if (!Number.isFinite(salary) || salary < 0) {
      return res.status(400).json({
        error: "Invalid base salary"
      });
    }

if (!workspaceId) {
  return res.status(400).json({
    error: "Workspace is required"
  });
}

const workspace = db.prepare(`
  SELECT id
  FROM workspaces
  WHERE id = ?
    AND status = 'ACTIVE'
`).get(workspaceId);

if (!workspace) {
  return res.status(404).json({
    error: "Workspace not found"
  });
}

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO employees (
        id,
        employee_name,
        employee_email,
        wallet,
        base_salary,
        employment_status,
        started_at,
        ended_at,
        created_at,
        updated_at,
        workspace_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      email || null,
      walletAddress || null,
      salary,
      "ACTIVE",
      startDate,
      null,
      now,
      now,
      workspaceId
    );

    const employee = db.prepare(`
      SELECT *
      FROM employees
      WHERE id = ?
    `).get(id);

    res.status(201).json({
      success: true,
      employee
    });
  } catch (err) {
    console.error("Create employee error:", err);

    res.status(500).json({
      error: "Failed to create employee"
    });
  }
});

// Update employee employment status
app.post("/api/employees/:id/status", (req, res) => {
  try {
    const { id } = req.params;

    const status = String(req.body.status || "")
      .trim()
      .toUpperCase();

    const allowedStatuses = [
      "ACTIVE",
      "INACTIVE",
      "TERMINATED"
    ];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        error: "Invalid employee status"
      });
    }

    const employee = db.prepare(`
      SELECT *
      FROM employees
      WHERE id = ?
    `).get(id);

    if (!employee) {
      return res.status(404).json({
        error: "Employee not found"
      });
    }

    const now = new Date().toISOString();

    const endedAt =
      status === "TERMINATED"
        ? now
        : null;

    db.prepare(`
      UPDATE employees
      SET employment_status = ?,
          ended_at = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      status,
      endedAt,
      now,
      id
    );

    const updatedEmployee = db.prepare(`
      SELECT *
      FROM employees
      WHERE id = ?
    `).get(id);

    res.json({
      success: true,
      employee: updatedEmployee
    });
  } catch (err) {
    console.error("Update employee status error:", err);

    res.status(500).json({
      error: "Failed to update employee status"
    });
  }
});

app.get("/api/payroll-batches", (req, res) => {
  try {
    const workspaceId = String(
      req.query.workspaceId || ""
    ).trim();

    if (!workspaceId) {
      return res.status(400).json({
        error: "Workspace is required"
      });
    }

    const rows = db.prepare(`
      SELECT
        b.*,
        COALESCE(SUM(i.final_amount), 0) AS total_amount,
        COUNT(i.id) AS employee_count
      FROM payroll_batches b
      LEFT JOIN payroll_items i
        ON i.batch_id = b.id
        AND i.workspace_id = b.workspace_id
      WHERE b.workspace_id = ?
      GROUP BY b.id
      ORDER BY b.created_at DESC
    `).all(workspaceId);

    return res.json(rows);
  } catch (err) {
    console.error("Load payroll batches error:", err);

    return res.status(500).json({
      error: "Failed to load payroll batches"
    });
  }
});

app.get("/api/payroll-items", (req, res) => {
  try {
    const workspaceId = String(
      req.query.workspaceId || ""
    ).trim();

    if (!workspaceId) {
      return res.status(400).json({
        error: "Workspace is required"
      });
    }

    const latestBatch = db.prepare(`
      SELECT b.*
      FROM payroll_batches b
      WHERE b.workspace_id = ?
        AND EXISTS (
          SELECT 1
          FROM payroll_items i
          WHERE i.batch_id = b.id
            AND i.workspace_id = ?
        )
      ORDER BY b.created_at DESC
      LIMIT 1
    `).get(workspaceId, workspaceId);

    if (!latestBatch) {
      return res.json([]);
    }

    const rows = db.prepare(`
      SELECT *
      FROM payroll_items
      WHERE batch_id = ?
        AND workspace_id = ?
      ORDER BY created_at DESC
    `).all(latestBatch.id, workspaceId);

    return res.json(rows);
  } catch (err) {
    console.error("Load payroll items error:", err);

    return res.status(500).json({
      error: "Failed to load payroll items"
    });
  }
});

app.get("/api/payroll-batches/:id/items", (req, res) => {
  try {
    const { id } = req.params;

    const workspaceId = String(
      req.query.workspaceId || ""
    ).trim();

    if (!workspaceId) {
      return res.status(400).json({
        error: "Workspace is required"
      });
    }

    const batch = db.prepare(`
      SELECT id
      FROM payroll_batches
      WHERE id = ?
        AND workspace_id = ?
    `).get(id, workspaceId);

    if (!batch) {
      return res.status(404).json({
        error: "Payroll batch not found"
      });
    }

    const items = db.prepare(`
      SELECT *
      FROM payroll_items
      WHERE batch_id = ?
        AND workspace_id = ?
      ORDER BY created_at DESC
    `).all(id, workspaceId);

    return res.json(items);
  } catch (err) {
    console.error("Load payroll batch items error:", err);

    return res.status(500).json({
      error: "Failed to load payroll batch items"
    });
  }
});

app.get("/api/payroll-items/:id/payslip.pdf", (req, res) => {
  try {
    const item = db.prepare(`
      SELECT 
        pi.*,
        pb.title as batch_title,
        pb.pay_date,
        pb.frequency
      FROM payroll_items pi
      LEFT JOIN payroll_batches pb ON pi.batch_id = pb.id
      WHERE pi.id = ?
    `).get(req.params.id);

    if (!item) {
      return res.status(404).json({ error: "Payroll item not found" });
    }

    const doc = new PDFDocument({ margin: 50 });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="TROR-Payslip-${item.employee_name || item.id}.pdf"`
    );

    doc.pipe(res);

    doc.fontSize(26).text("TROR Payroll Payslip", { align: "center" });

doc.moveDown();

doc.fontSize(11).fillColor("gray").text(`Payslip ID: PAY-${item.id}`);
doc.text(`Generated by TROR`);
doc.fillColor("black");

doc.moveDown();

doc.fontSize(14).text("Employee Information", { underline: true });
doc.moveDown(0.5);
doc.fontSize(12).text(`Employee Name: ${item.employee_name}`);
doc.text(`Employee Email: ${item.employee_email}`);
doc.text(`Wallet: ${item.wallet}`);

doc.moveDown();

doc.fontSize(14).text("Payroll Information", { underline: true });
doc.moveDown(0.5);
doc.fontSize(12).text(`Payroll: ${batch.title}`);
doc.text(`Payroll Period: ${new Date(batch.pay_date).toLocaleDateString("en-US", {
  month: "long",
  year: "numeric"
})}`);
doc.text(`Pay Date: ${new Date(batch.pay_date).toISOString().slice(0, 10)}`);
doc.text(`Frequency: ${batch.frequency}`);
doc.text(`Status: ${batch.status}`);

doc.moveDown();

doc.fontSize(14).text("Earnings", { underline: true });
doc.moveDown(0.5);
doc.fontSize(12).text(`Base Salary: ${item.base_salary || 0} USDC`);
doc.text(`Overtime: ${(item.overtime_hours || 0) * (item.overtime_rate || 0)} USDC`);
doc.text(`Allowance: ${item.allowance || 0} USDC`);
doc.text(`Bonus: ${item.bonus || 0} USDC`);

doc.moveDown();

doc.fontSize(14).text("Deductions", { underline: true });
doc.moveDown(0.5);
doc.fontSize(12).text(`Deduction: ${item.deduction || 0} USDC`);

doc.moveDown();

doc.fontSize(18).fillColor("#111827").text(`Net Salary: ${item.final_amount} USDC`);

doc.moveDown();

doc.fontSize(14).fillColor("black").text("Payment Details", { underline: true });
doc.moveDown(0.5);
doc.fontSize(12).text(`Payment Status: PAID`);
doc.text(`Payment Date: ${new Date().toISOString().slice(0, 10)}`);
doc.text(`Transaction Hash: ${payoutResult.txHash}`);

doc.moveDown(2);

doc.fontSize(10)
  .fillColor("gray")
  .text("This payslip was generated automatically by TROR.", { align: "center" });

    doc.end();
  } catch (err) {
    console.error("Payslip PDF error:", err);
    res.status(500).json({ error: "Failed to generate payslip PDF" });
  }
});

app.post("/api/payroll-items/:id/email-payslip", async (req, res) => {
  // Send payslip via email
});

app.post("/api/payroll-batches/:id/approve", (req, res) => {
  const { id } = req.params;

  const batch = db.prepare(`
    SELECT * FROM payroll_batches
    WHERE id = ?
  `).get(id);

  if (!batch) {
    return res.status(404).json({ error: "Payroll batch not found" });
  }

  db.prepare(`
    UPDATE payroll_batches
    SET status = 'APPROVED'
    WHERE id = ?
  `).run(id);

  db.prepare(`
    UPDATE payroll_items
    SET status = 'APPROVED'
    WHERE batch_id = ?
  `).run(id);

  res.json({
    success: true,
    message: "Payroll batch approved",
    batchId: id
  });
});

app.post("/api/payroll-batches/:id/unapprove", (req, res) => {
  const { id } = req.params;

  db.prepare(`
    UPDATE payroll_batches
    SET status = 'DRAFT'
    WHERE id = ?
  `).run(id);

  db.prepare(`
    UPDATE payroll_items
    SET status = 'DRAFT'
    WHERE batch_id = ?
    AND status != 'PAID'
  `).run(id);

  res.json({
    success: true,
    message: "Payroll batch moved back to DRAFT"
  });
});

app.post("/api/payroll-batches/:id/cancel", (req, res) => {
  const { id } = req.params;

  db.prepare(`
    UPDATE payroll_batches
    SET status = 'CANCELLED'
    WHERE id = ?
    AND status != 'PAID'
  `).run(id);

  db.prepare(`
    UPDATE payroll_items
    SET status = 'CANCELLED'
    WHERE batch_id = ?
    AND status != 'PAID'
  `).run(id);

  res.json({
    success: true,
    message: "Payroll batch cancelled"
  });
});

    app.post("/api/payroll-batches/:id/execute", async (req, res) => {
  try {
    const { id } = req.params;

    const batch = db.prepare(`
      SELECT *
      FROM payroll_batches
      WHERE id = ?
    `).get(id);

    if (!batch) {
      return res.status(404).json({
        error: "Payroll batch not found"
      });
    }

    if (!["APPROVED", "REVIEW"].includes(batch.status)) {
      return res.status(400).json({
        error: "Only APPROVED or REVIEW payroll batch can be executed"
      });
    }

    const items = db.prepare(`
      SELECT *
      FROM payroll_items
      WHERE batch_id = ?
    `).all(id);

    if (!items.length) {
      return res.status(404).json({
        error: "No payroll items found"
      });
    }

    const results = [];

    for (const item of items) {
  if (item.status === "PAID") {
    results.push({
      employee: item.employee_name,
      amount: item.final_amount,
      status: "PAID",
      skipped: true,
      txHash: item.tx_hash || null
    });

    continue;
  }

  if (!["APPROVED", "REVIEW", "FAILED"].includes(item.status)) {
    results.push({
      employee: item.employee_name,
      amount: item.final_amount,
      status: item.status,
      skipped: true
    });

    continue;
  }

  try {
    if (!ethers.isAddress(item.wallet)) {
      throw new Error(
        `Invalid employee wallet for ${item.employee_name}`
      );
    }

    if (
      !Number.isFinite(Number(item.final_amount)) ||
      Number(item.final_amount) <= 0
    ) {
      throw new Error(
        `Invalid payroll amount for ${item.employee_name}`
      );
    }

    db.prepare(`
      UPDATE payroll_items
      SET status = 'PROCESSING'
      WHERE id = ?
    `).run(item.id);

    let payout = db.prepare(`
      SELECT *
      FROM payouts
      WHERE payroll_item_id = ?
      LIMIT 1
    `).get(item.id);

    if (!payout) {
      const payoutId = crypto.randomUUID();

      db.prepare(`
        INSERT INTO payouts (
          id,
          recipient,
          amount,
          status,
          mode,
          frequency,
          payroll_item_id,
          workspace_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        payoutId,
        item.wallet,
        item.final_amount,
        "APPROVED",
        "payroll",
        "once",
        item.id,
        batch.workspace_id
      );

      payout = db.prepare(`
        SELECT *
        FROM payouts
        WHERE id = ?
      `).get(payoutId);
    }

    const payoutResult = await executePayoutById(payout.id);

    const txHash =
      payoutResult.txHash ||
      payoutResult.payout?.tx_hash ||
      payout.tx_hash ||
      null;

    db.prepare(`
      UPDATE payroll_items
      SET status = 'PAID',
          tx_hash = ?
      WHERE id = ?
    `).run(txHash, item.id);

    results.push({
      employee: item.employee_name,
      amount: item.final_amount,
      status: "PAID",
      txHash
    });
  } catch (itemErr) {
  const errorMessage =
    itemErr?.error?.message ||
    itemErr?.shortMessage ||
    itemErr?.message ||
    "Unknown payroll item error";

  const isRpcRateLimit =
    String(errorMessage)
      .toLowerCase()
      .includes("request limit reached") ||
    itemErr?.error?.code === -32011 ||
    itemErr?.code === -32011;

  console.error(
    isRpcRateLimit
      ? "PAYROLL RPC RATE LIMITED:"
      : "PAYROLL ITEM FAILED:",
    item.employee_name,
    itemErr
  );

  const nextItemStatus = isRpcRateLimit
    ? "REVIEW"
    : "FAILED";

  db.prepare(`
    UPDATE payroll_items
    SET status = ?
    WHERE id = ?
      AND status != 'PAID'
  `).run(
    nextItemStatus,
    item.id
  );

  results.push({
    employee: item.employee_name,
    amount: item.final_amount,
    status: nextItemStatus,
    retryable: isRpcRateLimit,
    error: errorMessage
  });

  continue;
}
}

    const summary = db.prepare(`
  SELECT
    COUNT(*) AS total_count,
    SUM(CASE WHEN status = 'PAID' THEN 1 ELSE 0 END) AS paid_count,
    SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) AS failed_count,
    SUM(CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END) AS processing_count
  FROM payroll_items
  WHERE batch_id = ?
`).get(id);

const nextBatchStatus =
  summary.total_count > 0 &&
  summary.paid_count === summary.total_count
    ? "PAID"
    : summary.failed_count > 0
      ? "REVIEW"
      : "APPROVED";

db.prepare(`
  UPDATE payroll_batches
  SET status = ?
  WHERE id = ?
`).run(nextBatchStatus, id);

    return res.json({
  success: true,
  payrollBatch: id,
  batchStatus: nextBatchStatus,
  summary: {
    total: Number(summary.total_count || 0),
    paid: Number(summary.paid_count || 0),
    failed: Number(summary.failed_count || 0),
    processing: Number(summary.processing_count || 0)
  },
  results
});
  } catch (err) {
    console.error("PAYROLL EXECUTE ERROR:", err);

    return res.status(500).json({
      success: false,
      error: "Payroll execution failed",
      details:
        err?.error?.message ||
        err?.shortMessage ||
        err?.message ||
        "Unknown error"
    });
  }
}); 

app.post("/api/payroll-items/:id/update", (req, res) => {
  const { id } = req.params;

  const item = db.prepare(`
    SELECT * FROM payroll_items
    WHERE id = ?
  `).get(id);

  if (!item) {
    return res.status(404).json({ error: "Payroll item not found" });
  }

  if (item.status === "PAID") {
    return res.status(400).json({
      error: "Cannot edit paid payroll item"
    });
  }

  const base = Number(req.body.base_salary || 0);
  const overtimeHours = Number(req.body.overtime_hours || 0);
  const overtimeRate = Number(req.body.overtime_rate || 0);
  const allowance = Number(req.body.allowance || 0);
  const bonus = Number(req.body.bonus || 0);
  const deduction = Number(req.body.deduction || 0);

  const finalAmount = Number(
  (
    Number(baseSalary || 0) +
    Number(overtimeHours || 0) * Number(overtimeRate || 0) +
    Number(allowance || 0) +
    Number(bonus || 0) -
    Number(deduction || 0)
  ).toFixed(6)
);

  db.prepare(`
    UPDATE payroll_items
    SET base_salary = ?,
        overtime_hours = ?,
        overtime_rate = ?,
        allowance = ?,
        bonus = ?,
        deduction = ?,
        final_amount = ?,
        status = 'DRAFT'
    WHERE id = ?
  `).run(
    base,
    overtimeHours,
    overtimeRate,
    allowance,
    bonus,
    deduction,
    finalAmount,
    id
  );

  db.prepare(`
    UPDATE payroll_batches
    SET status = 'DRAFT'
    WHERE id = ?
  `).run(item.batch_id);

  res.json({
    success: true,
    message: "Payroll item updated",
    finalAmount
  });
});

app.post("/api/payroll-items/:id/send-payslip", async (req, res) => {
  try {
    const { id } = req.params;

    const item = db.prepare(`
      SELECT 
        pi.*,
        pb.title AS batch_title,
        pb.pay_date,
        pb.frequency
      FROM payroll_items pi
      LEFT JOIN payroll_batches pb ON pi.batch_id = pb.id
      WHERE pi.id = ?
    `).get(id);

    if (!item) {
      return res.status(404).json({ error: "Payroll item not found" });
    }

    if (!item.employee_email) {
      return res.status(400).json({ error: "Missing employee email" });
    }

    const doc = new PDFDocument({ margin: 50 });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));

    const pdfBufferPromise = new Promise((resolve, reject) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
    });

    doc.fontSize(22).text("TROR Payslip", { align: "center" });
    doc.moveDown();

    doc.fontSize(12).text(`Payroll: ${item.batch_title || "-"}`);
    doc.text(`Pay Date: ${item.pay_date || "-"}`);
    doc.text(`Frequency: ${item.frequency || "-"}`);
    doc.text(`Status: ${item.status || "-"}`);
    doc.moveDown();

    doc.text(`Employee Name: ${item.employee_name || "-"}`);
    doc.text(`Employee Email: ${item.employee_email || "-"}`);
    doc.text(`Wallet: ${item.wallet || "-"}`);
    doc.moveDown();

    doc.text(`Base Salary: ${item.base_salary || 0} USDC`);
    doc.text(`Overtime: ${(item.overtime_hours || 0) * (item.overtime_rate || 0)} USDC`);
    doc.text(`Allowance: ${item.allowance || 0} USDC`);
    doc.text(`Bonus: ${item.bonus || 0} USDC`);
    doc.text(`Deduction: ${item.deduction || 0} USDC`);
    doc.moveDown();

    doc.fontSize(16).text(`Final Amount: ${item.final_amount || 0} USDC`);
    doc.moveDown();

    if (item.tx_hash) {
      doc.fontSize(10).text(`Tx Hash: ${item.tx_hash}`);
    }

    doc.moveDown();
    doc.fontSize(10).text("Generated by TROR", { align: "center" });

    doc.end();

    const pdfBuffer = await pdfBufferPromise;

    await resend.emails.send({
      from: "TROR <no-reply@mail.tror.app>",
      to: [item.employee_email],
      subject: `TROR Payslip - ${item.final_amount || 0} USDC`,
      html: `
        <h2>TROR Payslip</h2>
        <p>Hello ${item.employee_name || "there"},</p>
        <p>Your payslip is attached as a PDF.</p>
        <ul>
          <li>Payroll: ${item.batch_title || "-"}</li>
          <li>Status: ${item.status || "-"}</li>
          <li>Final amount: <b>${item.final_amount || 0} USDC</b></li>
        </ul>
        ${item.tx_hash ? `
          <p>
            <a href="https://testnet.arcscan.app/tx/${item.tx_hash}">
              View transaction
            </a>
          </p>
        ` : ""}
      `,
      attachments: [
        {
          filename: `TROR-Payslip-${item.employee_name || item.id}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    res.json({
      success: true,
      message: `Payslip PDF sent to ${item.employee_email}`,
    });
  } catch (err) {
    console.error("Send payslip email error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/payroll-batches", (req, res) => {
  try {
    const batchId = crypto.randomUUID();

    const {
      workspaceId,
      title = "Payroll Batch",
      pay_date,
      frequency = "once",
      employees = []
    } = req.body;

    const normalizedWorkspaceId = String(
      workspaceId || ""
    ).trim();

    if (!normalizedWorkspaceId) {
      return res.status(400).json({
        error: "Workspace is required"
      });
    }

    const workspace = db.prepare(`
      SELECT id
      FROM workspaces
      WHERE id = ?
        AND status = 'ACTIVE'
    `).get(normalizedWorkspaceId);

    if (!workspace) {
      return res.status(404).json({
        error: "Workspace not found"
      });
    }

    if (
      !Array.isArray(employees) ||
      employees.length === 0
    ) {
      return res.status(400).json({
        error:
          "Cannot create a payroll batch without employees"
      });
    }

    const createPayroll = db.transaction(() => {
      db.prepare(`
        INSERT INTO payroll_batches (
          id,
          title,
          pay_date,
          status,
          frequency,
          workspace_id
        )
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        batchId,
        title,
        pay_date || new Date().toISOString(),
        "DRAFT",
        frequency,
        normalizedWorkspaceId
      );

      for (const emp of employees) {
        const base = Number(emp.base_salary || 0);
        const overtimeHours =
          Number(emp.overtime_hours || 0);
        const overtimeRate =
          Number(emp.overtime_rate || 0);
        const allowance =
          Number(emp.allowance || 0);
        const bonus =
          Number(emp.bonus || 0);
        const deduction =
          Number(emp.deduction || 0);

        const finalAmount = Number(
          (
            base +
            overtimeHours * overtimeRate +
            allowance +
            bonus -
            deduction
          ).toFixed(6)
        );

        db.prepare(`
          INSERT INTO payroll_items (
            id,
            batch_id,
            employee_id,
            employee_name,
            employee_email,
            wallet,
            base_salary,
            overtime_hours,
            overtime_rate,
            allowance,
            bonus,
            deduction,
            final_amount,
            status,
            workspace_id
          )
          VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?
          )
        `).run(
          crypto.randomUUID(),
          batchId,
          emp.employee_id || null,
          emp.employee_name,
          emp.employee_email || null,
          emp.wallet,
          base,
          overtimeHours,
          overtimeRate,
          allowance,
          bonus,
          deduction,
          finalAmount,
          "DRAFT",
          normalizedWorkspaceId
        );
      }
    });

    createPayroll();

    return res.status(201).json({
      success: true,
      batchId,
      workspaceId: normalizedWorkspaceId,
      count: employees.length
    });
  } catch (err) {
    console.error("Create payroll batch error:", err);

    return res.status(500).json({
      error: "Failed to create payroll batch",
      details: err.message
    });
  }
});

app.post("/api/payouts", (req, res) => {
  try {
    const {
      recipient,
      amount,
      workspaceId,
      mode = "now",
      frequency = "once",
      nextRunAt = null
    } = req.body;

    const normalizedWorkspaceId = String(
      workspaceId || ""
    ).trim();

    if (!normalizedWorkspaceId) {
      return res.status(400).json({
        error: "Workspace is required"
      });
    }

    const workspace = db.prepare(`
      SELECT id
      FROM workspaces
      WHERE id = ?
        AND status = 'ACTIVE'
    `).get(normalizedWorkspaceId);

    if (!workspace) {
      return res.status(404).json({
        error: "Workspace not found"
      });
    }

    if (!recipient || !amount) {
      return res.status(400).json({
        error: "Missing recipient or amount"
      });
    }

    if (!ethers.isAddress(recipient)) {
      return res.status(400).json({
        error: "Invalid recipient wallet"
      });
    }

    const numericAmount = Number(amount);

    if (
      !Number.isFinite(numericAmount) ||
      numericAmount <= 0
    ) {
      return res.status(400).json({
        error: "Invalid payout amount"
      });
    }

    const id = crypto.randomUUID();

    db.prepare(`
      INSERT INTO payouts (
        id,
        recipient,
        amount,
        status,
        mode,
        frequency,
        next_run_at,
        workspace_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      recipient,
      numericAmount,
      "PENDING",
      mode,
      frequency,
      nextRunAt,
      normalizedWorkspaceId
    );

    const payout = db.prepare(`
      SELECT *
      FROM payouts
      WHERE id = ?
        AND workspace_id = ?
    `).get(id, normalizedWorkspaceId);

    return res.status(201).json(payout);
  } catch (err) {
    console.error("Create payout error:", err);

    return res.status(500).json({
      error: "Failed to create payout",
      details: err.message
    });
  }
});

app.get("/api/payouts", (req, res) => {
  try {
    const workspaceId = String(
      req.query.workspaceId || ""
    ).trim();

    if (!workspaceId) {
      return res.status(400).json({
        error: "Workspace is required"
      });
    }

    const rows = db.prepare(`
      SELECT *
      FROM payouts
      WHERE workspace_id = ?
      ORDER BY created_at DESC
    `).all(workspaceId);

    return res.json(rows);
  } catch (err) {
    console.error("Load payouts error:", err);

    return res.status(500).json({
      error: "Failed to load payouts"
    });
  }
});

app.get("/test-payout", (req, res) => {
  const id = crypto.randomUUID();

  db.prepare(`
  INSERT INTO payouts (
  id,
  recipient,
  amount,
  status,
  mode,
 frequency,
  next_run_at
)
VALUES (?, ?, ?, ?, ?, ?, ?)
`).run(
  id,
  "0x09C960a7d011D1bb9241B69F9CDaD9c9BcE6175d",
  1,
  "PENDING",
  "scheduled",
  "monthly",
  new Date(Date.now() + 60000).toISOString()
);

  res.json({ message: "Test payout created", id });
});

app.get("/test-payroll", (req, res) => {
  const batchId = crypto.randomUUID();

  db.prepare(`
    INSERT INTO payroll_batches (
      id,
      title,
      pay_date,
      status
    )
    VALUES (?, ?, datetime('now'), ?)
  `).run(
    batchId,
    "May 2026 Payroll",
    "DRAFT"
  );

  db.prepare(`
    INSERT INTO payroll_items (
      id,
      batch_id,
      employee_name,
      employee_email,
      wallet,
      base_salary,
      overtime_hours,
      overtime_rate,
      allowance,
      bonus,
      deduction,
      final_amount
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    batchId,
    "Mai",
    "mai@test.com",
    "0x09C960a7d011D1bb9241B69F9CDaD9c9BcE6175d",
    1,
    0,
    0,
    0,
    0,
    0,
    1
  );

  res.json({
    success: true,
    batchId
  });
});

async function executePayoutById(id, workspaceId) {
  if (!payoutWallet) {
    throw new Error("Missing PAYOUT_PRIVATE_KEY");
  }

  const payout = db.prepare(`
  SELECT *
  FROM payouts
  WHERE id = ?
    AND workspace_id = ?
`).get(id, workspaceId);

  if (!payout) {
    throw new Error("Payout not found");
  }

  if (payout.status === "PAID") {
    return { alreadyPaid: true, payout };
  }

  const allowedStatuses = [
  "PENDING",
  "REVIEW",
  "APPROVED",
  "PROCESSING"
];

if (!allowedStatuses.includes(payout.status)) {
  throw new Error(
    `Payout cannot be executed from status ${payout.status}`
  );
}

  const usdc = new ethers.Contract(
    USDC_ADDRESS,
    ERC20_ABI,
    payoutWallet
  );

  const numericAmount = Number(payout.amount);

if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
  throw new Error(`Invalid payout amount: ${payout.amount}`);
}

const normalizedAmount = numericAmount.toFixed(6);
const amountUnits = ethers.parseUnits(normalizedAmount, 6);

  const tx = await usdc.transfer(payout.recipient, amountUnits);
  await tx.wait();

  db.prepare(`
  UPDATE payouts
  SET status = 'PAID',
      tx_hash = ?
  WHERE id = ?
    AND workspace_id = ?
`).run(
  tx.hash,
  id,
  workspaceId
);

  return {
    id,
    txHash: tx.hash,
    status: "PAID"
  };
}

app.post("/api/payouts/:id/execute", async (req, res) => {
  try {
    const workspaceId = String(
  req.body.workspaceId || ""
).trim();

const result = await executePayoutById(
  req.params.id,
  workspaceId
);

    res.json({
      message: result.alreadyPaid ? "Already paid" : "Payout sent",
      ...result
    });
  } catch (err) {
    console.error("PAYOUT ERROR:", err);
    res.status(500).json({
      error: "Payout failed",
      details: err.message
    });
  }
});   

app.post("/api/payouts/:id/approve", (req, res) => {
  try {
    const { id } = req.params;

    const workspaceId = String(
      req.body.workspaceId || ""
    ).trim();

    if (!workspaceId) {
      return res.status(400).json({
        error: "Workspace is required"
      });
    }

    const payout = db.prepare(`
      SELECT *
      FROM payouts
      WHERE id = ?
        AND workspace_id = ?
    `).get(id, workspaceId);

    if (!payout) {
      return res.status(404).json({
        error: "Payout not found in this workspace"
      });
    }

    if (payout.mode !== "scheduled") {
      return res.status(400).json({
        error: "Only scheduled payouts can be approved here"
      });
    }

    if (
      payout.status !== "PENDING" &&
      payout.status !== "REVIEW" &&
      payout.status !== "FAILED"
    ) {
      return res.status(400).json({
        error:
          "Only PENDING, REVIEW or FAILED scheduled payouts can be approved"
      });
    }

    if (!payout.next_run_at) {
      return res.status(400).json({
        error: "Scheduled payout is missing next_run_at"
      });
    }

    const scheduledTime = new Date(
      payout.next_run_at
    ).getTime();

    if (Number.isNaN(scheduledTime)) {
      return res.status(400).json({
        error: "Invalid scheduled payout time"
      });
    }

    if (scheduledTime <= Date.now()) {
      return res.status(400).json({
        error:
          "Scheduled payout time has already passed. Please create a new schedule."
      });
    }

    const result = db.prepare(`
      UPDATE payouts
      SET status = 'APPROVED'
      WHERE id = ?
        AND workspace_id = ?
        AND status IN ('PENDING', 'REVIEW', 'FAILED')
    `).run(id, workspaceId);

    if (result.changes !== 1) {
      return res.status(409).json({
        error: "Payout status changed. Please refresh and try again."
      });
    }

    return res.json({
      success: true,
      message: "Scheduled payout approved",
      id,
      status: "APPROVED",
      nextRunAt: payout.next_run_at
    });
  } catch (err) {
    console.error("Approve payout error:", err);

    return res.status(500).json({
      error: "Approve payout failed",
      details: err.message
    });
  }
});

/* =========================
   HELPERS
========================= */

async function getGoogleUserFromToken(accessToken) {
  if (!accessToken) {
    throw new Error("Missing Google access token");
  }

  const response = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    }
  );

  const user = await response.json();

  if (!response.ok || !user.email) {
    throw new Error("Invalid Google login");
  }

  return user;
}

async function verifyClaimRecipient(claimId, accessToken) {
  const claim = db
    .prepare("SELECT * FROM claims WHERE id = ?")
    .get(String(claimId));

  if (!claim) {
    throw new Error("Claim not found");
  }

  const googleUser = await getGoogleUserFromToken(accessToken);

  const googleEmail = String(googleUser.email || "")
    .trim()
    .toLowerCase();

  const recipientEmail = String(claim.recipientEmail || "")
    .trim()
    .toLowerCase();

  if (googleEmail !== recipientEmail) {
    throw new Error(
      "This Google account is not the intended recipient"
    );
  }

  return {
    claim,
    googleUser
  };
}

app.post("/api/claims/:id/verify-google", async (req, res) => {
  try {
    const { googleAccessToken } = req.body;

    const { claim, googleUser } =
      await verifyClaimRecipient(
        req.params.id,
        googleAccessToken
      );

    res.json({
      success: true,
      verified: true,
      email: googleUser.email,
      claim: {
        id: claim.id,
        amount: claim.amount,
        message: claim.message,
        status: claim.status
      }
    });
  } catch (err) {
    res.status(403).json({
      success: false,
      verified: false,
      error: err.message
    });
  }
});

function requireCircle(res) {
  if (!CIRCLE_API_KEY) {
    res.status(500).json({
      ok: false,
      error: "Missing CIRCLE_API_KEY in .env"
    });
    return false;
  }

  return true;
}

function makeInvoiceId() {
  return `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeAmount(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Number(n.toFixed(6));
}

function isAddress(value) {
  return /^0x[a-fA-F0-9]{40}$/.test(String(value || "").trim());
}

function rowToInvoice(row) {
  if (!row) return null;

  const checkoutPath = `/?invoice=${row.id}`;

  return {
    id: row.id,
    workspaceId: row.workspace_id || null,
    title: row.title,
    amount: row.amount,
    recipientAddress: row.recipientAddress,
    targetChain: row.targetChain,
    note: row.note || "",
    status: row.status,
    txHash: row.txHash || null,
    onchainId: row.onchainId,
    fromAddress: row.fromAddress || null,
    createdAt: row.createdAt,
    paidAt: row.paidAt || null,
    paymentMemo: row.paymentMemo || "",
    dueDate: row.dueDate,
    checkoutPath,
    checkoutUrl: checkoutPath,
    explorerAddressUrl: `${ARC_EXPLORER_URL}/address/${row.recipientAddress}`,
    explorerTxUrl: row.txHash ? `${ARC_EXPLORER_URL}/tx/${row.txHash}` : null
  };
}

async function recordPaymentMemo({ txHash, type, amount, from, to, note }) {
  try {
    if (!PAYOUT_PRIVATE_KEY) {
      console.warn("Memo skipped: missing PAYOUT_PRIVATE_KEY");
      return null;
    }

    const wallet = new ethers.Wallet(PAYOUT_PRIVATE_KEY, provider);

    const MEMO_ABI = [
      "function memo(address target, bytes data, bytes32 memoId, bytes memoData)"
    ];

    const memoContract = new ethers.Contract(
      ARC_MEMO_ADDRESS,
      MEMO_ABI,
      wallet
    );

    const memoText = JSON.stringify({
      app: "TROR",
      type,
      amount: String(amount || ""),
      from: from || "",
      to: to || "",
      note: note || "",
      ref: txHash || "",
      timestamp: new Date().toISOString()
    });

    const transferData = "0x";

    const memoId = ethers.keccak256(
      ethers.toUtf8Bytes(`TROR-${type}-${txHash || Date.now()}`)
    );

    const memoData = ethers.toUtf8Bytes(memoText);

    const memoTx = await memoContract.memo(
      USDC_ADDRESS,
      transferData,
      memoId,
      memoData
    );

    await memoTx.wait();

    console.log("TROR memo tx:", memoTx.hash);

    return memoTx.hash;
  } catch (err) {
    console.warn("Memo failed, payment still OK:", err.message);
    return null;
  }
}

/* =========================
   HEALTH / CONFIG
========================= */

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    service: "arc-pay-mini-final",
    time: new Date().toISOString()
  });
});

app.get("/api/config", (req, res) => {
  res.json({
    ok: true,
    config: {
      merchantAddress: MERCHANT_ADDRESS,
      transakApiKey: process.env.TRANSAK_API_KEY,
      arcChainId: ARC_CHAIN_ID,
      arcChainIdHex: ARC_CHAIN_ID_HEX,
      arcChainName: ARC_CHAIN_NAME,
      arcRpcUrl: ARC_RPC_URL,
      arcExplorerUrl: ARC_EXPLORER_URL,
      usdcAddress: USDC_ADDRESS,
      usdcDecimals: USDC_DECIMALS
    }
  });
});

app.post("/api/card-payment-intent", async (req, res) => {
  try {
    const { recipientEmail, amount } = req.body;

    if (!recipientEmail || !amount) {
      return res.status(400).json({
        ok: false,
        error: "recipientEmail and amount are required"
      });
    }

    if (!process.env.TRANSAK_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Missing TRANSAK_API_KEY"
      });
    }

    const paymentId = crypto.randomUUID();

    const walletAddress =
      process.env.TROR_TREASURY_WALLET ||
      MERCHANT_ADDRESS;

    const transakUrl =
      "https://global.transak.com" +
      "?apiKey=" + encodeURIComponent(process.env.TRANSAK_API_KEY) +
      "&productsAvailed=BUY"; 

    return res.json({
      ok: true,
      paymentId,
      transakUrl
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

app.get("/api/circle/config", (req, res) => {
  res.json({
    ok: true,
    config: {
      circleAppId: CIRCLE_APP_ID,
      googleClientId: GOOGLE_CLIENT_ID
    }
  });
});

app.post("/api/ai/invoice-draft", async (req, res) => {
  if (!openai) {
    return res.status(500).json({ error: "OPENAI_API_KEY is missing" });
  }

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required" });
    }

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: `
Create an TROR invoice draft from this request:

"${prompt}"

Return ONLY JSON:
{
  "title": "",
  "description": "",
  "amount": 0,
  "currency": "USDC",
  "customer": ""
}
`
    });

    let text = response.output_text.trim();

    text = text
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();
    console.log("GPT RAW:", text);
    const draft = JSON.parse(text);

    res.json({ success: true, draft });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI draft failed" });
  }
});


/* =========================
   INVOICES
========================= */

app.post("/api/ai/invoice-draft", async (req, res) => {

  try {

    const { prompt } = req.body;

    if (!openai) {
      return res.status(500).json({
        error: "OpenAI not configured"
      });
    }

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4.1-mini",

        messages: [

          {
            role: "system",

            content: `
You are an AI commerce parser.

Extract:
- intent
- title
- amount
- category

Return ONLY JSON.`

          },

          {
            role: "user",
            content: prompt
          }

        ]

      });

    const text =
      completion.choices[0]
        .message.content;

    const parsed =
      JSON.parse(text);

    res.json(parsed);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: err.message
    });

  }

});

app.get("/api/invoices", (req, res) => {
  try {
    const workspaceId = String(
      req.query.workspaceId || ""
    ).trim();

    let rows;

    if (workspaceId) {
      rows = db.prepare(`
        SELECT *
        FROM invoices
        WHERE workspace_id = ?
        ORDER BY createdAt DESC
      `).all(workspaceId);
    } else {
      rows = db.prepare(`
        SELECT *
        FROM invoices
        ORDER BY createdAt DESC
      `).all();
    }

    return res.json({
      ok: true,
      invoices: rows.map(rowToInvoice)
    });
  } catch (err) {
    console.error("Load invoices error:", err);

    return res.status(500).json({
      ok: false,
      error: "Failed to load invoices",
      details: err.message
    });
  }
});

app.get("/api/invoices/:id", (req, res) => {
  const row = db
    .prepare("SELECT * FROM invoices WHERE id = ?")
    .get(req.params.id);

  if (!row) {
    return res.status(404).json({
      ok: false,
      error: "Invoice not found"
    });
  }

  res.json({
    ok: true,
    invoice: rowToInvoice(row)
  });
});

app.post("/api/invoices", (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    const amount = normalizeAmount(req.body.amount);
    const recipientAddress = String(
      req.body.recipientAddress || MERCHANT_ADDRESS
    ).trim();

    const targetChain = String(req.body.targetChain || "Arc").trim() || "Arc";
    const note = String(req.body.note || "").trim();
    const workspaceId = String(
  req.body.workspaceId || ""
).trim();
    const dueDate =
      String(req.body.dueDate || "").trim();
    const createdAt = new Date().toISOString();
    const txHash = String(req.body.txHash || "").trim();
    const onchainId =
  req.body.onchainId !== undefined
    ? Number(req.body.onchainId)
    : null;

    if (!title) {
      return res.status(400).json({
        ok: false,
        error: "Title is required"
      });
    }

    if (!amount) {
      return res.status(400).json({
        ok: false,
        error: "Valid amount is required"
      });
    }

    if (!isAddress(recipientAddress)) {
      return res.status(400).json({
        ok: false,
        error: "Recipient address is invalid"
      });
    }

if (!workspaceId) {
  return res.status(400).json({
    ok: false,
    error: "Workspace is required"
  });
}

const workspace = db.prepare(`
  SELECT *
  FROM workspaces
  WHERE id = ?
    AND status = 'ACTIVE'
`).get(workspaceId);

if (!workspace) {
  return res.status(404).json({
    ok: false,
    error: "Workspace not found"
  });
}

    const recipientEmail = req.body.recipientEmail || null;

    const id = makeInvoiceId();

    db.prepare(`
      INSERT INTO invoices (
         id,
         title,
         amount,
         recipientAddress,
         recipientEmail,
         targetChain,
         note,
         status,
         createdAt,
         dueDate,
         txHash,
         onchainId,
         workspace_id
      ) VALUES (
        @id,
        @title,
        @amount,
        @recipientAddress,
        @recipientEmail,
        @targetChain,
        @note,
        'CREATED',
        @createdAt,
        @dueDate,
        @txHash,
        @onchainId,
        @workspaceId
      )
    `).run({
      id,
      title,
      amount,
      recipientAddress,
      recipientEmail,
      targetChain,
      note,
      createdAt,
      dueDate,
      txHash,
      onchainId,
      workspaceId
    });

    const row = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id);

    res.json({
      ok: true,
      invoice: rowToInvoice(row)
    });
  } catch (error) {
  console.error(error);

  res.status(500).json({
    ok: false,
    error: error.message || "Create invoice failed"
  });
}
});

app.post("/api/invoices/:id/mark-paid", async (req, res) => {
  try {
    const row = db
      .prepare("SELECT * FROM invoices WHERE id = ?")
      .get(req.params.id);

    if (!row) {
      return res.status(404).json({
        ok: false,
        error: "Invoice not found"
      });
    }

    if (row.status === "PAID") {
      return res.json({
        ok: true,
        invoice: rowToInvoice(row),
        alreadyPaid: true
      });
    }

    const txHash = String(req.body.txHash || "").trim();
    const fromAddress = String(req.body.fromAddress || "").trim();
    const paymentMemo = String(req.body.paymentMemo || "").trim();
    const paidAt = new Date().toISOString();

    db.prepare(`
      UPDATE invoices
      SET status = 'PAID',
          txHash = ?,
          fromAddress = ?,
          paidAt = ?,
          paymentMemo = ?
      WHERE id = ?
    `).run(txHash || null, fromAddress || null, paidAt, paymentMemo || null, req.params.id);

    const updated = db
      .prepare("SELECT * FROM invoices WHERE id = ?")
      .get(req.params.id);

    res.json({
      ok: true,
      invoice: rowToInvoice(updated)
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message || "Mark paid failed"
    });
  }
});

/* =========================
   CIRCLE USER
========================= */

app.post("/api/circle/create-user", async (req, res) => {
  try {
    if (!requireCircle(res)) return;

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Missing email"
      });
    }

    const response = await fetch("https://api.circle.com/v1/w3s/users", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CIRCLE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: String(email).toLowerCase()
      })
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

app.post("/api/circle/user-token", async (req, res) => {
  try {
    if (!requireCircle(res)) return;

    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Missing email" });

    const response = await fetch("https://api.circle.com/v1/w3s/users/token", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CIRCLE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: String(email).toLowerCase()
      })
    });

    const text = await response.text();

console.log("Circle status:", response.status);
console.log("Circle body:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    console.log("Circle user-token response:", response.status, data);
    return res.status(response.status).json(data);
  } catch (err) {
    console.error("Circle user-token error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Circle user-token failed"
    });
  }
});

app.post("/api/circle/initialize-user", async (req, res) => {
  try {
    if (!requireCircle(res)) return;

    const { userToken } = req.body;

    if (!userToken) {
      return res.status(400).json({
        error: "Missing userToken"
      });
    }

    const response = await fetch("https://api.circle.com/v1/w3s/user/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CIRCLE_API_KEY}`,
        "X-User-Token": userToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        blockchains: ["ARC-TESTNET"],
        accountType: "SCA"
      })
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

/* =========================
   CIRCLE WALLETS
========================= */

app.post("/api/circle/create-wallet", async (req, res) => {
  try {
    if (!requireCircle(res)) return;

    const {
  userToken,
  blockchains
} = req.body;

    if (!userToken) {
      return res.status(400).json({
        error: "Missing userToken"
      });
    }

    const response = await fetch("https://api.circle.com/v1/w3s/user/wallets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CIRCLE_API_KEY}`,
        "X-User-Token": userToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        blockchains:
  Array.isArray(blockchains) && blockchains.length > 0
    ? blockchains
    : [
        "ARC-TESTNET",
        "ETH-SEPOLIA",
        "BASE-SEPOLIA",
        "ARB-SEPOLIA",
        "AVAX-FUJI",
        "OP-SEPOLIA",
        "MATIC-AMOY",
        "UNI-SEPOLIA"
      ],
accountType: "SCA"
      })
    });

    const data = await response.json();
    console.log(
  "Circle create-wallet response:",
  JSON.stringify(data, null, 2)
);
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

async function listWalletsWithToken(userToken) {
  const response = await fetch("https://api.circle.com/v1/w3s/wallets", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${CIRCLE_API_KEY}`,
      "X-User-Token": userToken,
      "Content-Type": "application/json"
    }
  });

  const data = await response.json();

  return {
    status: response.status,
    data
  };
}

app.post("/api/circle/list-wallets", async (req, res) => {
  try {
    if (!requireCircle(res)) return;

    const { userToken } = req.body;

    if (!userToken) {
      return res.status(400).json({
        error: "Missing userToken"
      });
    }

    const result = await listWalletsWithToken(userToken);
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

app.post("/api/circle/wallets", async (req, res) => {
  try {
    if (!requireCircle(res)) return;

    const { userToken } = req.body;

    if (!userToken) {
      return res.status(400).json({
        error: "Missing userToken"
      });
    }

    const result = await listWalletsWithToken(userToken);
    res.status(result.status).json(result.data);
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

app.post("/api/circle/wallet-balances", async (req, res) => {
  try {
    if (!requireCircle(res)) return;

    const { userToken, walletId } = req.body;

    if (!userToken) {
      return res.status(400).json({
        error: "Missing userToken"
      });
    }

    if (!walletId) {
      return res.status(400).json({
        error: "Missing walletId"
      });
    }

    const response = await fetch(
      `https://api.circle.com/v1/w3s/wallets/${walletId}/balances`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${CIRCLE_API_KEY}`,
          "X-User-Token": userToken,
          "Content-Type": "application/json"
        }
      }
    );

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

/* =========================
   CIRCLE PAYMENT
========================= */
app.post("/api/circle/transfer", async (req, res) => {
  try {
    if (!requireCircle(res)) return;

    const {
      userToken,
      walletId,
      tokenId,
      amount,
      destinationAddress
    } = req.body;

    if (!userToken) return res.status(400).json({ error: "Missing userToken" });
    if (!walletId) return res.status(400).json({ error: "Missing walletId" });
    if (!tokenId) return res.status(400).json({ error: "Missing tokenId" });
    if (!amount) return res.status(400).json({ error: "Missing amount" });

    if (!destinationAddress || !isAddress(destinationAddress)) {
      return res.status(400).json({ error: "Invalid destinationAddress" });
    }

    const payload = {
  idempotencyKey: crypto.randomUUID(),
  walletId: String(walletId),
  tokenId: String(tokenId),
  destinationAddress: String(destinationAddress),
  amounts: [String(Number(amount).toFixed(6))],
  feeLevel: "MEDIUM"
};

    console.log("Circle transfer backend payload:", payload);

    const response = await fetch(
      "https://api.circle.com/v1/w3s/user/transactions/transfer",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CIRCLE_API_KEY}`,
          "X-User-Token": userToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();
    console.log("Circle transfer backend response:", response.status, data);

    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/circle/contract-execution", async (req, res) => {
  try {
    if (!requireCircle(res)) return;

    const {
      userToken,
      walletId,
      contractAddress,
      abiFunctionSignature,
      abiParameters
    } = req.body;

    if (!userToken) return res.status(400).json({ error: "Missing userToken" });
    if (!walletId) return res.status(400).json({ error: "Missing walletId" });
    if (!contractAddress || !isAddress(contractAddress)) {
      return res.status(400).json({ error: "Invalid contractAddress" });
    }
    if (!abiFunctionSignature) {
      return res.status(400).json({ error: "Missing abiFunctionSignature" });
    }

    const payload = {
      idempotencyKey: crypto.randomUUID(),
      walletId: String(walletId),
      contractAddress: String(contractAddress),
      abiFunctionSignature: String(abiFunctionSignature),
      abiParameters: abiParameters || [],
      feeLevel: "MEDIUM"
    };

    console.log("Circle contract execution payload:", payload);

    const response = await fetch(
      "https://api.circle.com/v1/w3s/user/transactions/contractExecution",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${CIRCLE_API_KEY}`,
          "X-User-Token": userToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();
    console.log("Circle contract execution response:", response.status, data);

    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/circle/transactions", async (req, res) => {
  try {
    if (!requireCircle(res)) return;

    const { userToken } = req.body;

    if (!userToken) {
      return res.status(400).json({
        error: "Missing userToken"
      });
    }

    const response = await fetch("https://api.circle.com/v1/w3s/transactions", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${CIRCLE_API_KEY}`,
        "X-User-Token": userToken,
        "Content-Type": "application/json"
      }
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({
      error: err.message
    });
  }
});

app.post("/api/withdrawals", (req, res) => {
  const {
    workspaceId,
    email,
    amount,
    country,
    bankName,
    accountHolder,
    accountNumber,
    claimId
  } = req.body;

  const id = crypto.randomUUID();

if (!workspaceId) {
  return res.status(400).json({
    error: "Workspace is required"
  });
}

if (!claimId) {
  return res.status(409).json({
    error: "Missing claimId"
  });
}

const existing = db.prepare(`
  SELECT id
  FROM withdrawals
  WHERE claim_id = ?
    AND workspace_id = ?
`).get(claimId, workspaceId);

if (existing) {
  return res.status(400).json({
    error: "This claim has already been withdrawn."
  });
}

  db.prepare(`
    INSERT INTO withdrawals (
      id,
      workspace_id,
      email,
      amount,
      country,
      bank_name,
      account_holder,
      account_number,
      claim_id,
      status,
      created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    workspaceId,
    email,
    amount,
    country,
    bankName,
    accountHolder,
    accountNumber,
    claimId,
    "PENDING",
    new Date().toISOString()
  );

  res.json({
    success: true,
    withdrawalId: id
  });
});

app.get("/api/withdrawals/claim/:claimId", (req, res) => {
  try {
    const { claimId } = req.params;

    if (!claimId) {
      return res.status(400).json({
        error: "Missing claimId"
      });
    }

    const withdrawal = db.prepare(`
      SELECT *
      FROM withdrawals
      WHERE claim_id = ?
      LIMIT 1
    `).get(claimId);

    if (!withdrawal) {
      return res.status(404).json({
        error: "Withdrawal not found"
      });
    }

    res.json(withdrawal);
  } catch (err) {
    console.error("Get withdrawal by claim error:", err);

    res.status(500).json({
      error: err.message || "Failed to load withdrawal"
    });
  }
});

app.get("/api/withdrawals", (req, res) => {
  try {
    const workspaceId = String(
      req.query.workspaceId || ""
    ).trim();

    if (!workspaceId) {
      return res.status(400).json({
        error: "Workspace is required"
      });
    }

    const rows = db.prepare(`
      SELECT *
      FROM withdrawals
      WHERE workspace_id = ?
      ORDER BY created_at DESC
    `).all(workspaceId);

    return res.json(rows);
  } catch (err) {
    console.error(
      "Load withdrawals error:",
      err
    );

    return res.status(500).json({
      error: "Failed to load withdrawals"
    });
  }
});

app.post("/api/withdrawals/:id/status", async (req, res) => {
  try {
    const { id } = req.params;

const workspaceId = String(
  req.body.workspaceId || ""
).trim();

const { status } = req.body;

if (!workspaceId) {
  return res.status(400).json({
    error: "Workspace is required"
  });
}

    const allowed = ["PENDING", "REVIEW", "APPROVED", "COMPLETED", "REJECTED"];

    if (!allowed.includes(status)) {
      return res.status(400).json({ error: "Invalid withdrawal status" });
    }

    const timestampColumn = {
  REVIEW: "reviewed_at",
  APPROVED: "approved_at",
  COMPLETED: "completed_at",
  REJECTED: "rejected_at"
}[status];

if (timestampColumn) {
  const result = db.prepare(`
  UPDATE withdrawals
  SET status = ?,
      ${timestampColumn} = ?
  WHERE id = ?
    AND workspace_id = ?
`).run(
  status,
  new Date().toISOString(),
  id,
  workspaceId
);

if (result.changes === 0) {
  return res.status(404).json({
    error: "Withdrawal not found in this workspace"
  });
}
} else {
  const result = db.prepare(`
  UPDATE withdrawals
  SET status = ?
  WHERE id = ?
    AND workspace_id = ?
`).run(
  status,
  id,
  workspaceId
);

if (result.changes === 0) {
  return res.status(404).json({
    error: "Withdrawal not found in this workspace"
  });
}
}

const row = db.prepare(`
  SELECT *
  FROM withdrawals
  WHERE id = ?
    AND workspace_id = ?
`).get(id, workspaceId);

await resend.emails.send({
  from: "TROR <no-reply@mail.tror.app>",
  to: [row.email],
  subject: `TROR withdrawal ${status}`,
  html: `
    <h2>Withdrawal ${status}</h2>
    <p>Your bank withdrawal request is now <b>${status}</b>.</p>
    <ul>
      <li>Amount: ${row.amount} USDC</li>
      <li>Bank: ${row.bank_name}</li>
      <li>Account: ${row.account_number}</li>
      <li>Holder: ${row.account_holder}</li>
    </ul>
  `
});

    res.json({
      success: true,
      withdrawalId: id,
      status
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   FRONTEND FALLBACK
========================= */

const distPath = path.join(__dirname, "frontend", "dist");

app.get("/api/dashboard", (req, res) => {
  try {

const workspaceId = String(
  req.query.workspaceId || ""
).trim();

if (!workspaceId) {
  return res.status(400).json({
    error: "Workspace is required"
  });
}

    const totalReceivedRow = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM invoices
      WHERE status = 'PAID'
      AND workspace_id = ?
    `).get(workspaceId);

    const paidCountRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM invoices
      WHERE status = 'PAID'
      AND workspace_id = ?
    `).get(workspaceId);

    const pendingCountRow = db.prepare(`
      SELECT COUNT(*) as count
      FROM invoices
      WHERE status != 'PAID'
      AND workspace_id = ?
    `).get(workspaceId);

    const latestPayment = db.prepare(`
      SELECT id, title, amount, txHash, paidAt
      FROM invoices
      WHERE status = 'PAID'
      AND workspace_id = ?
      ORDER BY paidAt DESC
      LIMIT 1
    `).get(workspaceId);

    const totalInvoicesRow = db.prepare(`
  SELECT COUNT(*) AS count
  FROM invoices
  WHERE workspace_id = ?
`).get(workspaceId);

const totalPayrollsRow = db.prepare(`
  SELECT COUNT(*) AS count
  FROM payroll_batches
  WHERE workspace_id = ?
`).get(workspaceId);

    const totalClaimsRow = db.prepare(`
  SELECT COUNT(*) AS count
  FROM claims
  WHERE workspace_id = ?
`).get(workspaceId);

    const totalVolumeRow = db.prepare(`
      SELECT COALESCE(SUM(amount),0) as total
      FROM invoices
      WHERE status = 'PAID'
      AND workspace_id = ?
    `).get(workspaceId);

const recentActivity = [];

if (latestPayment) {
  recentActivity.push({
    type: "invoice",
    text: `Invoice paid: ${latestPayment.title} (${latestPayment.amount} USDC)`
  });
}

const latestPayroll = db.prepare(`
  SELECT
    b.title,
    COALESCE(SUM(i.final_amount), 0) AS total_amount
  FROM payroll_batches b
  LEFT JOIN payroll_items i
    ON i.batch_id = b.id
    AND i.workspace_id = b.workspace_id
  WHERE b.workspace_id = ?
  GROUP BY b.id
  ORDER BY b.created_at DESC
  LIMIT 1
`).get(workspaceId);

if (latestPayroll) {
  recentActivity.push({
    type: "payroll",
    text: `Payroll executed: ${latestPayroll.title}`
  });
}

const latestClaim = db.prepare(`
  SELECT recipientEmail, amount
  FROM claims
  WHERE workspace_id = ?
  ORDER BY createdAt DESC
  LIMIT 1
`).get(workspaceId);

if (latestClaim) {
  recentActivity.push({
    type: "claim",
    text: `Claim sent to ${latestClaim.recipientEmail}`
  });
}

    res.json({
  totalReceived: totalReceivedRow.total,
  paidCount: paidCountRow.count,
  pendingCount: pendingCountRow.count,

  totalInvoices: totalInvoicesRow.count,
  totalPayrolls: totalPayrollsRow.count,
  totalClaims: totalClaimsRow.count,
  totalVolume: totalVolumeRow.total,

  latestPayment: latestPayment || null,
recentActivity
});
  } catch (err) {
    console.error("dashboard error:", err);
    res.status(500).json({ error: "Dashboard failed" });
  }
});
app.get("/api/transak/config", (req, res) => {
  return res.json({
    apiKey: process.env.TRANSAK_API_KEY || "",
    walletAddress: process.env.TROR_TREASURY_WALLET || ""
  });
});

app.post("/api/transak/widget-url", async (req, res) => {
  try {
    const { amount } = req.body;

    // STEP 1
    // GET ACCESS TOKEN
    const tokenRes = await fetch(
      "https://api-stg.transak.com/partners/api/v2/refresh-token",
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "api-secret": process.env.TRANSAK_API_SECRET,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          apiKey: process.env.TRANSAK_API_KEY
        })
      }
    );

    const tokenData = await tokenRes.json();

    console.log("TOKEN:", tokenData);

    const accessToken =
      tokenData?.data?.accessToken;

    // STEP 2
    // CREATE SESSION
    const sessionRes = await fetch(
      "https://api-gateway-stg.transak.com/api/v2/auth/session",
      {
        method: "POST",
        headers: {
         accept: "application/json",
         "content-type": "application/json",
         "access-token": accessToken
        },
        body: JSON.stringify({
          widgetParams: {
            apiKey: process.env.TRANSAK_API_KEY,
            referrerDomain: "https://tror.app",
            productsAvailed: "BUY",
            fiatAmount: Number(amount) || 10,
            fiatCurrency: "USD",
            cryptoCurrencyCode: "USDC",
            network: "polygon",
          walletAddress: process.env.TROR_TREASURY_WALLET,
            paymentMethod: "credit_debit_card",
            redirectURL: "https://tror.app/transak-return"
         }
       })
      }
    );

    const sessionData =
      await sessionRes.json();

    console.log(
      "SESSION:",
      sessionData
    );

    res.json(sessionData);

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: err.message
    });
  }
});

app.get("/api/circle/wallet-balances", async (req, res) => {
  try {

    const walletAddress =
      process.env.TROR_TREASURY_WALLET;

    const rpcUrl =
      process.env.ARC_RPC_URL;

    const USDC =
      process.env.USDC_ADDRESS;

    const web3 = new Web3(rpcUrl);

    const abi = [
      {
        constant: true,
        inputs: [
          { name: "_owner", type: "address" }
        ],
        name: "balanceOf",
        outputs: [
          { name: "balance", type: "uint256" }
        ],
        type: "function"
      },
      {
        constant: true,
        inputs: [],
        name: "decimals",
        outputs: [
          { name: "", type: "uint8" }
        ],
        type: "function"
      }
    ];

    const contract =
      new web3.eth.Contract(abi, USDC);

    const raw =
      await contract.methods
        .balanceOf(walletAddress)
        .call();

    const decimals =
      await contract.methods
        .decimals()
        .call();

    const balance =
      Number(raw) / 10 ** Number(decimals);

    res.json({
      success: true,
      walletAddress,
      balance
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message
    });

  }
});

app.post("/api/demo/send-test-usdc", async (req, res) => {

  try {

    const {
      email,
      amount
    } = req.body;

    console.log(
      "SEND TEST USDC:",
      email,
      amount
    );

    // generate claim ID
    const claimId =
      crypto.randomUUID();

    // generate claim link
    const APP_URL =
      process.env.APP_URL ||
      "https://tror.app";

    const claimLink =
      `${APP_URL}/claim/${claimId}`;

    // send email
    await resend.emails.send({
      from:
       "TROR <no-reply@mail.tror.app>",

      to: [email],

      subject:
        "TROR Claim USDC",

      html: `
  <h2>You received ${amount} test USDC</h2>

  <p>${message || ""}</p>

  <p>Click below to claim your funds:</p>

  <p>
    <a
      href="${claimLink}"
      target="_blank"
      style="
        display:inline-block;
        padding:12px 20px;
        background:#4f46e5;
        color:white;
        text-decoration:none;
        border-radius:10px;
        font-weight:bold;
      "
    >
      Claim USDC
    </a>
  </p>

  <p>Or copy this link:</p>

  <p>
    <a href="${claimLink}">
      ${claimLink}
    </a>
  </p>
`
    });

    res.json({
      success: true,
      email,
      amount,
      claimId,
      claimLink
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message
    });

  }

});

async function checkInvoicePaid(invoice) {
  try {
    const contract = new ethers.Contract(
      process.env.USDC_ADDRESS,
      ERC20_ABI,
      provider
    );

    const filter = contract.filters.Transfer(null, invoice.recipientAddress);

    const currentBlock = await provider.getBlockNumber();
    const fromBlock = Math.max(currentBlock - 1000, 0);

    const events = await contract.queryFilter(filter, fromBlock, currentBlock);

    for (const e of events) {
      const amount = Number(e.args.value) / 1e6;

      if (amount >= Number(invoice.amount)) {
        return {
          paid: true,
          txHash: e.transactionHash
        };
      }
    }

    return { paid: false };
  } catch (err) {
    console.error("checkInvoicePaid error:", err);
    return { paid: false };
  }
}

app.get("/api/invoices/:id/check-payment", async (req, res) => {
  try {
    const id = req.params.id;

    const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(id);

    if (!invoice) {
      return res.status(404).json({ error: "Invoice not found" });
    }

    if (invoice.status === "PAID") {
      return res.json(invoice);
    }

    const result = await checkInvoicePaid(invoice);

    if (result.paid) {
      db.prepare(`
        UPDATE invoices
        SET status = 'PAID',
            txHash = ?,
            paidAt = ?
        WHERE id = ?
      `).run(result.txHash, new Date().toISOString(), id);

      invoice.status = "PAID";
      invoice.txHash = result.txHash;
      invoice.paidAt = new Date().toISOString();
    }

    res.json(invoice);
  } catch (err) {
    console.error("check-payment error:", err);
    res.status(500).json({ error: "Check payment failed" });
  }
});

app.post("/api/claims/send-email", async (req, res) => {
  try {
    const {
  recipientEmail,
  amount,
  message,
  claimId,
  txHash,
  workspaceId
} = req.body;

console.log("CLAIM REQUEST BODY:", req.body);
console.log("CLAIM WORKSPACE ID:", workspaceId);

    if (!recipientEmail || !amount) {
      return res.status(400).json({ error: "recipientEmail and amount are required" });
    }

if (!workspaceId) {
  return res.status(400).json({
    error: "Workspace is required"
  });
}

const workspace = db.prepare(`
  SELECT *
  FROM workspaces
  WHERE id = ?
    AND status = 'ACTIVE'
`).get(workspaceId);

if (!workspace) {
  return res.status(404).json({
    error: "Workspace not found"
  });
}

    const id = claimId ? String(claimId) : crypto.randomUUID();
    const appUrl = String(process.env.APP_URL || "http://localhost:5173").replace(/\/+$/, "");
    const claimLink = `${appUrl}/claim/${id}`;

    db.prepare(`
  INSERT INTO claims (
    id,
    recipientEmail,
    amount,
    message,
    status,
    createdAt,
    txHash,
    workspace_id
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`).run(
  id,
  recipientEmail,
  Number(amount),
  message || "",
  "FUNDED",
  new Date().toISOString(),
  txHash || null,
  workspaceId
);

    const { data, error } = await resend.emails.send({
  from: "TROR <no-reply@mail.tror.app>",
  to: recipientEmail,
  subject: `You have a message from TROR`,
html: `
  <div style="font-family:Arial,sans-serif;padding:20px;color:#111;">
    <h2>TROR Message</h2>

    <p>You have a new TROR message waiting for you.</p>

    <div style="margin-top:16px;padding:14px;background:#f3f4f6;border-radius:12px;">
      <p><b>Recipient:</b> ${recipientEmail}</p>
      <p><b>TROR Message:</b> Ready</p>
    </div>

    <p style="margin-top:18px;">Open your TROR messages:</p>

    <a href="${claimLink}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:white;text-decoration:none;border-radius:10px;font-weight:bold;">
  Open your TROR messages
</a>

    <p style="margin-top:24px;font-size:12px;color:#6b7280;">
      This message was generated automatically by TROR.
    </p>
  </div>
`
});

if (error) {
  console.error("Resend error:", error);
  return res.status(500).json({
    success: false,
    error: "Failed to send claim email"
  });
}

    res.json({
    success: true,
    claimId: id,
    claimLink
  });
  } catch (err) {
    console.error("send claim email error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/claims", (req, res) => {
  try {
    const workspaceId = String(
      req.query.workspaceId || ""
    ).trim();

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        error: "Workspace is required",
        claims: []
      });
    }

    const workspace = db.prepare(`
      SELECT id
      FROM workspaces
      WHERE id = ?
        AND status = 'ACTIVE'
    `).get(workspaceId);

    if (!workspace) {
      return res.status(404).json({
        success: false,
        error: "Workspace not found",
        claims: []
      });
    }

    const claims = db.prepare(`
      SELECT *
      FROM claims
      WHERE workspace_id = ?
      ORDER BY createdAt DESC
    `).all(workspaceId);

    return res.json({
      success: true,
      claims
    });
  } catch (err) {
    console.error("Load claims error:", err);

    return res.status(500).json({
      success: false,
      error: "Failed to load claims",
      details: err.message,
      claims: []
    });
  }
});

app.get("/api/claims/:id", (req, res) => {
  const { id } = req.params;

  const claim = db
    .prepare("SELECT * FROM claims WHERE id = ?")
    .get(id);

  if (!claim) {
    return res.status(404).send("Claim not found");
  }

  res.json(claim);
});

app.get("/api/claims/:id", (req, res) => {
  const claim = db.prepare("SELECT * FROM claims WHERE id = ?").get(req.params.id);

  if (!claim) {
    return res.status(404).json({ error: "Claim not found" });
  }

  res.json(claim);
});

app.post("/api/claims/:id/claim", async (req, res) => {
  try {
    const {
  walletAddress,
  googleAccessToken
} = req.body;

const { id } = req.params;

await verifyClaimRecipient(id, googleAccessToken);

    if (!walletAddress || !walletAddress.startsWith("0x")) {
      return res.status(400).json({ error: "Valid wallet address is required" });
    }

    const claim = db.prepare("SELECT * FROM claims WHERE id = ?").get(id);

    if (!claim) {
      return res.status(404).json({ error: "Claim not found" });
    }

    if (claim.status === "CLAIMED") {
      return res.status(400).json({ error: "Claim already claimed" });
    }

    if (!PAYOUT_PRIVATE_KEY) {
      return res.status(500).json({ error: "Missing PAYOUT_PRIVATE_KEY" });
    }

    const payoutWallet = new ethers.Wallet(PAYOUT_PRIVATE_KEY, provider);

    const claimContract = new ethers.Contract(
  CLAIM_CONTRACT_ADDRESS,
  CLAIM_CONTRACT_ABI,
  payoutWallet
);

const tx = await claimContract.claimToWallet(id, walletAddress);
await tx.wait();

    db.prepare(`
      UPDATE claims
      SET status = ?,
          walletAddress = ?,
          claimedAt = ?,
          txHash = ?
      WHERE id = ?
    `).run(
      "CLAIMED",
      walletAddress,
      new Date().toISOString(),
      tx.hash,
      id
    );

console.log("CLAIM CREATED:", id);

    res.json({
      success: true,
      message: "USDC claimed successfully",
      walletAddress,
      txHash: tx.hash,
      claimedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error("claim transfer error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/claim/:id", (req, res) => {
  const { id } = req.params;

  const claim = db.prepare("SELECT * FROM claims WHERE id = ?").get(id);

  if (!claim) {
    return res.status(404).json({ error: "Claim not found" });
  }

  res.json(claim);
});

app.get("/test-email", async (req, res) => {
  try {
    const data = await resend.emails.send({
      from: "TROR <no-reply@mail.tror.app>",
      to: ["maihongha14021992mhh12@gmail.com"],
      subject: "Test email from TROR 🚀",
      html: "<h1>TROR email is working!</h1>",
    });

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error sending email");
  }
});

async function checkInvoices() {

  const result =
    db.prepare(`
      UPDATE invoices
      SET status = CASE
        WHEN datetime(dueDate) < datetime('now')
          THEN 'OVERDUE'

        WHEN datetime(dueDate) <= datetime('now', '+1 day')
          THEN 'REMINDER'

        ELSE status
      END

        WHERE
          status != 'PAID'
          AND dueDate IS NOT NULL
    `).run();

  console.log(
    "checking invoices...",
    result.changes
  );

  const reminders = db.prepare(`
    SELECT *
    FROM invoices
    WHERE status = 'REMINDER'
    AND reminder_sent = 0
  `).all();

  for (const inv of reminders) {
    console.log(
  "Sending reminder:",
  inv.id
);

try {

  console.log(
    "recipientEmail:",
    inv.recipientEmail
  );

  await resend.emails.send({
  from: "TROR <no-reply@mail.tror.app>",

  to: [
   inv.recipientEmail
  ],

  subject:` Invoice Reminder ${inv.id}`,

  html: `
    <h2>Payment Reminder</h2>

    <p>
      Invoice: ${inv.title}
    </p>

    <p>
      Amount: ${inv.amount} USDC
    </p>

    <p>
      Status: ${inv.status}
    </p>
  `
});

  console.log(
    "Reminder email sent:",
    inv.id
  );

  db.prepare(`
  UPDATE invoices
  SET reminder_sent = 1
  WHERE id = ?
`).run(inv.id);

} catch (err) {
  console.error(
    "Reminder email failed:",
    err.message
  );
}
}
}

// cron.schedule("*/1 * * * *", async () => {
//   checkInvoices();
//   console.log("AUTO PAYOUT CHECK...");

//   const payouts = db.prepare(`
//     SELECT * FROM payouts
//     WHERE status = 'PENDING'
//     ORDER BY created_at ASC
//     LIMIT 3
//   `).all();

//   for (const p of payouts) {
//   try {
//     db.prepare(`
//       UPDATE payouts
//       SET status = 'REVIEW'
//       WHERE id = ?
//       AND status = 'PENDING'
//     `).run(p.id);

//     console.log("Payout needs confirmation:", p.id);
//   } catch (err) {
//     console.error("Auto review error:", err.message);
//   }
// }
// });

app.post("/api/payouts/:id/confirm", async (req, res) => {
  try {
    const { id } = req.params;

    const workspaceId = String(
      req.body.workspaceId || ""
    ).trim();

    if (!workspaceId) {
      return res.status(400).json({
        error: "Workspace is required"
      });
    }

    const payout = db.prepare(`
      SELECT *
      FROM payouts
      WHERE id = ?
        AND workspace_id = ?
    `).get(id, workspaceId);

    if (!payout) {
      return res.status(404).json({
        error: "Payout not found in this workspace"
      });
    }

    if (
      payout.status !== "PENDING" &&
      payout.status !== "REVIEW"
    ) {
      return res.status(400).json({
        error:
          "Only PENDING or REVIEW payouts can be confirmed"
      });
    }

    if (payout.mode === "scheduled") {
  if (!payout.next_run_at) {
    return res.status(400).json({
      error: "Scheduled payout is missing next_run_at"
    });
  }

  const scheduledTime = new Date(
    payout.next_run_at
  ).getTime();

  if (
    Number.isNaN(scheduledTime) ||
    scheduledTime <= Date.now()
  ) {
    return res.status(400).json({
      error: "Scheduled payout time must be in the future"
    });
  }

  db.prepare(`
    UPDATE payouts
    SET status = 'APPROVED'
    WHERE id = ?
      AND workspace_id = ?
      AND status IN ('PENDING', 'REVIEW')
  `).run(id, workspaceId);

  return res.json({
    message: "Scheduled payout approved",
    id,
    status: "APPROVED",
    nextRunAt: payout.next_run_at
  });
}


    const result = await executePayoutById(
  id,
  workspaceId
);

    return res.json({
      message: "Payout paid now",
      ...result
    });
  } catch (err) {
    console.error("CONFIRM PAYOUT ERROR:", err);

    return res.status(500).json({
      error: "Confirm payout failed",
      details: err.message
    });
  }
});

// =======================
// SCHEDULED PAYOUT CRON
// =======================

let payoutSchedulerRunning = false;

cron.schedule("* * * * *", async () => {
  if (payoutSchedulerRunning) {
    console.log(
      "Scheduled payout check skipped: previous run still active"
    );
    return;
  }

  payoutSchedulerRunning = true;

  try {
    const duePayouts = db.prepare(`
      SELECT *
      FROM payouts
      WHERE mode = 'scheduled'
        AND frequency = 'once'
        AND status = 'APPROVED'
        AND next_run_at IS NOT NULL
        AND datetime(next_run_at) <= datetime('now')
      ORDER BY datetime(next_run_at) ASC
      LIMIT 5
    `).all();

    if (duePayouts.length === 0) {
      return;
    }

    console.log(
      `Found ${duePayouts.length} scheduled payout(s) due`
    );

    for (const payout of duePayouts) {
      try {
        /*
         * Atomically claim the payout.
         * Only one scheduler run can change APPROVED → PROCESSING.
         */
        const claimResult = db.prepare(`
          UPDATE payouts
          SET status = 'PROCESSING'
          WHERE id = ?
            AND workspace_id = ?
            AND status = 'APPROVED'
        `).run(
          payout.id,
          payout.workspace_id
        );

        if (claimResult.changes !== 1) {
          console.log(
            "Scheduled payout already claimed:",
            payout.id
          );

          continue;
        }

        console.log(
          "Executing scheduled payout:",
          payout.id
        );

        const result = await executePayoutById(
          payout.id,
          payout.workspace_id
        );

        console.log(
          "Scheduled payout paid:",
          payout.id,
          result.txHash
        );
      } catch (err) {
        const errorMessage =
          err?.error?.message ||
          err?.shortMessage ||
          err?.message ||
          "Unknown scheduled payout error";

        const normalizedError =
          String(errorMessage).toLowerCase();

        const isRpcRateLimit =
          normalizedError.includes(
            "request limit reached"
          ) ||
          normalizedError.includes(
            "too many requests"
          ) ||
          normalizedError.includes("rate limit") ||
          err?.error?.code === -32011 ||
          err?.code === -32011;

        const nextStatus = isRpcRateLimit
          ? "APPROVED"
          : "FAILED";

        db.prepare(`
          UPDATE payouts
          SET status = ?
          WHERE id = ?
            AND workspace_id = ?
            AND status = 'PROCESSING'
        `).run(
          nextStatus,
          payout.id,
          payout.workspace_id
        );

        console.error(
          isRpcRateLimit
            ? "Scheduled payout RPC rate limited:"
            : "Scheduled payout failed:",
          payout.id,
          errorMessage
        );
      }
    }
  } catch (err) {
    console.error(
      "Scheduled payout cron error:",
      err
    );
  } finally {
    payoutSchedulerRunning = false;
  }
});

app.get('/api/config', (req, res) => {
  res.json({
    ok: true,
    config: {
      merchantAddress: process.env.MERCHANT_ADDRESS,
      transakApiKey: process.env.TRANSAK_API_KEY,
    }
  });
});

app.use(express.static(distPath));

app.get("/claim/:id", (req, res) => {
  res.sendFile(path.join(distPath, "app.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) {
      res.status(404).send("Frontend not built. Use http://localhost:5173 for Vite dev.");
    }
  });
});

/* =========================
   START
========================= */

app.listen(PORT, () => {
  console.log(
   `TROR API running at http://localhost:${PORT}`
  );

  console.log(
   ` merchantAddress = ${MERCHANT_ADDRESS}`
  );

  console.log(
  ` circleKey = ${CIRCLE_API_KEY ? "loaded" : "missing"}`
  );
});