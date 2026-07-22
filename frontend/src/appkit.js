import { createAppKit } from "@reown/appkit";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { defineChain, http } from "viem";

const ARC_RPC =
  import.meta.env.VITE_ARC_RPC_URL ||
  "https://rpc.drpc.testnet.arc.network";

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