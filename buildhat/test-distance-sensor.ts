import { BuildHAT, Port, ColorDistanceSensor } from "./index";
import * as path from "path";

const main = async () => {
  const firmwarePath = path.join(__dirname, "./data/firmware.bin");
  const signaturePath = path.join(__dirname, "./data/signature.bin");
  const version = 1674818421;
  const ser = await BuildHAT.factory(firmwarePath, signaturePath, version);

  process.on("SIGINT", async () => {
    await ser.shutdown();
    process.exit(1);
  });

  const device1 = (await ser.waitForDeviceAtPort(
    Port.B
  )) as ColorDistanceSensor;
  const device2 = (await ser.waitForDeviceAtPort(
    Port.C
  )) as ColorDistanceSensor;

  device1.on("distance", (data) => console.log("value 1", data));
  device2.on("distance", (data) => console.log("value 2", data));
};

main();
