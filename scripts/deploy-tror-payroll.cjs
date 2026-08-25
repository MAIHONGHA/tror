const hre = require("hardhat");

async function main() {
  const USDC_ADDRESS =
    "0x3600000000000000000000000000000000000000";

  const [deployer] =
    await hre.ethers.getSigners();

  console.log(
    "Deploying TRORPayroll with:",
    deployer.address
  );

  console.log(
    "USDC:",
    USDC_ADDRESS
  );

  const TRORPayroll =
    await hre.ethers.getContractFactory(
      "TRORPayroll"
    );

  const payroll =
    await TRORPayroll.deploy(
      USDC_ADDRESS
    );

  await payroll.waitForDeployment();

  const address =
    await payroll.getAddress();

  console.log(
    "TRORPayroll deployed to:",
    address
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});