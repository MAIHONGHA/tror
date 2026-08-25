const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const USDC_ADDRESS =
    process.env.USDC_ADDRESS;

  const CLAIM_VERIFIER_ADDRESS =
    process.env.CLAIM_VERIFIER_ADDRESS;

  if (!USDC_ADDRESS) {
    throw new Error(
      "Missing USDC_ADDRESS"
    );
  }

  if (!CLAIM_VERIFIER_ADDRESS) {
    throw new Error(
      "Missing CLAIM_VERIFIER_ADDRESS"
    );
  }

  if (!hre.ethers.isAddress(USDC_ADDRESS)) {
    throw new Error(
      "Invalid USDC_ADDRESS"
    );
  }

  if (
    !hre.ethers.isAddress(
      CLAIM_VERIFIER_ADDRESS
    )
  ) {
    throw new Error(
      "Invalid CLAIM_VERIFIER_ADDRESS"
    );
  }

  const [deployer] =
    await hre.ethers.getSigners();

  console.log(
    "Deploying TRORClaim V2..."
  );

  console.log(
    "Deployer:",
    deployer.address
  );

  console.log(
    "USDC:",
    USDC_ADDRESS
  );

  console.log(
    "Verifier:",
    CLAIM_VERIFIER_ADDRESS
  );

  const TRORClaim =
    await hre.ethers.getContractFactory(
      "TRORClaim"
    );

  const contract =
    await TRORClaim.deploy(
      USDC_ADDRESS,
      CLAIM_VERIFIER_ADDRESS
    );

  await contract.waitForDeployment();

  const contractAddress =
    await contract.getAddress();

  console.log(
    "TRORClaim V2 deployed:"
  );

  console.log(
    contractAddress
  );

  console.log(
    "ArcScan:"
  );

  console.log(
    `https://testnet.arcscan.app/address/${contractAddress}`
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