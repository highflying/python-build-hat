import { BuildHAT, Port, PassiveMotor } from "./index";
import * as path from "path";
import { pause } from "./utils";

const main = async () => {
  const firmwarePath = path.join(__dirname, "./data/firmware.bin");
  const signaturePath = path.join(__dirname, "./data/signature.bin");
  const version = 1674818421;
  const ser = await BuildHAT.factory(firmwarePath, signaturePath, version);

  process.on("SIGINT", async () => {
    await ser.shutdown();
    process.exit(1);
  });

  const device = (await ser.waitForDeviceAtPort(Port.A)) as PassiveMotor;
  // console.log(device);

  await device.setPower(50);
  console.time("power");
  await pause(5_000);
  console.timeEnd("power");
  await device.stop();
  await ser.shutdown();
};

main();
