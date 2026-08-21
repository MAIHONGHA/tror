import {
  arcTestnet
} from "./appkit.js";

import {
  baseSepolia,
  arbitrumSepolia
} from "viem/chains";


/* =========================================================
   TROR GAS MODE CONSTANTS
========================================================= */

export const TROR_GAS_MODE = {
  NATIVE_USDC: "native-usdc",
  WALLET_SPONSORED: "wallet-sponsored",
  CIRCLE_PAYMASTER: "circle-paymaster",
  NATIVE_GAS: "native-gas"
};


/* =========================================================
   GET CONNECTED ACCOUNT
========================================================= */

async function getConnectedAddress(provider) {
  const accounts =
    await provider.request({
      method: "eth_accounts"
    });

  return accounts?.[0] || null;
}


/* =========================================================
   GET CURRENT CHAIN
========================================================= */

async function getCurrentChainId(provider) {
  const chainIdHex =
    await provider.request({
      method: "eth_chainId"
    });

  return {
    chainIdHex,
    chainId:
      Number.parseInt(
        chainIdHex,
        16
      )
  };
}


/* =========================================================
   GET WALLET CAPABILITIES
========================================================= */

async function getWalletCapabilities(
  provider,
  address
) {
  if (!address) {
    return null;
  }

  try {
    return await provider.request({
      method: "wallet_getCapabilities",
      params: [address]
    });
  } catch (error) {
    console.warn(
      "TROR wallet capabilities unavailable:",
      error
    );

    return null;
  }
}


/* =========================================================
   DETECT WALLET
========================================================= */

function detectWallet(provider) {
  if (provider?.isMetaMask) {
    return "MetaMask";
  }

  return "EIP-1193";
}


/* =========================================================
   MAIN GAS CAPABILITY DETECTOR
========================================================= */

export async function getTrorGasCapability({
  provider = window.ethereum
} = {}) {
  if (!provider) {
    throw new Error(
      "No connected Web3 wallet provider found."
    );
  }

  const address =
    await getConnectedAddress(
      provider
    );

  if (!address) {
    throw new Error(
      "Connect your Web3 wallet first."
    );
  }

  const {
    chainId,
    chainIdHex
  } =
    await getCurrentChainId(
      provider
    );

  const capabilities =
    await getWalletCapabilities(
      provider,
      address
    );

  const chainCapabilities =
    capabilities?.[chainIdHex] || {};

  const atomicStatus =
    chainCapabilities?.atomic
      ?.status || null;

  const atomicSupported =
    atomicStatus === "ready" ||
    atomicStatus === "supported";

  const alternateGasFeesSupported =
    chainCapabilities
      ?.alternateGasFees
      ?.supported === true;

  const paymasterService =
    chainCapabilities
      ?.paymasterService || null;

  const paymasterServiceAvailable =
    Boolean(paymasterService);

  let gasMode =
    TROR_GAS_MODE.NATIVE_GAS;

  let reason =
    "Wallet will use the native gas token.";

  /*
    Arc:
    Native USDC is the gas token.
  */
  if (
    chainId === arcTestnet.id
  ) {
    gasMode =
      TROR_GAS_MODE.NATIVE_USDC;

    reason =
      "Arc uses native USDC for gas.";
  }

  /*
    Wallet-native sponsorship / alternate gas.

    This is the path we verified on
    MetaMask + Base Sepolia.
  */
  else if (
    atomicSupported &&
    alternateGasFeesSupported
  ) {
    gasMode =
      TROR_GAS_MODE.WALLET_SPONSORED;

    reason =
      "Connected wallet supports wallet-native alternate gas fees.";
  }

  /*
    Standard wallet paymaster capability.
    Use this only when the wallet actually
    advertises paymasterService.
  */
  else if (
    atomicSupported &&
    paymasterServiceAvailable
  ) {
    gasMode =
      TROR_GAS_MODE.CIRCLE_PAYMASTER;

    reason =
      "Connected wallet exposes a paymaster service capability.";
  }

  const result = {
    address,

    wallet:
      detectWallet(provider),

    chainId,

    chainIdHex,

    chainName:
      chainId === arcTestnet.id
        ? "Arc Testnet"
        : chainId === baseSepolia.id
          ? "Base Sepolia"
          : chainId === arbitrumSepolia.id
            ? "Arbitrum Sepolia"
            : "Unknown / Other EVM",

    atomicStatus,

    atomicSupported,

    alternateGasFeesSupported,

    paymasterServiceAvailable,

    paymasterService,

    gasMode,

    reason,

    rawCapabilities:
      chainCapabilities
  };

  console.log(
    "TROR gas capability:",
    result
  );

  return result;
}


/* =========================================================
   TEST HELPER
========================================================= */

export async function testTrorGasCapability() {
  return await getTrorGasCapability();
}