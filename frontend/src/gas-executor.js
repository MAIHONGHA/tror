import {
  getTrorGasCapability,
  TROR_GAS_MODE
} from "./gas-capability.js";


/* =========================================================
   NORMALIZE TROR CALL
========================================================= */

function normalizeTrorCall(call) {
  if (!call?.to) {
    throw new Error(
      "TROR transaction call requires a destination address."
    );
  }

  const normalized = {
    to: call.to
  };

  if (call.value !== undefined) {
    normalized.value =
      typeof call.value === "bigint"
        ? `0x${call.value.toString(16)}`
        : call.value;
  } else {
    normalized.value = "0x0";
  }

  /*
    Important:
    MetaMask wallet_sendCalls currently rejects
    data: "0x".

    Therefore only include data when it actually
    contains calldata.
  */
  if (
    typeof call.data === "string" &&
    call.data !== "0x" &&
    call.data.length > 2
  ) {
    normalized.data = call.data;
  }

  return normalized;
}


/* =========================================================
   STANDARD EIP-1193 TRANSACTION
========================================================= */

async function executeStandardTransactions({
  provider,
  address,
  calls
}) {
  const transactionHashes = [];

  for (const rawCall of calls) {
    const call =
      normalizeTrorCall(rawCall);

    const tx = {
      from: address,
      to: call.to,
      value: call.value
    };

    if (call.data) {
      tx.data = call.data;
    }

    const txHash =
      await provider.request({
        method: "eth_sendTransaction",
        params: [tx]
      });

    transactionHashes.push(
      txHash
    );
  }

  return {
    mode: "standard-transactions",
    transactionHashes
  };
}


/* =========================================================
   WALLET-NATIVE SPONSORED EXECUTION
   EIP-5792 wallet_sendCalls
========================================================= */

async function executeWalletSponsoredCalls({
  provider,
  address,
  chainIdHex,
  calls,
  atomicRequired = true
}) {
  const normalizedCalls =
    calls.map(
      normalizeTrorCall
    );

  const result =
    await provider.request({
      method: "wallet_sendCalls",

      params: [
        {
          version: "2.0.0",

          from:
            address,

          chainId:
            chainIdHex,

          atomicRequired,

          calls:
            normalizedCalls
        }
      ]
    });

  console.log(
    "TROR wallet-sponsored call submitted:",
    result
  );

  return {
    mode:
      TROR_GAS_MODE.WALLET_SPONSORED,

    callBundleId:
      result?.id || null,

    result
  };
}


/* =========================================================
   GET WALLET CALL STATUS
========================================================= */

export async function getTrorCallStatus({
  bundleId,
  provider = window.ethereum
}) {
  if (!provider) {
    throw new Error(
      "No Web3 wallet provider found."
    );
  }

  if (!bundleId) {
    throw new Error(
      "TROR call bundle ID is required."
    );
  }

  const status =
    await provider.request({
      method:
        "wallet_getCallsStatus",

      params: [
        bundleId
      ]
    });

  console.log(
    "TROR wallet call status:",
    status
  );

  return status;
}


/* =========================================================
   MAIN TROR GAS EXECUTOR
========================================================= */

export async function executeTrorGasCalls({
  calls,
  provider = window.ethereum,
  atomicRequired = true
} = {}) {
  if (!provider) {
    throw new Error(
      "No connected Web3 wallet provider found."
    );
  }

  if (
    !Array.isArray(calls) ||
    calls.length === 0
  ) {
    throw new Error(
      "TROR requires at least one transaction call."
    );
  }

  const capability =
    await getTrorGasCapability({
      provider
    });

  console.log(
    "TROR gas executor selected:",
    {
      chainId:
        capability.chainId,

      chainName:
        capability.chainName,

      gasMode:
        capability.gasMode,

      wallet:
        capability.wallet
    }
  );


  /* =======================================================
     ARC
     Native USDC is the gas token
  ======================================================= */

  if (
    capability.gasMode ===
    TROR_GAS_MODE.NATIVE_USDC
  ) {
    const execution =
      await executeStandardTransactions({
        provider,

        address:
          capability.address,

        calls
      });

    return {
      capability,
      execution
    };
  }


  /* =======================================================
     METAMASK / WALLET NATIVE SPONSORSHIP
  ======================================================= */

  if (
    capability.gasMode ===
    TROR_GAS_MODE.WALLET_SPONSORED
  ) {
    const execution =
      await executeWalletSponsoredCalls({
        provider,

        address:
          capability.address,

        chainIdHex:
          capability.chainIdHex,

        calls,

        atomicRequired
      });

    return {
      capability,
      execution
    };
  }


  /* =======================================================
     PAYMASTER SERVICE
  ======================================================= */

  if (
    capability.gasMode ===
    TROR_GAS_MODE.CIRCLE_PAYMASTER
  ) {
    /*
      Do NOT silently use the direct ERC-4337
      MetaMask signing path here.

      We already verified that MetaMask can reject
      the external EIP-712 UserOperation signing path.

      This branch should only be implemented when
      the connected wallet advertises and supports
      the wallet-native paymasterService flow.
    */

    throw new Error(
      "TROR detected paymasterService, but the wallet-native paymaster executor is not enabled yet."
    );
  }


  /* =======================================================
     NORMAL NATIVE GAS FALLBACK
  ======================================================= */

  const execution =
    await executeStandardTransactions({
      provider,

      address:
        capability.address,

      calls
    });

  return {
    capability,
    execution
  };
}


/* =========================================================
   SAFE TEST
   0-value self-call
========================================================= */

export async function testTrorGasExecutor() {
  if (!window.ethereum) {
    throw new Error(
      "No Web3 wallet provider found."
    );
  }

  const accounts =
    await window.ethereum.request({
      method: "eth_accounts"
    });

  const address =
    accounts?.[0];

  if (!address) {
    throw new Error(
      "Connect your Web3 wallet first."
    );
  }

  const result =
    await executeTrorGasCalls({
      calls: [
        {
          to:
            address,

          value:
            0n
        }
      ]
    });

  console.log(
    "TROR gas executor test:",
    result
  );

  return result;
}