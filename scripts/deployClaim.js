import hre from "hardhat";

async function main() {
  const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";

  const ArcPayClaim = await hre.ethers.getContractFactory("ArcPayClaim");
  const claim = await ArcPayClaim.deploy(USDC_ADDRESS);

  await claim.waitForDeployment();

  console.log("ArcPayClaim deployed to:", await claim.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});