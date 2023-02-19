// """Build HAT handling functionality"""

import rpio from "rpio";
import Bluebird from "bluebird";
import DebugFactory from "debug";
import { SerialPort } from "serialport";
import { promises as fs } from "fs";
import { ReadlineParser } from "@serialport/parser-readline";

import EventEmitter from "events";
import { Device } from "./Device";
import {
  DeviceFactory,
  DeviceID,
  DeviceMap,
  validateDeviceId,
} from "./device-map";
import { calcChecksum, pause } from "./utils";

const debug = DebugFactory("buildhat:serinterface");

export enum Port {
  "A" = 0,
  "B" = 1,
  "C" = 2,
  "D" = 3,
}

const portMapper: Record<string, "A" | "B" | "C" | "D"> = {
  0: "A",
  1: "B",
  2: "C",
  3: "D",
};

enum HatState {
  // """Current state that hat is in"""

  OTHER = 0,
  FIRMWARE = 1,
  NEEDNEWFIRMWARE = 2,
  BOOTLOADER = 3,
}

export class BuildHAT extends EventEmitter {
  private shuttingDown = false;
  private ser!: SerialPort;
  private parser!: ReadlineParser;
  private ports: (DeviceID | undefined)[] = [
    undefined,
    undefined,
    undefined,
    undefined,
  ];
  private connectQueue: Partial<
    Record<Port, (device: Device | PromiseLike<Device>) => void>
  > = {};

  public static async factory(
    firmware: string,
    signature: string,
    version: number,
    device = "/dev/serial0"
  ) {
    const instance = new BuildHAT();

    let resolve: () => void = () => {
      return;
    };
    let connectCount = 0;

    const promise = new Promise<void>((r) => {
      resolve = r;
    });

    const listener = (portId: number) => {
      console.log("got event for", portId);
      connectCount++;
      if (connectCount >= 4) {
        resolve();
      }
    };
    instance.on("connected", listener);
    instance.on("disconnected", listener);
    instance.on("notConnected", listener);

    await instance.init(firmware, signature, version, device);

    await promise;

    instance.off("connected", listener);
    instance.off("disconnected", listener);
    instance.off("notConnected", listener);

    return instance;
  }

  public getDevices() {
    return Object.entries(this.ports)
      .filter((port): port is [string, DeviceID] => port[1] !== undefined)
      .map(([portId, deviceId]) => {
        const device = DeviceMap[deviceId];

        return {
          portId,
          portName: portMapper[portId],
          deviceId,
          deviceType: "typeName" in device ? device.typeName : device.name,
        };
      });
  }

  public get typeName() {
    return "BuildHAT";
  }

  public async read() {
    return new Promise<string>((resolve) => {
      this.parser.once("data", (data) => {
        debug(`< ${data}`);
        resolve(data);
      });
    });
  }

