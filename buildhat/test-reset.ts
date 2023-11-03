import { BuildHAT } from "./index";
// import * as path from "path";
import { pause } from "./utils";
// import { PassiveMotor } from "./devices/PassiveMotor";
// import { Motor } from "./devices/Motor";
// import { ColorDistanceSensor } from "./devices/ColorDistanceSensor";

const main = async () => {
  // const firmwarePath = path.join(__dirname, "./data/firmware.bin");
  // const signaturePath = path.join(__dirname, "./data/signature.bin");
  // const version = 1674818421;
  // const ser = await BuildHAT.factory(firmwarePath, signaturePath, version);

  // console.log(ser);

  // ser.on("connected", (...args) => console.log("event", args));

  // process.on("SIGINT", async () => {
  //   await ser.shutdown();
  //   process.exit(1);
  // });

  await BuildHAT.resetHAT();

  await pause(5000);
};

main();
