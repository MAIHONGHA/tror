const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const USDC_ADDRESS =
    process.env.USDC_ADDRESS ||
    "0x3600000000000000000000000000000000000000";

  if (!hre.ethers.isAddress(USDC_ADDRESS)) {
    throw new Error(
      "Invalid USDC_ADDRESS"
    );
  }

  const [deployer] =
    await hre.ethers.getSigners();

  console.log(
    "Deploying TRORPayout with:",
    deployer.address
  );

  console.log(
    "USDC:",
    USDC_ADDRESS
  );

  const TRORPayout =
    await hre.ethers.getContractFactory(
      "TRORPayout"
    );

  const payout =
    await TRORPayout.deploy(
      USDC_ADDRESS
    );

  await payout.waitForDeployment();

  const address =
    await payout.getAddress();

  console.log(
    "TRORPayout deployed to:",
    address
  );

  console.log(
    "ArcScan:"
  );

  console.log(
    `https://testnet.arcscan.app/address/${address}`
  );
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });