import {
  Implementation,
  toMetaMaskSmartAccount,
  getSmartAccountsEnvironment
} from "@metamask/smart-accounts-kit";

import {
  createPublicClient,
  createWalletClient,
  custom,
  http
} from "viem";

import {
  arbitrumSepolia,
  baseSepolia
} from "viem/chains";

import {
  createBundlerClient
} from "viem/account-abstraction";

import {
  isValid7702Implementation
} from "@metamask/smart-accounts-kit/actions";

import {
  buildTrorCirclePaymasterData,
  TROR_USDC_BY_CHAIN
} from "./paymaster.js";

/* =========================================================
   TROR 7702 SUPPORTED CHAINS
========================================================= */

const TROR_7702_CHAINS = {
  [arbitrumSepolia.id]: arbitrumSepolia,
  [baseSepolia.id]: baseSepolia
};


/* =========================================================
   GET CURRENT CONNECTED CHAIN
========================================================= */

async function getTror7702ActiveChain() {
  if (!window.ethereum) {
    throw new Error(
      "MetaMask provider not found."
    );
  }

  const chainIdHex =
    await window.ethereum.request({
      method: "eth_chainId"
    });

  const chainId =
    Number.parseInt(chainIdHex, 16);

  const activeChain =
    TROR_7702_CHAINS[chainId];

  if (!activeChain) {
    throw new Error(
      "Switch MetaMask to Arbitrum Sepolia or Base Sepolia."
    );
  }

  return {
    chainId,
    activeChain
  };
}


/* =========================================================
   CREATE / INSPECT METAMASK STATELESS 7702 ACCOUNT
========================================================= */

export async function testTrorMetaMask7702Account() {
  if (!window.ethereum) {
    throw new Error(
      "MetaMask provider not found."
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
      "Connect MetaMask first."
    );
  }

  const {
    chainId,
    activeChain
  } =
    await getTror7702ActiveChain();

  const publicClient =
    createPublicClient({
      chain: activeChain,
      transport: http()
    });

  const walletClient =
    createWalletClient({
      account: address,
      chain: activeChain,
      transport:
        custom(window.ethereum)
    });

  const environment =
    getSmartAccountsEnvironment(
      activeChain.id
    );

  console.log(
    "TROR MetaMask 7702 environment:",
    environment
  );

  const smartAccount =
    await toMetaMaskSmartAccount({
      client: publicClient,

      implementation:
        Implementation.Stateless7702,

      address,

      signer: {
        walletClient
      }
    });

  const result = {
    connectedAddress:
      address,

    smartAccountAddress:
      smartAccount.address,

    sameAddress:
      String(address)
        .toLowerCase() ===
      String(
        smartAccount.address
      ).toLowerCase(),

    chainId,

    chainName:
      activeChain.name,

    implementation:
      "Stateless7702"
  };

  console.log(
    "TROR MetaMask Stateless7702 test:",
    result
  );

  return {
    ...result,
    smartAccount
  };
}


/* =========================================================
   INSPECT SMART ACCOUNT METHODS
========================================================= */

export async function inspectTrorMetaMask7702Account() {
  const result =
    await testTrorMetaMask7702Account();

  const account =
    result.smartAccount;

  const inspection = {
    address:
      account.address,

    hasEncodeCalls:
      typeof account.encodeCalls ===
      "function",

    hasGetNonce:
      typeof account.getNonce ===
      "function",

    hasGetStubSignature:
      typeof account.getStubSignature ===
      "function",

    hasSignUserOperation:
      typeof account.signUserOperation ===
      "function",

    hasSignAuthorization:
      typeof account.signAuthorization ===
      "function"
  };

  console.log(
    "TROR Stateless7702 account inspection:",
    inspection
  );

  return inspection;
}


/* =========================================================
   TEST USER OPERATION PRIMITIVES
========================================================= */

export async function testTror7702UserOpPrimitives() {
  const result =
    await testTrorMetaMask7702Account();

  const account =
    result.smartAccount;

  const nonce =
    await account.getNonce();

  const callData =
    await account.encodeCalls([
      {
        to:
          account.address,

        value:
          0n,

        data:
          "0x"
      }
    ]);

  const test = {
    address:
      account.address,

    nonce:
      nonce.toString(),

    callData,

    callDataValid:
      typeof callData ===
        "string" &&
      callData.startsWith("0x")
  };

  console.log(
    "TROR 7702 UserOp primitives:",
    test
  );

  return test;
}


/* =========================================================
   TEST STUB SIGNATURE
========================================================= */

