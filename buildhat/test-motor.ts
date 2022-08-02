import { BuildHAT, Port, Motor } from "./index";
import * as path from "path";
import { pause } from "./utils";

const main = async () => {
  const firmwarePath = path.join(__dirname, "./data/firmware.bin");
  const signaturePath = path.join(__dirname, "./data/signature.bin");
  const version = 1643737936;
  const ser = await BuildHAT.factory(firmwarePath, signaturePath, version);

  process.on("SIGINT", async () => {
    await ser.shutdown();
    process.exit(1);
  });

  const device = (await ser.waitForDeviceAtPort(Port.A)) as Motor;

  await device.setSpeed(50);
  await pause(5_000);
  await device.stop();
  await ser.shutdown();
};

main();
