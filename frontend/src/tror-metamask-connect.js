import {
  createEVMClient
} from "@metamask/connect-evm";

let trorMetaMaskClient = null;

export async function testTrorMetaMaskConnect() {
  if (!trorMetaMaskClient) {
    trorMetaMaskClient =
  await createEVMClient({
    dapp: {
      name: "TROR",
      url: window.location.origin
    },

    api: {
  supportedNetworks: {
    "0x66eee":
      "https://sepolia-rollup.arbitrum.io/rpc",

    "0x14a34":
      "https://sepolia.base.org"
  }
},

    ui: {
      preferExtension: true,
      showInstallModal: true
    }
  });
  }

  const currentChainId =
  await window.ethereum.request({
    method: "eth_chainId"
  });

const result =
  await trorMetaMaskClient.connect({
    chainIds: [currentChainId]
  });

  const provider =
    trorMetaMaskClient.getProvider();

  const accounts =
    await provider.request({
      method: "eth_accounts"
    });

  const chainId =
    await provider.request({
      method: "eth_chainId"
    });

  const capabilities =
    await provider.request({
      method: "wallet_getCapabilities",
      params: [accounts?.[0]]
    });

  const test = {
    connectedAccount:
      accounts?.[0] || null,

    chainId,

    currentChainCapabilities:
  capabilities?.[chainId] || null,

    sameAsCurrentInjectedWallet:
      String(accounts?.[0] || "").toLowerCase() ===
      String(
        (
          await window.ethereum.request({
            method: "eth_accounts"
          })
        )?.[0] || ""
      ).toLowerCase()
  };

  console.log(
    "TROR MetaMask Connect test:",
    test
  );

  return {
    ...test,
    provider,
    client: trorMetaMaskClient
  };
}