  private async init(
    firmware: string,
    signature: string,
    version: number,
    device = "/dev/serial0"
  ) {
    this.ser = new SerialPort({
      path: device,
      baudRate: 115200,
      autoOpen: false,
    });

    let incdata = 0;

    await new Promise<void>((resolve, reject) =>
      this.ser.open(async (err) => {
        if (err) {
          reject(err);
          return;
        }

        this.parser = this.ser.pipe(new ReadlineParser({ delimiter: "\r\n" }));

        const checkFirmware = (data: string): HatState | undefined => {
          const versionRegex = new RegExp(`^Firmware version: (\\d+)`);
          const match = versionRegex.exec(data);
          debug("version match", versionRegex, data, match);
          if (match && match[1]) {
            if (Number(match[1]) === version) {
              return HatState.FIRMWARE;
            }

            return HatState.NEEDNEWFIRMWARE;
          }

          if (/BuildHAT bootloader version/.test(data)) {
            return HatState.BOOTLOADER;
          }

          return;
        };

        debug("Starting init");
        await this.writeStr("version\r");

        while (true) {
          const data = await this.read();

          // # Check if we're in the bootloader or the firmware
          const currentState = checkFirmware(data);

          if (currentState === HatState.NEEDNEWFIRMWARE) {
            debug("new new firmware");
            await this.resetHAT();
            await this.loadFirmware(firmware, signature);
          } else if (currentState === HatState.BOOTLOADER) {
            debug("bootloader");
            await this.loadFirmware(firmware, signature);
          } else if (currentState !== HatState.FIRMWARE) {
            debug("unknown state");
            // const error = new Error("Unknown state");
            // this.emit("error", error);
            // throw error;
          }

          if (currentState === HatState.FIRMWARE) {
            debug("Setting up listener");
            this.parser.on("data", (data) => this.eventListener(data));
            debug("Selecting ports");
            await this.writeStr(
              "port 0 ; select ; port 1 ; select ; port 2 ; select ; port 3 ; select ; echo 0\r"
            );
            await this.writeStr("list\r");
            this.emit("ready");
            resolve();
            return;
          }

          if (
            currentState === HatState.NEEDNEWFIRMWARE ||
            currentState === HatState.BOOTLOADER
          ) {
            debug("Rebooting for new firmware");
            await this.writeStr("reboot\r");
            await pause(5000);
          }

          // # got other data we didn't understand - send version again
          incdata += 1;
          if (incdata > 5) {
            reject(new Error("Build HAT not found"));
            return;
          } else {
            await this.writeStr("version\r");
          }

          debug("init loop end", currentState);
        }
      })
    );
  }

  public async resetHAT() {
    debug("Resetting BuildHAT");

    const RESET_GPIO_NUMBER = 4;
    const BOOT0_GPIO_NUMBER = 22;

    rpio.init({
      mapping: "gpio",
    });

    debug("Opening GPIO");
    rpio.open(RESET_GPIO_NUMBER, rpio.OUTPUT);
    rpio.open(BOOT0_GPIO_NUMBER, rpio.OUTPUT);

    debug("Writing to GPIO");
    rpio.write(BOOT0_GPIO_NUMBER, rpio.LOW);
    rpio.write(RESET_GPIO_NUMBER, rpio.LOW);

    debug("Pause");
    await pause(10_000);

    debug("Writing to GPIO");
    rpio.write(RESET_GPIO_NUMBER, rpio.HIGH);

    debug("Pause");
    await pause(10_000);

    debug("Closing GPIO");
    rpio.close(BOOT0_GPIO_NUMBER);
    rpio.close(RESET_GPIO_NUMBER);

    debug("Pause");
    await pause(1_000);

    rpio.exit();
  }

  public async loadFirmware(firmwarePath: string, signaturePath: string) {
    const firm = await fs.readFile(firmwarePath);
    const sig = await fs.readFile(signaturePath);

    await this.writeStr("clear\r");
    await this.waitForPrompt();
    await this.writeStr(`load ${firm.byteLength} ${calcChecksum(firm)}\r`);
    await pause(100);
    await this.write(Buffer.from("02", "hex"), "0x02");
    await this.write(firm, "--firmware file--");
    await this.write(Buffer.from("03", "hex"), "0x03");
    await this.writeStr("\r");
    await this.waitForPrompt();
    await this.writeStr(`signature ${sig.length}\r`);
    await pause(100);
    await this.write(Buffer.from("02", "hex"), "0x02");
    await this.write(sig, "--signature file--");
    await this.write(Buffer.from("03", "hex"), "0x03");
    await this.writeStr("\r");
    await this.waitForPrompt();
    debug("Finished loading firmware");
  }

  public async waitForPrompt() {
    while (true) {
      const line = await this.read();
      if (/BHBL>/.test(line)) {
        debug("Got prompt");
        break;
      }
    }
    debug("Returning from getprompt");
  }

  public writeStr(data: string) {
    return this.write(Buffer.from(data, "utf-8"));
  }

  public async write(data: Buffer, replace = ""): Promise<void> {
    if (replace) {
      debug(`> ${replace}`);
    } else {
      debug(`> ${data.toString("utf-8")}`);
    }

    return new Promise<void>((resolve, reject) => {
      const result = this.ser.write(data, (err) =>
        err ? reject(err) : resolve()
      );

      debug("write result", result);
    });
  }

