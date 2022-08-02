import { BuildHAT, Port, ColorDistanceSensor } from "./index";
import * as path from "path";

const main = async () => {
  const firmwarePath = path.join(__dirname, "./data/firmware.bin");
  const signaturePath = path.join(__dirname, "./data/signature.bin");
  const version = 1643737936;
  const ser = await BuildHAT.factory(firmwarePath, signaturePath, version);

  process.on("SIGINT", async () => {
    await ser.shutdown();
    process.exit(1);
  });

  const device = (await ser.waitForDeviceAtPort(Port.D)) as ColorDistanceSensor;

  device.on("distance", (data) => console.log("value", data));
};

main();