export async function testTror7702StubSignature() {
  const result =
    await testTrorMetaMask7702Account();

  const account =
    result.smartAccount;

  const stubSignature =
    await account.getStubSignature();

  const test = {
    address:
      account.address,

    stubSignature,

    valid:
      typeof stubSignature ===
        "string" &&
      stubSignature.startsWith("0x") &&
      stubSignature.length > 2
  };

  console.log(
    "TROR 7702 stub signature test:",
    test
  );

  return test;
}


/* =========================================================
   TEST BUNDLER PREPARE USER OPERATION
========================================================= */

export async function testTror7702BundlerPrepare() {
  const result =
    await testTrorMetaMask7702Account();

  const account =
    result.smartAccount;

  const {
    activeChain
  } =
    await getTror7702ActiveChain();

  const publicClient =
    createPublicClient({
      chain:
        activeChain,

      transport:
        http()
    });

  const bundlerClient =
    createBundlerClient({
      account,

      client:
        publicClient,

      transport:
        http(
          `https://public.pimlico.io/v2/${activeChain.id}/rpc`
        )
    });

  const userOperation =
    await bundlerClient.prepareUserOperation({
      account,

      calls: [
        {
          to:
            account.address,

          value:
            0n
        }
      ]
    });

  const test = {
    sender:
      userOperation.sender,

    nonce:
      userOperation.nonce
        ?.toString(),

    callData:
      userOperation.callData,

    callGasLimit:
      userOperation.callGasLimit
        ?.toString(),

    verificationGasLimit:
      userOperation.verificationGasLimit
        ?.toString(),

    preVerificationGas:
      userOperation.preVerificationGas
        ?.toString(),

    maxFeePerGas:
      userOperation.maxFeePerGas
        ?.toString(),

    maxPriorityFeePerGas:
      userOperation.maxPriorityFeePerGas
        ?.toString(),

    signature:
      userOperation.signature
  };

  console.log(
    "TROR Stateless7702 prepared UserOperation:",
    test
  );

  return {
    test,
    userOperation
  };
}


/* =========================================================
   TEST DEPLOYMENT STATE
========================================================= */

export async function testTror7702DeploymentState() {
  const result =
    await testTrorMetaMask7702Account();

  const account =
    result.smartAccount;

  const isDeployed =
    await account.isDeployed();

  const test = {
    address:
      account.address,

    sameAddress:
      result.sameAddress,

    chainId:
      result.chainId,

    chainName:
      result.chainName,

    implementation:
      result.implementation,

    isDeployed
  };

  console.log(
    "TROR Stateless7702 deployment state:",
    test
  );

  return test;
}


/* =========================================================
   VALIDATE EIP-7702 IMPLEMENTATION
========================================================= */

export async function testTrorValid7702Implementation() {
  const result =
    await testTrorMetaMask7702Account();

  const {
    activeChain
  } =
    await getTror7702ActiveChain();

  const publicClient =
    createPublicClient({
      chain:
        activeChain,

      transport:
        http()
    });

  const environment =
    getSmartAccountsEnvironment(
      activeChain.id
    );

  const isValid =
    await isValid7702Implementation({
      client:
        publicClient,

      accountAddress:
        result.connectedAddress,

      environment
    });

  const test = {
    address:
      result.connectedAddress,

    smartAccountAddress:
      result.smartAccountAddress,

    sameAddress:
      result.sameAddress,

    chainId:
      result.chainId,

    chainName:
      result.chainName,

    isValid7702Implementation:
      isValid
  };

  console.log(
    "TROR valid 7702 implementation test:",
    test
  );

  return test;
}


/* =========================================================
   READ EIP-7702 DELEGATION CODE DIRECTLY
========================================================= */

export async function testTror7702CodeViaPublicClient() {
  const result =
    await testTrorMetaMask7702Account();

  const {
    activeChain
  } =
    await getTror7702ActiveChain();

  const publicClient =
    createPublicClient({
      chain:
        activeChain,

      transport:
        http()
    });

  const code =
    await publicClient.getCode({
      address:
        result.connectedAddress
    });

  const normalizedCode =
    String(code || "0x")
      .toLowerCase();

  const test = {
    address:
      result.connectedAddress,

    chainId:
      result.chainId,

    chainName:
      result.chainName,

    code:
      code || "0x",

    hasDelegation:
      Boolean(
        code &&
        code !== "0x"
      ),

    is7702Designator:
      normalizedCode
        .startsWith(
          "0xef0100"
        )
  };

  console.log(
    "TROR 7702 public code test:",
    test
  );

  return test;
}

