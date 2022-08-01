import { BuildHAT, Port, ColorDistanceSensor } from "./index";
import * as path from "path";
import { pause } from "./utils";
// import { PassiveMotor } from "./devices/PassiveMotor";
// import { Motor } from "./devices/Motor";
// import { ColorDistanceSensor } from "./devices/ColorDistanceSensor";

const main = async () => {
  const firmwarePath = path.join(__dirname, "./data/firmware.bin");
  const signaturePath = path.join(__dirname, "./data/signature.bin");
  const version = 1643737936;
  const ser = await BuildHAT.factory(firmwarePath, signaturePath, version);

  // console.log(ser);

  ser.on("connected", (...args) => console.log("event", args));

  process.on("SIGINT", async () => {
    await ser.shutdown();
    process.exit(1);
  });

  // const device = (await ser.waitForDeviceAtPort(Port.C)) as Motor;
  const device = (await ser.waitForDeviceAtPort(Port.A)) as ColorDistanceSensor;

  // // console.log(device);
  device.on("distance", (data) => console.log("value", data));
  // await device.setSpeed(50);
  await pause(1000);
  // await device.run_to_position(0, 50);
  // const listener = (data: any) => console.log("event", data);
  // device.on("status", listener);
  // // await pause(1000);
  // // await device.coast();
  // // await pause(1000);
  // // await device.start(50);
  await pause(5000);
  // await device.stop();
  // device.off("status", listener);

  // const device = (await ser.waitForDeviceAtPort(Port.A)) as ColorDistanceSensor;

  // device.on("distance", console.log);
};

main();
