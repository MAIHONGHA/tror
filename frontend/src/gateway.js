import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

export const trorCircleKit = new AppKit();

/* =========================================================
   CREATE BROWSER ADAPTER
========================================================= */

export async function createCircleBrowserAdapter() {
  if (!window.ethereum) {
    throw new Error("No wallet provider found");
  }

  const adapter = await createViemAdapterFromProvider({
    provider: window.ethereum,
  });

  return adapter;
}

/* =========================================================
   GET UNIFIED BALANCE
========================================================= */

export async function getTrorUnifiedBalance() {
  const adapter = await createCircleBrowserAdapter();

  const balances =
    await trorCircleKit.unifiedBalance.getBalances({
      sources: [{ adapter }],
      networkType: "testnet",
      includePending: true,
    });

  console.log(
    "TROR Unified Balance:",
    balances
  );

  return balances;
}

/* =========================================================
   CIRCLE TESTNET CHAINS
========================================================= */

const CIRCLE_TESTNET_CHAINS = {
  5042002: {
    type: "evm",
    chain: "Arc_Testnet",
    chainId: 5042002,
    name: "Arc Testnet",
    isTestnet: true
  },

  11155111: {
    type: "evm",
    chain: "Ethereum_Sepolia",
    chainId: 11155111,
    name: "Ethereum Sepolia",
    isTestnet: true
  },

  84532: {
    type: "evm",
    chain: "Base_Sepolia",
    chainId: 84532,
    name: "Base Sepolia",
    isTestnet: true
  },

  421614: {
    type: "evm",
    chain: "Arbitrum_Sepolia",
    chainId: 421614,
    name: "Arbitrum Sepolia",
    isTestnet: true
  },

  43113: {
    type: "evm",
    chain: "Avalanche_Fuji",
    chainId: 43113,
    name: "Avalanche Fuji",
    isTestnet: true
  },

  11155420: {
    type: "evm",
    chain: "Optimism_Sepolia",
    chainId: 11155420,
    name: "Optimism Sepolia",
    isTestnet: true
  },

  80002: {
    type: "evm",
    chain: "Polygon_Amoy",
    chainId: 80002,
    name: "Polygon Amoy",
    isTestnet: true
  },

  1301: {
    type: "evm",
    chain: "Unichain_Sepolia",
    chainId: 1301,
    name: "Unichain Sepolia",
    isTestnet: true
  }
};

/* =========================================================
   DEPOSIT TO UNIFIED BALANCE
========================================================= */

export async function depositToTrorUnifiedBalance(
  amount = "0.10"
) {
  if (!window.ethereum) {
    throw new Error(
      "No wallet provider found"
    );
  }

  const accounts =
    await window.ethereum.request({
      method: "eth_accounts"
    });

  const walletAddress = accounts?.[0];

  if (!walletAddress) {
    throw new Error(
      "Connect your Web3 wallet first."
    );
  }

  const chainIdHex =
    await window.ethereum.request({
      method: "eth_chainId"
    });

  const currentChainId =
    Number.parseInt(chainIdHex, 16);

  const circleChain =
    CIRCLE_TESTNET_CHAINS[currentChainId];

  if (!circleChain) {
    throw new Error(
      `Unified Balance deposit is not configured for chain ${currentChainId}.`
    );
  }

  const adapter =
    await createViemAdapterFromProvider({
      provider: window.ethereum,

      capabilities: {
        addressContext: "user-controlled",

        supportedChains: [
          circleChain
        ]
      }
    });

  console.log(
    "TROR Unified Balance deposit:",
    {
      address: walletAddress,
      amount,
      chain: circleChain.chain,
      chainId: currentChainId
    }
  );

  const result =
    await trorCircleKit.unifiedBalance.deposit({
      from: {
        adapter,
        chain: circleChain.chain
      },

      amount,

      token: "USDC"
    });

  console.log(
    "TROR Unified Balance deposit result:",
    result
  );

  return result;
}

/* =========================================================
   SPEND FROM UNIFIED BALANCE
========================================================= */