export async function testTror7702CirclePaymasterPrepare() {
  const result =
    await testTrorMetaMask7702Account();

  const account =
    result.smartAccount;

  const {
    activeChain
  } =
    await getTror7702ActiveChain();

  const tokenAddress =
    TROR_USDC_BY_CHAIN[
      activeChain.id
    ];

  if (!tokenAddress) {
    throw new Error(
      `TROR USDC not configured for chain ${activeChain.id}.`
    );
  }

  const publicClient =
    createPublicClient({
      chain: activeChain,
      transport: http()
    });

  const paymaster = {
    async getPaymasterData() {
      return await buildTrorCirclePaymasterData({
        tokenAddress,
        permitAmount: 10000000n
      });
    }
  };

  const bundlerClient =
    createBundlerClient({
      account,
      client: publicClient,
      paymaster,

      transport: http(
        `https://public.pimlico.io/v2/${activeChain.id}/rpc`
      )
    });

  const userOperation =
    await bundlerClient.prepareUserOperation({
      account,

      calls: [
        {
          to: account.address,
          value: 0n
        }
      ]
    });

  const test = {
    chainId:
      activeChain.id,

    chainName:
      activeChain.name,

    sender:
      userOperation.sender,

    paymaster:
      userOperation.paymaster,

    paymasterData:
      userOperation.paymasterData,

    paymasterVerificationGasLimit:
      userOperation
        .paymasterVerificationGasLimit
        ?.toString(),

    paymasterPostOpGasLimit:
      userOperation
        .paymasterPostOpGasLimit
        ?.toString(),

    callGasLimit:
      userOperation
        .callGasLimit
        ?.toString(),

    verificationGasLimit:
      userOperation
        .verificationGasLimit
        ?.toString(),

    preVerificationGas:
      userOperation
        .preVerificationGas
        ?.toString()
  };

  console.log(
    "TROR 7702 + Circle Paymaster prepared UserOperation:",
    test
  );

  return {
    test,
    userOperation
  };
}

export async function testTror7702CirclePaymasterSend() {
  const result =
    await testTrorMetaMask7702Account();

  const account =
    result.smartAccount;

  const {
    activeChain
  } =
    await getTror7702ActiveChain();

  const tokenAddress =
    TROR_USDC_BY_CHAIN[
      activeChain.id
    ];

  if (!tokenAddress) {
    throw new Error(
      `TROR USDC not configured for chain ${activeChain.id}.`
    );
  }

  const publicClient =
    createPublicClient({
      chain: activeChain,
      transport: http()
    });

  const paymaster = {
    async getPaymasterData() {
      return await buildTrorCirclePaymasterData({
        tokenAddress,
        permitAmount: 10000000n
      });
    }
  };

  const bundlerClient =
    createBundlerClient({
      account,
      client: publicClient,
      paymaster,

      transport: http(
        `https://public.pimlico.io/v2/${activeChain.id}/rpc`
      )
    });

  console.log(
    "TROR sending 7702 + Circle Paymaster UserOperation:",
    {
      chainId: activeChain.id,
      chainName: activeChain.name,
      sender: account.address,
      tokenAddress
    }
  );

  const userOperationHash =
    await bundlerClient.sendUserOperation({
      account,

      calls: [
        {
          to: account.address,
          value: 0n
        }
      ]
    });

  console.log(
    "TROR UserOperation hash:",
    userOperationHash
  );

  const receipt =
    await bundlerClient.waitForUserOperationReceipt({
      hash: userOperationHash
    });

  console.log(
    "TROR UserOperation receipt:",
    receipt
  );

  return {
    chainId: activeChain.id,
    chainName: activeChain.name,
    sender: account.address,
    userOperationHash,
    receipt
  };
}

export async function inspectTror7702SigningPath() {
  const result =
    await testTrorMetaMask7702Account();

  const account =
    result.smartAccount;

  const inspection = {
    address:
      account.address,

    sameAddress:
      result.sameAddress,

    chainId:
      result.chainId,

    chainName:
      result.chainName,

    hasSignUserOperation:
      typeof account.signUserOperation ===
      "function",

    hasSignTypedData:
      typeof account.signTypedData ===
      "function",

    hasSignMessage:
      typeof account.signMessage ===
      "function",

    hasSignAuthorization:
      typeof account.signAuthorization ===
      "function",

    accountKeys:
      Object.keys(account),

    accountPrototype:
      Object.getOwnPropertyNames(
        Object.getPrototypeOf(account)
      )
  };

  console.log(
    "TROR 7702 signing path inspection:",
    inspection
  );

  return inspection;
}