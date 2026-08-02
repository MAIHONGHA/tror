async function main() {
  const USDC_ADDRESS =
    "0x3600000000000000000000000000000000000000";

  const TRORInvoice =
    await ethers.getContractFactory("TRORInvoice");

  const invoice =
    await TRORInvoice.deploy(USDC_ADDRESS);

  await invoice.waitForDeployment();

  console.log(
    "TRORInvoice deployed to:",
    await invoice.getAddress()
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});