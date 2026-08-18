import {
  createPublicClient,
  createWalletClient,
  custom,
  http
} from "viem";

import {
  arbitrumSepolia,
  avalancheFuji,
  baseSepolia,
  sepolia,
  optimismSepolia,
  polygonAmoy,
  unichainSepolia
} from "viem/chains";

import { arcTestnet } from "./appkit.js";

/* =========================================================
   CIRCLE PAYMASTER V0.8
========================================================= */

export const CIRCLE_PAYMASTER_V08 =
  "0x3BA9A96eE3eFf3A69E2B18886AcF52027EFF8966";

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