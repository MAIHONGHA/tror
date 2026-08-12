import { createAppKit } from "@reown/appkit";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { defineChain, http } from "viem";

const ARC_RPC =
  import.meta.env.VITE_ARC_RPC_URL ||
  "https://rpc.testnet.arc.network";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",

  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 6,
  },

  rpcUrls: {
  default: {
    http: [ARC_RPC],
  },
  public: {
    http: [ARC_RPC],
  },
},

  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://testnet.arcscan.app",
    },
  },

  testnet: true,
});

export const ethSepolia = defineChain({
  id: 11155111,
  name: "Ethereum Sepolia",
  nativeCurrency: {
    name: "Sepolia Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://ethereum-sepolia-rpc.publicnode.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Etherscan",
      url: "https://sepolia.etherscan.io",
    },
  },
  testnet: true,
});

export const baseSepolia = defineChain({
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://sepolia.base.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "BaseScan",
      url: "https://sepolia.basescan.org",
    },
  },
  testnet: true,
});

export const arbitrumSepolia = defineChain({
  id: 421614,
  name: "Arbitrum Sepolia",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://sepolia-rollup.arbitrum.io/rpc"],
    },
  },
  blockExplorers: {
    default: {
      name: "Arbiscan",
      url: "https://sepolia.arbiscan.io",
    },
  },
  testnet: true,
});

export const avalancheFuji = defineChain({
  id: 43113,
  name: "Avalanche Fuji",
  nativeCurrency: {
    name: "Avalanche",
    symbol: "AVAX",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://api.avax-test.network/ext/bc/C/rpc"],
    },
  },
  blockExplorers: {
    default: {
      name: "Snowtrace",
      url: "https://testnet.snowtrace.io",
    },
  },
  testnet: true,
});

export const optimismSepolia = defineChain({
  id: 11155420,
  name: "Optimism Sepolia",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://sepolia.optimism.io"],
    },
  },
  blockExplorers: {
    default: {
      name: "Optimism Explorer",
      url: "https://testnet-explorer.optimism.io",
    },
  },
  testnet: true,
});

export const polygonAmoy = defineChain({
  id: 80002,
  name: "Polygon Amoy",
  nativeCurrency: {
    name: "POL",
    symbol: "POL",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://polygon-amoy.drpc.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "PolygonScan",
      url: "https://amoy.polygonscan.com",
    },
  },
  testnet: true,
});

export const unichainSepolia = defineChain({
  id: 1301,
  name: "Unichain Sepolia",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://sepolia.unichain.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "Uniscan",
      url: "https://sepolia.uniscan.xyz",
    },
  },
  testnet: true,
});

export const TROR_NETWORKS = [
  arcTestnet,
  ethSepolia,
  baseSepolia,
  arbitrumSepolia,
  avalancheFuji,
  optimismSepolia,
  polygonAmoy,
  unichainSepolia,
];

const projectId = "70b21c44685fc62f9b501eb07b04a67b";

const metadata = {
  name: "TROR",
  description: "TROR USDC payments on Arc Network",
  url: "https://tror.app",
  icons: ["https://tror.app/favicon.svg"],
};

/*
  AppKit internal RPC configuration.
  dRPC first, official Arc RPC second.
*/
const customRpcUrls = {
  "eip155:5042002": [
    {
      url: ARC_RPC,
      config: {
        retryCount: 1,
        retryDelay: 500,
        timeout: 15000,
      },
    },
  ],
};

/*
  Wagmi/Viem failover:
  if dRPC returns 429 / Too many requests,
  try the official Arc RPC.
*/
const transports = {
  [arcTestnet.id]: http(ARC_RPC, {
    retryCount: 1,
    retryDelay: 500,
    timeout: 15000,
  }),
};

export const wagmiAdapter = new WagmiAdapter({
  networks: TROR_NETWORKS,
  projectId,
  customRpcUrls,
  transports,
});

export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks: TROR_NETWORKS,
  projectId,
  metadata,
  customRpcUrls,

  features: {
    analytics: false,
    email: false,
    socials: false,
  },
});

export async function openAppKitWallet() {
  appKit.open();
}