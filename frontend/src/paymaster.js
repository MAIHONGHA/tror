import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  maxUint256,
  erc20Abi,
  parseErc6492Signature,
  getContract,
  encodePacked
} from "viem";

import {
  arbitrumSepolia,
  avalancheFuji,
  baseSepolia,
  sepolia,
  optimismSepolia,
  unichainSepolia
} from "viem/chains";

import {
  arcTestnet,
  polygonAmoy
} from "./appkit.js";
import {
  createBundlerClient,
  toSimple7702SmartAccount
} from "viem/account-abstraction";

/* =========================================================
   CIRCLE PAYMASTER V0.7
========================================================= */

export const TROR_EIP2612_ABI = [
  ...erc20Abi,
  {
    inputs: [
      {
        internalType: "address",
        name: "owner",
        type: "address"
      }
    ],
    stateMutability: "view",
    type: "function",
    name: "nonces",
    outputs: [
      {
        internalType: "uint256",
        name: "",
        type: "uint256"
      }
    ]
  },
  {
    inputs: [],
    name: "version",
    outputs: [
      {
        internalType: "string",
        name: "",
        type: "string"
      }
    ],
    stateMutability: "view",
    type: "function"
  }
];

export async function getTrorUsdcPermitData({
  tokenAddress,
  ownerAddress,
  spenderAddress,
  permitAmount
}) {
  const {
    publicClient,
    config
  } = await createTrorPublicClient();

  const token =
    getContract({
      client: publicClient,
      address: tokenAddress,
      abi: TROR_EIP2612_ABI
    });

  const name =
    await token.read.name();

  const version =
    await token.read.version();

  const nonce =
    await token.read.nonces([
      ownerAddress
    ]);

  const permitData = {
    types: {
      EIP712Domain: [
        { name: "name", type: "string" },
        { name: "version", type: "string" },
        { name: "chainId", type: "uint256" },
        {
          name: "verifyingContract",
          type: "address"
        }
      ],

      Permit: [
        { name: "owner", type: "address" },
        { name: "spender", type: "address" },
        { name: "value", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" }
      ]
    },

    primaryType: "Permit",

    domain: {
      name,
      version,
      chainId: config.chain.id,
      verifyingContract: tokenAddress
    },

    message: {
      owner: ownerAddress,
      spender: spenderAddress,
      value: permitAmount.toString(),
      nonce: nonce.toString(),
      deadline: maxUint256.toString()
    }
  };

  console.log(
    "TROR USDC permit data:",
    {
      chainId: config.chain.id,
      chainName: config.name,
      tokenAddress,
      ownerAddress,
      spenderAddress,
      name,
      version,
      nonce: nonce.toString(),
      permitAmount:
        permitAmount.toString()
    }
  );

  return permitData;
}

export async function signTrorUsdcPermitWithConnectedWallet({
  tokenAddress,
  permitAmount
}) {
  if (!window.ethereum) {
    throw new Error(
      "No Web3 wallet provider found."
    );
  }

  const accounts =
    await window.ethereum.request({
      method: "eth_accounts"
    });

  const ownerAddress = accounts?.[0];

  if (!ownerAddress) {
    throw new Error(
      "Connect your Web3 wallet first."
    );
  }

  const chainIdHex =
    await window.ethereum.request({
      method: "eth_chainId"
    });

  const chainId =
    Number.parseInt(chainIdHex, 16);

  const config =
    TROR_GAS_CHAINS[chainId];

  if (!config) {
    throw new Error(
      `TROR gas config not found for chain ${chainId}.`
    );
  }

  const permitData =
    await getTrorUsdcPermitData({
      tokenAddress,
      ownerAddress,
      spenderAddress:
  CIRCLE_PAYMASTER_V07,
      permitAmount
    });

  const walletClient =
    createWalletClient({
      account: ownerAddress,
      chain: config.chain,
      transport: custom(window.ethereum)
    });

  const signature =
    await walletClient.signTypedData({
      account: ownerAddress,
      ...permitData
    });

  const publicClient =
    createPublicClient({
      chain: config.chain,
      transport: http(
        config.chain.rpcUrls.default.http[0]
      )
    });

  const isValid =
    await publicClient.verifyTypedData({
      ...permitData,
      address: ownerAddress,
      signature
    });

  console.log(
    "TROR connected-wallet USDC permit signature:",
    {
      ownerAddress,
      tokenAddress,
      spenderAddress:
        CIRCLE_PAYMASTER_V07,
      chainId,
      chainName: config.name,
      isValid,
      signature
    }
  );

  if (!isValid) {
    throw new Error(
      "TROR USDC permit signature verification failed."
    );
  }

  return {
    ownerAddress,
    signature,
    permitData,
    isValid
  };
}

/* =========================================================
   BUILD CIRCLE PAYMASTER V0.7 DATA
========================================================= */

export async function buildTrorCirclePaymasterData({
  tokenAddress,
  permitAmount
}) {
  const permitResult =
    await signTrorUsdcPermitWithConnectedWallet({
      tokenAddress,
      permitAmount
    });

  const {
    signature: permitSignature
  } = parseErc6492Signature(
    permitResult.signature
  );

  const paymasterData =
    encodePacked(
      [
        "uint8",
        "address",
        "uint256",
        "bytes"
      ],
      [
        0,
        tokenAddress,
        permitAmount,
        permitSignature
      ]
    );

  const result = {
    paymaster:
      CIRCLE_PAYMASTER_V07,

    paymasterData,

    paymasterVerificationGasLimit:
      200000n,

    paymasterPostOpGasLimit:
      15000n,

    isFinal: true
  };

  console.log(
    "TROR Circle Paymaster v0.7 data:",
    {
      paymaster:
        result.paymaster,

      tokenAddress,

      permitAmount:
        permitAmount.toString(),

      paymasterData:
        result.paymasterData,

      paymasterVerificationGasLimit:
        result.paymasterVerificationGasLimit.toString(),

      paymasterPostOpGasLimit:
        result.paymasterPostOpGasLimit.toString(),

      isFinal:
        result.isFinal
    }
  );

  return result;
}

export async function testTrorUsdcPermitMetadata() {
  const accounts =
    await window.ethereum.request({
      method: "eth_accounts"
    });

  const ownerAddress = accounts?.[0];

  if (!ownerAddress) {
    throw new Error(
      "Connect your Web3 wallet first."
    );
  }

  const chainIdHex =
    await window.ethereum.request({
      method: "eth_chainId"
    });

  const chainId =
    Number.parseInt(chainIdHex, 16);

  const tokenAddress =
    TROR_USDC_BY_CHAIN[chainId];

  if (!tokenAddress) {
    throw new Error(
      `TROR USDC address not configured for chain ${chainId}.`
    );
  }

  const permitData =
    await getTrorUsdcPermitData({
      tokenAddress,
      ownerAddress,
      spenderAddress:
        CIRCLE_PAYMASTER_V07,
      permitAmount:
        maxUint256
    });

  console.log(
    "TROR USDC permit metadata test:",
    {
      chainId,
      tokenAddress,
      ownerAddress,
      spender:
        CIRCLE_PAYMASTER_V07,
      domain:
        permitData.domain,
      nonce:
        permitData.message.nonce
    }
  );

  return permitData;
}

export const CIRCLE_PAYMASTER_V07 =
  "0x31BE08D380A21fc740883c0BC434FcFc88740b58";

export const CIRCLE_PAYMASTER_V08 =
  "0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966";

export function getTrorBundlerUrl(chainId) {
  return `https://public.pimlico.io/v2/${chainId}/rpc`;
}

export async function createTrorBundlerClient() {
  const config =
    await getCurrentTrorGasChain();

  if (config.gasMode !== "circle-paymaster") {
    throw new Error(
      "Current chain does not use Circle Paymaster."
    );
  }

  const publicClient =
    createPublicClient({
      chain: config.chain,
      transport: http(
        config.chain.rpcUrls.default.http[0]
      )
    });

  const bundlerClient =
    createBundlerClient({
      client: publicClient,
      transport: http(
        getTrorBundlerUrl(config.chain.id)
      )
    });

  console.log(
    "TROR bundler client ready:",
    {
      chainId: config.chain.id,
      chainName: config.name,
      bundlerUrl:
        getTrorBundlerUrl(config.chain.id)
    }
  );

  return {
    bundlerClient,
    publicClient,
    config
  };
}

export async function testTrorBundlerConnection() {
  const {
    bundlerClient,
    config
  } = await createTrorBundlerClient();

  const chainId =
    await bundlerClient.getChainId();

  const entryPoints =
    await bundlerClient.getSupportedEntryPoints();

  const result = {
    expectedChainId: config.chain.id,
    bundlerChainId: chainId,
    chainName: config.name,
    entryPoints
  };

  console.log(
    "TROR Bundler connection test:",
    result
  );

  return result;
}

/* =========================================================
   TROR WEB3 GAS CONFIG
========================================================= */

export const TROR_GAS_CHAINS = {
  5042002: {
    chain: arcTestnet,
    name: "Arc Testnet",
    gasMode: "native-usdc",
    gatewayChain: "arcTestnet"
  },

  11155111: {
    chain: sepolia,
    name: "Ethereum Sepolia",
    gasMode: "circle-paymaster",
    gatewayChain: "sepolia"
  },

  84532: {
    chain: baseSepolia,
    name: "Base Sepolia",
    gasMode: "circle-paymaster",
    gatewayChain: "baseSepolia"
  },

  421614: {
    chain: arbitrumSepolia,
    name: "Arbitrum Sepolia",
    gasMode: "circle-paymaster",
    gatewayChain: "arbitrumSepolia"
  },

  43113: {
    chain: avalancheFuji,
    name: "Avalanche Fuji",
    gasMode: "circle-paymaster",
    gatewayChain: "avalancheFuji"
  },

  11155420: {
    chain: optimismSepolia,
    name: "Optimism Sepolia",
    gasMode: "circle-paymaster",
    gatewayChain: "optimismSepolia"
  },

  80002: {
    chain: polygonAmoy,
    name: "Polygon Amoy",
    gasMode: "circle-paymaster",
    gatewayChain: "polygonAmoy"
  },

  1301: {
    chain: unichainSepolia,
    name: "Unichain Sepolia",
    gasMode: "circle-paymaster",
    gatewayChain: "unichainSepolia"
  }
};

export const TROR_USDC_BY_CHAIN = {
  421614: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d",
  80002: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
  84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
  11155111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  43113: "0x5425890298aed601595a70AB815c96711a31Bc65",
  11155420: "0x5fd84259d66Cd46123540766Be93DFE6D43130D7",
  5042002: "0x3600000000000000000000000000000000000000"
};

/* =========================================================
   GET CURRENT CONNECTED WEB3 CHAIN
========================================================= */

export async function getCurrentTrorGasChain() {
  if (!window.ethereum) {
    throw new Error("No Web3 wallet provider found.");
  }

  const chainIdHex =
    await window.ethereum.request({
      method: "eth_chainId"
    });

  const chainId =
    Number.parseInt(chainIdHex, 16);

  const config =
    TROR_GAS_CHAINS[chainId];

  if (!config) {
    throw new Error(
      `TROR USDC gas is not configured for chain ${chainId}.`
    );
  }

  return {
    chainId,
    ...config
  };
}

/* =========================================================
   CREATE BROWSER WALLET CLIENT
========================================================= */

export async function createTrorBrowserWalletClient() {
  if (!window.ethereum) {
    throw new Error("No Web3 wallet provider found.");
  }

  const config =
    await getCurrentTrorGasChain();

  const walletClient =
    createWalletClient({
      chain: config.chain,
      transport: custom(window.ethereum)
    });

  let addresses =
    await walletClient.getAddresses();

  if (!addresses?.length) {
    addresses =
      await walletClient.requestAddresses();
  }

  const address = addresses?.[0];

  if (!address) {
    throw new Error(
      "Connect your Web3 wallet first."
    );
  }

  return {
    walletClient,
    address,
    config
  };
}

/* =========================================================
   CREATE PUBLIC CLIENT
========================================================= */

export async function createTrorPublicClient() {
  const config =
    await getCurrentTrorGasChain();

  const publicClient =
    createPublicClient({
      chain: config.chain,
      transport: http(
        config.chain.rpcUrls.default.http[0]
      )
    });

  return {
    publicClient,
    config
  };
}

export async function getTrorWalletCapabilities() {
  if (!window.ethereum) {
    throw new Error("No Web3 wallet provider found.");
  }

  const accounts =
    await window.ethereum.request({
      method: "eth_accounts"
    });

  const address = accounts?.[0];

  if (!address) {
    throw new Error(
      "Connect your Web3 wallet first."
    );
  }

  const chainIdHex =
    await window.ethereum.request({
      method: "eth_chainId"
    });

  let capabilities = null;

  try {
    capabilities =
      await window.ethereum.request({
        method: "wallet_getCapabilities",
        params: [address]
      });
  } catch (error) {
    console.warn(
      "TROR: wallet_getCapabilities not supported:",
      error
    );
  }

  console.log(
    "TROR Web3 wallet capabilities:",
    {
      address,
      chainIdHex,
      capabilities
    }
  );

  return {
    address,
    chainIdHex,
    capabilities
  };
}

/* =========================================================
   CHECK WEB3 WALLET CAPABILITIES
========================================================= */

export async function checkTrorWeb3Capabilities() {
  const {
    walletClient,
    address,
    config
  } = await createTrorBrowserWalletClient();

  let capabilities = null;

  try {
    capabilities =
      await walletClient.getCapabilities({
        account: address,
        chainId: config.chain.id
      });
  } catch (error) {
    console.warn(
      "TROR wallet capabilities unavailable:",
      error
    );
  }

  console.log(
    "TROR Web3 capability check:",
    {
      address,
      chainId: config.chain.id,
      chainName: config.name,
      gasMode: config.gasMode,
      capabilities
    }
  );

  return {
    address,
    chainId: config.chain.id,
    chainName: config.name,
    gasMode: config.gasMode,
    capabilities
  };
}


/* =========================================================
   ANALYZE CONNECTED WALLET GAS CAPABILITIES
========================================================= */

export async function analyzeTrorWeb3GasCapabilities() {
  const {
    walletClient,
    address,
    config
  } = await createTrorBrowserWalletClient();

  let capabilities = null;

  try {
    capabilities =
      await walletClient.getCapabilities({
        account: address,
        chainId: config.chain.id
      });
  } catch (error) {
    console.warn(
      "TROR wallet capability analysis failed:",
      error
    );
  }

  const chainHex =
    `0x${config.chain.id.toString(16)}`;

  const chainCapabilities =
    capabilities?.[chainHex] ||
    capabilities ||
    {};

  const atomicReady =
    chainCapabilities?.atomic?.status === "ready";

  const paymasterService =
    chainCapabilities?.paymasterService || null;

  const result = {
    address,
    chainId: config.chain.id,
    chainName: config.name,
    gasMode: config.gasMode,

    atomicReady,

    paymasterServiceAvailable:
      Boolean(paymasterService),

    paymasterService,

    rawCapabilities:
      capabilities
  };

  console.log(
    "TROR Web3 gas capability analysis:",
    result
  );

  return result;
}

/* =========================================================
   CHECK EIP-7702 BROWSER WALLET SUPPORT
========================================================= */

export async function checkTror7702BrowserSupport() {
  if (!window.ethereum) {
    throw new Error(
      "No Web3 wallet provider found."
    );
  }

  const accounts =
    await window.ethereum.request({
      method: "eth_accounts"
    });

  const address = accounts?.[0];

  if (!address) {
    throw new Error(
      "Connect your Web3 wallet first."
    );
  }

  const chainIdHex =
    await window.ethereum.request({
      method: "eth_chainId"
    });

  const chainId =
    Number.parseInt(chainIdHex, 16);

  const config =
    TROR_GAS_CHAINS[chainId];

  if (!config) {
    throw new Error(
      `TROR gas config not found for chain ${chainId}.`
    );
  }

  let capabilities = null;

  try {
    capabilities =
      await window.ethereum.request({
        method: "wallet_getCapabilities",
        params: [address]
      });
  } catch (error) {
    console.warn(
      "TROR wallet_getCapabilities unavailable:",
      error
    );
  }

  const chainHex =
    `0x${chainId.toString(16)}`;

  const chainCapabilities =
    capabilities?.[chainHex] ||
    capabilities ||
    {};

  const atomicReady =
    chainCapabilities?.atomic?.status ===
    "ready";

  const result = {
    address,
    chainId,
    chainName: config.name,
    gasMode: config.gasMode,

    atomicReady,

    eip7702Candidate:
      config.gasMode ===
        "circle-paymaster" &&
      atomicReady,

    capabilities
  };

  console.log(
    "TROR EIP-7702 browser support:",
    result
  );

  return result;
}

/* =========================================================
   CHECK EIP-7702 AUTHORIZATION RPC
========================================================= */

export async function checkTror7702AuthorizationRpc() {
  if (!window.ethereum) {
    throw new Error(
      "No Web3 wallet provider found."
    );
  }

  const accounts =
    await window.ethereum.request({
      method: "eth_accounts"
    });

  const address = accounts?.[0];

  if (!address) {
    throw new Error(
      "Connect your Web3 wallet first."
    );
  }

  const chainIdHex =
    await window.ethereum.request({
      method: "eth_chainId"
    });

  const chainId =
    Number.parseInt(chainIdHex, 16);

  const config =
    TROR_GAS_CHAINS[chainId];

  if (!config) {
    throw new Error(
      `TROR gas config not found for chain ${chainId}.`
    );
  }

  console.log(
    "TROR 7702 authorization RPC probe:",
    {
      address,
      chainId,
      chainName: config.name
    }
  );

  return {
    address,
    chainId,
    chainName: config.name,
    providerAvailable: true
  };
}

/* =========================================================
   CREATE SAME-ADDRESS 7702 ACCOUNT
========================================================= */

export async function createTror7702Account() {
  if (!window.ethereum) {
    throw new Error(
      "No Web3 wallet provider found."
    );
  }

  const accounts =
    await window.ethereum.request({
      method: "eth_accounts"
    });

  const address = accounts?.[0];

  if (!address) {
    throw new Error(
      "Connect your Web3 wallet first."
    );
  }

  const chainIdHex =
    await window.ethereum.request({
      method: "eth_chainId"
    });

  const chainId =
    Number.parseInt(chainIdHex, 16);

  const config =
    TROR_GAS_CHAINS[chainId];

  if (!config) {
    throw new Error(
      `TROR gas config not found for chain ${chainId}.`
    );
  }

  if (config.gasMode === "native-usdc") {
    return {
      mode: "native-usdc",
      address,
      chainId,
      chainName: config.name
    };
  }

  /*
    JSON-RPC owner:
    signing remains inside MetaMask / connected wallet.
  */
  const ownerClient =
    createWalletClient({
      account: address,
      chain: config.chain,
      transport: custom(window.ethereum)
    });

  const publicClient =
    createPublicClient({
      chain: config.chain,
      transport: http(
        config.chain.rpcUrls.default.http[0]
      )
    });

  const account =
    await toSimple7702SmartAccount({
      client: publicClient,
      owner: ownerClient.account
    });

console.log(
  "TROR 7702 signer inspection:",
  {
    ownerType:
      ownerClient.account?.type,

    ownerAddress:
      ownerClient.account?.address,

    smartAccountAddress:
      account.address,

    authorizationAddress:
      account.authorization?.address,

    hasSignAuthorization:
      typeof ownerClient.account
        ?.signAuthorization === "function"
  }
);

  const result = {
    mode: "eip7702",
    ownerAddress: address,
    smartAccountAddress: account.address,
    sameAddress:
      String(account.address).toLowerCase() ===
      String(address).toLowerCase(),
    chainId,
    chainName: config.name,
    account
  };

  console.log(
    "TROR 7702 same-address account:",
    {
      ownerAddress: result.ownerAddress,
      smartAccountAddress:
        result.smartAccountAddress,
      sameAddress: result.sameAddress,
      chainId: result.chainId,
      chainName: result.chainName
    }
  );

  return result;
}

export async function inspectTrorWalletProvider() {
  if (!window.ethereum) {
    throw new Error("Wallet provider not found.");
  }

  const accounts = await window.ethereum.request({
    method: "eth_accounts"
  });

  const chainId = await window.ethereum.request({
    method: "eth_chainId"
  });

  const result = {
    address: accounts?.[0] || null,
    chainId,
    provider: "window.ethereum",
    hasRequest: typeof window.ethereum.request === "function",
    isMetaMask: Boolean(window.ethereum.isMetaMask)
  };

  console.log(
    "TROR wallet provider inspection:",
    result
  );

  return result;
}

export async function inspectTrorAtomicCapabilities() {
  if (!window.ethereum) {
    throw new Error("Wallet provider not found.");
  }

  const accounts =
    await window.ethereum.request({
      method: "eth_accounts"
    });

  const address = accounts?.[0];

  if (!address) {
    throw new Error(
      "Connect your Web3 wallet first."
    );
  }

  const capabilities =
    await window.ethereum.request({
      method: "wallet_getCapabilities",
      params: [address]
    });

  const chainIdHex =
    await window.ethereum.request({
      method: "eth_chainId"
    });

  const chainCaps =
    capabilities?.[chainIdHex] || {};

  const result = {
    address,
    chainIdHex,

    atomic:
      chainCaps?.atomic || null,

    alternateGasFees:
      chainCaps?.alternateGasFees || null,

    auxiliaryFunds:
      chainCaps?.auxiliaryFunds || null,

    raw:
      chainCaps
  };

  console.log(
    "TROR atomic capability detail:",
    result
  );

  return result;
}

export async function inspectTror7702RpcSupport() {
  if (!window.ethereum) {
    throw new Error("Wallet provider not found.");
  }

  const accounts = await window.ethereum.request({
    method: "eth_accounts"
  });

  const address = accounts?.[0];

  if (!address) {
    throw new Error("Connect your Web3 wallet first.");
  }

  const chainId = await window.ethereum.request({
    method: "eth_chainId"
  });

  const capabilities =
    await window.ethereum.request({
      method: "wallet_getCapabilities",
      params: [address]
    });

  const chainCapabilities =
    capabilities?.[chainId] || {};

  const result = {
    address,
    chainId,

    atomic:
      chainCapabilities?.atomic || null,

    alternateGasFees:
      chainCapabilities?.alternateGasFees || null,

    auxiliaryFunds:
      chainCapabilities?.auxiliaryFunds || null,

    hasWalletSendCalls:
      typeof window.ethereum.request === "function",

    provider:
      window.ethereum.isMetaMask
        ? "MetaMask"
        : "EIP-1193"
  };

  console.log(
    "TROR 7702 RPC inspection:",
    result
  );

  return result;
}

/* =========================================================
   TEST CONNECTED WALLET EIP-7702 AUTHORIZATION
========================================================= */

export async function testTrorConnected7702Authorization() {
  if (!window.ethereum) {
    throw new Error(
      "No Web3 wallet provider found."
    );
  }

  const accounts =
    await window.ethereum.request({
      method: "eth_accounts"
    });

  const address = accounts?.[0];

  if (!address) {
    throw new Error(
      "Connect your Web3 wallet first."
    );
  }

  const chainIdHex =
    await window.ethereum.request({
      method: "eth_chainId"
    });

  const chainId =
    Number.parseInt(chainIdHex, 16);

  const config =
    TROR_GAS_CHAINS[chainId];

  if (!config) {
    throw new Error(
      `TROR gas config not found for chain ${chainId}.`
    );
  }

  if (config.gasMode !== "circle-paymaster") {
    throw new Error(
      "This chain is not configured for Circle Paymaster."
    );
  }

  /*
    Important:
    same connected MetaMask address.
    No new wallet and no private key.
  */
  const ownerClient =
    createWalletClient({
      account: address,
      chain: config.chain,
      transport: custom(window.ethereum)
    });

  const publicClient =
    createPublicClient({
      chain: config.chain,
      transport: http(
        config.chain.rpcUrls.default.http[0]
      )
    });

  const account =
    await toSimple7702SmartAccount({
      client: publicClient,
      owner: ownerClient.account
    });

  console.log(
    "TROR connected 7702 authorization test:",
    {
      ownerAddress:
        ownerClient.account?.address,

      smartAccountAddress:
        account.address,

      sameAddress:
        String(account.address).toLowerCase() ===
        String(address).toLowerCase(),

      authorizationAddress:
        account.authorization?.address,

      ownerType:
        ownerClient.account?.type,

      chainId,
      chainName:
        config.name
    }
  );

  try {
    const authorization =
      await ownerClient.signAuthorization({
        account: ownerClient.account,
        contractAddress:
          account.authorization.address,
        chainId
      });

    console.log(
      "TROR connected-wallet 7702 authorization:",
      authorization
    );

    return {
      supported: true,
      address,
      authorization
    };
  } catch (error) {
    console.warn(
      "TROR connected-wallet 7702 authorization unavailable:",
      error
    );

    return {
      supported: false,

      error:
        error?.shortMessage ||
        error?.message ||
        String(error)
    };
  }
}

export async function testTrorWalletSendCalls() {
  if (!window.ethereum) {
    throw new Error("No browser wallet provider.");
  }

  const accounts = await window.ethereum.request({
    method: "eth_accounts"
  });

  const address = accounts?.[0];

  if (!address) {
    throw new Error("Connect wallet first.");
  }

  const chainId = await window.ethereum.request({
    method: "eth_chainId"
  });

  console.log("TROR wallet_sendCalls test:", {
    address,
    chainId
  });

  try {
    const result = await window.ethereum.request({
      method: "wallet_sendCalls",
      params: [
        {
          version: "2.0.0",
          from: address,
          chainId,
          atomicRequired: true,
          calls: []
        }
      ]
    });

    console.log(
      "TROR wallet_sendCalls result:",
      result
    );

    return {
      supported: true,
      result
    };
  } catch (error) {
    console.warn(
      "TROR wallet_sendCalls unavailable:",
      error
    );

    return {
      supported: false,
      error: error?.message || String(error)
    };
  }
}