export async function spendFromTrorUnifiedBalance({
  recipientAddress,
  amount = "0.05",
  destinationChainId = 5042002
}) {
  if (!window.ethereum) {
    throw new Error(
      "No wallet provider found"
    );
  }

  if (!recipientAddress) {
    throw new Error(
      "Recipient address is required."
    );
  }

  const numericAmount =
    Number(amount);

  if (
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0
  ) {
    throw new Error(
      "Enter a valid USDC amount."
    );
  }

  const accounts =
    await window.ethereum.request({
      method: "eth_accounts"
    });

  const walletAddress =
    accounts?.[0];

  if (!walletAddress) {
    throw new Error(
      "Connect your Web3 wallet first."
    );
  }

  const destinationChain =
    CIRCLE_TESTNET_CHAINS[
      Number(destinationChainId)
    ];

  if (!destinationChain) {
    throw new Error(
      `Unified Balance destination is not configured for chain ${destinationChainId}.`
    );
  }

  /*
   Give Circle adapter access to all
   configured testnet chains.

   Unified Balance can contain USDC
   deposited from several networks.
  */

  const adapter =
    await createViemAdapterFromProvider({
      provider: window.ethereum,

      capabilities: {
        addressContext: "user-controlled",

        supportedChains:
          Object.values(
            CIRCLE_TESTNET_CHAINS
          )
      }
    });

  console.log(
    "TROR Unified Balance spend:",
    {
      from: walletAddress,
      to: recipientAddress,
      amount,

      destinationChain:
        destinationChain.chain,

      destinationChainId:
        destinationChain.chainId
    }
  );

  /* -------------------------------------------------------
     ESTIMATE
  ------------------------------------------------------- */

  const estimate =
    await trorCircleKit.unifiedBalance
      .estimateSpend({
        amount,

        token: "USDC",

        from: {
          adapter
        },

        to: {
          adapter,

          chain:
            destinationChain.chain,

          recipientAddress
        }
      });

  console.log(
    "TROR Unified Balance spend estimate:",
    estimate
  );

  /* -------------------------------------------------------
     SPEND
  ------------------------------------------------------- */

  const result =
    await trorCircleKit.unifiedBalance
      .spend({
        amount,

        token: "USDC",

        from: {
          adapter
        },

        to: {
          adapter,

          chain:
            destinationChain.chain,

          recipientAddress
        }
      });

  console.log(
    "TROR Unified Balance spend result:",
    result
  );

  return {
    estimate,
    result
  };
}

/* =========================================================
   ESTIMATE UNIFIED BALANCE SPEND
========================================================= */

export async function estimateTrorUnifiedSpend({
  recipientAddress,
  amount = "0.05",
  destinationChainId = 5042002
}) {
  if (!window.ethereum) {
    throw new Error(
      "No wallet provider found"
    );
  }

  if (!recipientAddress) {
    throw new Error(
      "Recipient address is required."
    );
  }

  const numericAmount =
    Number(amount);

  if (
    !Number.isFinite(numericAmount) ||
    numericAmount <= 0
  ) {
    throw new Error(
      "Enter a valid USDC amount."
    );
  }

  const destinationChain =
    CIRCLE_TESTNET_CHAINS[
      Number(destinationChainId)
    ];

  if (!destinationChain) {
    throw new Error(
      `Unified Balance destination is not configured for chain ${destinationChainId}.`
    );
  }

  const adapter =
    await createViemAdapterFromProvider({
      provider: window.ethereum,

      capabilities: {
        addressContext: "user-controlled",

        supportedChains:
          Object.values(
            CIRCLE_TESTNET_CHAINS
          )
      }
    });

  const estimate =
    await trorCircleKit.unifiedBalance
      .estimateSpend({
        amount,

        token: "USDC",

        from: {
          adapter
        },

        to: {
          adapter,

          chain:
            destinationChain.chain,

          recipientAddress
        }
      });

  console.log(
    "TROR Unified Balance fee estimate:",
    estimate
  );

  return estimate;
}