  public async shutdown() {
    if (this.shuttingDown) {
      return;
    }

    this.shuttingDown = true;

    this.removeAllListeners();

    const turnOffCmds = this.ports
      .map((typeId, portId) => {
        if (typeId === undefined) {
          return;
        }

        if (typeId === DeviceID.Matrix) {
          // clear matrix display
          const hexstr = " c2000000000000000000";
          return `port ${portId} ; write1 ${hexstr}\r`;
        } else {
          return `port ${portId} ; pwm ; coast ; off\r`;
        }
      })
      .filter((cmd) => !!cmd) as string[];
    if (turnOffCmds.length) {
      await Bluebird.each(turnOffCmds, (cmd) => this.writeStr(cmd));
    }
    await this.writeStr(
      "port 0 ; select ; port 1 ; select ; port 2 ; select ; port 3 ; select ; echo 0\r"
    );
    return new Promise<void>((resolve, reject) =>
      this.ser.close((err) => (err ? reject(err) : resolve()))
    );
  }

  private eventListener(line: string) {
    debug(`< ${line}`);
    if (line.length === 0) {
      return;
    }

    if (line[0] === "P" && line[2] == ":") {
      // const portid = Number(line[1])
      const [, msg] = line.split(":");
      const portId = Number(line[1]) as Port;

      const connectedMatch =
        /connected to (active|passive) ID ([0-9a-fA-F]+)/.exec(line);
      if (connectedMatch && connectedMatch[1] && connectedMatch[2]) {
        const type = connectedMatch[1] as "active" | "passive";
        const typeId = parseInt(connectedMatch[2], 16);
        debug("connected", portId, typeId, type);
        const deviceId = validateDeviceId(typeId);
        this.ports[portId] = deviceId;

        this.emit("connected", portId, typeId, deviceId);

        const callback = this.connectQueue[portId];
        if (callback) {
          this.connectQueue[portId] = undefined;
          const device = DeviceFactory(this, deviceId, portId);
          callback(device);
        }
      } else if (/: disconnected/.test(line)) {
        this.ports[portId] = undefined;
        this.emit("disconnected", portId);
        debug("disconnected", portId);
      } else if (/: timeout during data phase: disconnecting/.test(line)) {
        this.ports[portId] = undefined;
        this.emit("timeout", portId);
        debug("timeout", portId);
      } else if (/: no device detected/.test(line)) {
        this.emit("notConnected", portId);
        this.ports[portId] = undefined;
        debug("notConnected", portId);
      } else if (/: ramp done/.test(msg)) {
        debug("rampDone", msg);
        this.emit("rampDone", portId);
      } else if (/: pulse done/.test(msg)) {
        debug("pulseDone", msg);
        this.emit("pulseDone", portId);
      }
    }

    if (line[0] === "P" && (line[2] === "C" || line[2] === "M")) {
      const portid = Number(line[1]) as Port;
      const mode = Number(line[3]);
      const data: number[] = line
        .slice(5)
        .split(" ")
        .filter((d) => d !== "")
        .map(Number);

      this.emit("data", portid, line[2], mode, data);
      debug("data", portid, line[2], mode, data);
    }

    const vinRegex = /^[0-9.]+ V/;
    const vinMatch = vinRegex.exec(line);
    if (vinMatch && vinMatch[1]) {
      const vin = Number(vinMatch[1]);
      debug("vin", vin);
      this.emit("vin", vin);
    }
  }

  public async waitForDeviceAtPort(port: Port) {
    if (this.connectQueue[port]) {
      throw new Error(`Already waiting for device at port ${port}`);
    }

    const currentDevice = this.ports[port];

    if (currentDevice) {
      return DeviceFactory(this, currentDevice, port);
    }

    const p = new Promise<Device>((resolve) => {
      this.connectQueue[port] = resolve;
    });

    return p;
  }
}
