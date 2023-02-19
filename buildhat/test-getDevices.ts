import { BuildHAT } from "./index";
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

  // ser.on("connected", (portId, typeId) => console.log(portId, typeId));
  // ser.on("data", (data) => console.log(data));
  // await pause(10_000);
  const devices = ser.getDevices();
  console.log(devices);

  await ser.shutdown();
};

main();
