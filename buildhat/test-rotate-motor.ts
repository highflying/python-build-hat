import { BuildHAT, Port, Motor } from "./index";
import * as path from "path";
import { pause } from "./utils";

const main = async () => {
  const firmwarePath = path.join(__dirname, "./data/firmware.bin");
  const signaturePath = path.join(__dirname, "./data/signature.bin");
  const version = 1670596313;
  const ser = await BuildHAT.factory(firmwarePath, signaturePath, version);
  // ser.on("data", (data) => console.log("data", data));
  console.log("Have hat");

  process.on("SIGINT", async () => {
    await ser.shutdown();
    process.exit(1);
  });

  const device = (await ser.waitForDeviceAtPort(Port.A)) as Motor;
  console.log("have device");
  // console.log(device);

  // await device.run_to_position(0, 50);

  await device.run_for_degrees(360*2, 20);
  console.time("power");
  await pause(20_000);
  console.timeEnd("power");
  await device.stop();
  await ser.shutdown();
};

main();
