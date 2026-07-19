import { createAppKit } from "@reown/appkit";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { defineChain, fallback, http } from "viem";

const ARC_DRPC_URL =
  import.meta.env.VITE_ARC_RPC_URL ||
  "https://rpc.drpc.testnet.arc.io";

const ARC_OFFICIAL_RPC =
  "https://rpc.testnet.arc.network";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",

  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },

  rpcUrls: {
    default: {
      http: [
        ARC_DRPC_URL,
        ARC_OFFICIAL_RPC,
      ],
    },
    public: {
      http: [
        ARC_DRPC_URL,
        ARC_OFFICIAL_RPC,
      ],
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

const projectId = "70b21c44685fc62f9b501eb07b04a67b";

const metadata = {
  name: "ArcPay",
  description: "ArcPay USDC payments on Arc Network",
  url: "https://arcpay.pro",
  icons: ["https://arcpay.pro/favicon.ico"],
};

/*
  AppKit internal RPC configuration.
  dRPC first, official Arc RPC second.
*/
const customRpcUrls = {
  "eip155:5042002": [
    {
      url: ARC_DRPC_URL,
      config: {
        retryCount: 1,
        retryDelay: 500,
        timeout: 15_000,
      },
    },
    {
      url: ARC_OFFICIAL_RPC,
      config: {
        retryCount: 1,
        retryDelay: 500,
        timeout: 15_000,
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
  [arcTestnet.id]: fallback([
    http(ARC_DRPC_URL, {
      retryCount: 0,
      timeout: 15_000,
    }),

    http(ARC_OFFICIAL_RPC, {
      retryCount: 1,
      retryDelay: 500,
      timeout: 15_000,
    }),
  ]),
};

export const wagmiAdapter = new WagmiAdapter({
  networks: [arcTestnet],
  projectId,
  customRpcUrls,
  transports,
});

export const appKit = createAppKit({
  adapters: [wagmiAdapter],
  networks: [arcTestnet],
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