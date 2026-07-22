import hre from "hardhat";

async function main() {
  const USDC_ADDRESS =
    "0x3600000000000000000000000000000000000000";

  const TRORClaim =
    await hre.ethers.getContractFactory("TRORClaim");

  const claim =
    await TRORClaim.deploy(USDC_ADDRESS);

  await claim.waitForDeployment();

  console.log(
    "TRORClaim deployed to:",
    await claim.getAddress()
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});