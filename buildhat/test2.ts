import { BuildHAT } from "./serinterface";
import * as path from "path";

const main = async () => {
  const firmwarePath = path.join(__dirname, "./data/firmware.bin");
  const signaturePath = path.join(__dirname, "./data/signature.bin");
  const version = 1643737936;
  const ser = await BuildHAT.factory(firmwarePath, signaturePath, version);

  console.log(ser);

  ser.on("connected", (...args) => console.log("event", args));

  process.on("SIGINT", () => ser.shutdown());
};

main();
