// """Build HAT handling functionality"""

// import logging
// import queue
// import tempfile
// import threading
// import time
// from enum import Enum
// from threading import Condition, Timer

// import serial
// from gpiozero import DigitalOutputDevice
import rpio from "rpio";

// from .exc import BuildHATError

import DebugFactory from "debug";
import { SerialPort } from "serialport";
import { promises as fs } from "fs";
import { ReadlineParser } from "@serialport/parser-readline";

const debug = DebugFactory("buildhat:serinterface");

const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(() => resolve(), ms));

enum HatState {
  // """Current state that hat is in"""

  OTHER = 0,
  FIRMWARE = 1,
  NEEDNEWFIRMWARE = 2,
  BOOTLOADER = 3,
}

class Connection {
  // """Connection information for a port"""

  public typeid: number;
  public connected: boolean;
  public callit: string;

  constructor() {
    // """Initialise connection"""
    this.typeid = -1;
    this.connected = false;
    this.callit = "None";
  }

  public update(typeid: number, connected: boolean, callit = "None") {
    // """Update connection information for port

    // :param typeid: Type ID of device on port
    // :param connected: Whether device is connected or not
    // :param callit: Callback function
    // """
    this.typeid = typeid;
    this.connected = connected;
    this.callit = callit;
  }
}

const cmp = (str1: string, str2: string): boolean => {
  // """Look for str2 in str1

  // :param str1: String to look in
  // :param str2: String to look for
  // :return: Whether str2 exists
  // """
  return str1.includes(str2);
};

enum BuildHatConst {
  CONNECTED = ": connected to active ID",
  CONNECTEDPASSIVE = ": connected to passive ID",
  DISCONNECTED = ": disconnected",
  DEVTIMEOUT = ": timeout during data phase: disconnecting",
  NOTCONNECTED = ": no device detected",
  PULSEDONE = ": pulse done",
  RAMPDONE = ": ramp done",
  FIRMWARE = "Firmware version: ",
  BOOTLOADER = "BuildHAT bootloader version",
  DONE = "Done initialising ports",
  PROMPT = "BHBL>",
  RESET_GPIO_NUMBER = 4,
  BOOT0_GPIO_NUMBER = 22,
}

export class BuildHAT {
  // """Interacts with Build HAT via UART interface"""

  // CONNECTED = ": connected to active ID"
  // CONNECTEDPASSIVE = ": connected to passive ID"
  // DISCONNECTED = ": disconnected"
  // DEVTIMEOUT = ": timeout during data phase: disconnecting"
  // NOTCONNECTED = ": no device detected"
  // PULSEDONE = ": pulse done"
  // RAMPDONE = ": ramp done"
  // FIRMWARE = "Firmware version: "
  // BOOTLOADER = "BuildHAT bootloader version"
  // DONE = "Done initialising ports"
  // PROMPT = "BHBL>"
  // RESET_GPIO_NUMBER = 4
  // BOOT0_GPIO_NUMBER = 22

  // private cond: any;
  private state: HatState;
  // private connections: any[];
  // private portcond: any[];
  // private pulsecond: any[];
  // private rampcond: any[];
  private fin: boolean;
  private running: boolean;
  // private vincond :any;
  // private vin: any;
  private ser!: SerialPort;
  private parser!: ReadlineParser;

  constructor() {
    // """Interact with Build HAT

    // :param firmware: Firmware file
    // :param signature: Signature file
    // :param version: Firmware version
    // :param device: Serial device to use
    // :param debug: Optional boolean to log debug information
    // :raises BuildHATError: Occurs if can't find HAT
    // """
    // this.cond = Condition();
    this.state = HatState.OTHER;
    // this.connections = [];
    // this.portcond = [];
    // this.pulsecond = [];
    // this.rampcond = [];
    this.fin = false;
    this.running = true;
    // this.vincond = Condition();
    // this.vin = None

    // [0, 1, 2, 3].forEach(() => {
    //   this.connections.push(new Connection());
    //   this.portcond.push(Condition());
    //   this.pulsecond.push(Condition());
    //   this.rampcond.push(Condition());
    // });
  }

  public static async factory(
    firmware: string,
    signature: string,
    version: number,
    device = "/dev/serial0"
  ) {
    const instance = new BuildHAT();

    await instance.init(firmware, signature, version, device);

    return instance;
  }

  private async read() {
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
    this.ser.open(async (err) => {
      if (err) {
        throw err;
      }

      this.parser = this.ser.pipe(new ReadlineParser({ delimiter: "\r\n" }));

      const initPromise = new Promise<HatState>(async (resolve, reject) => {
        while (true) {
          const data = await this.read();

          if (cmp(data, BuildHatConst.FIRMWARE)) {
            const versionRegex = new RegExp(`^${BuildHatConst.FIRMWARE}(\d+)`);
            const match = versionRegex.exec(data);
            debug("version match", match);
            if (match && match[1] && Number(match[1]) === version) {
              return resolve(HatState.FIRMWARE);
            }

            return resolve(HatState.NEEDNEWFIRMWARE);
          }

          if (cmp(data, BuildHatConst.BOOTLOADER)) {
            return resolve(HatState.BOOTLOADER);
          }
          // # got other data we didn't understand - send version again
          incdata += 1;
          if (incdata > 5) {
            reject(new Error("Build HAT not found"));
          } else {
            await this.writeStr("version\r");
          }
        }
      });

      // # Check if we're in the bootloader or the firmware
      await this.writeStr("version\r");

      const currentState = await initPromise;

      if (currentState === HatState.NEEDNEWFIRMWARE) {
        debug("new new firmware");
        await this.resetHAT();
        await this.loadfirmware(firmware, signature);
      } else if (currentState === HatState.BOOTLOADER) {
        debug("bootloader");
        await this.loadfirmware(firmware, signature);
      } else if (currentState !== HatState.FIRMWARE) {
        throw new Error("Unknown state");
      }

      // this.cbqueue = queue.Queue()
      // this.cb = threading.Thread(target=this.callbackloop, args=(this.cbqueue,))
      // this.cb.daemon = True
      // this.cb.start()

      // // # Drop timeout value to 1s
      // this.ser.timeout = 1
      // this.th = threading.Thread(target=this.loop, args=(this.cond, this.state == HatState.FIRMWARE, this.cbqueue))
      // this.th.daemon = True
      // this.th.start()

      if (currentState === HatState.FIRMWARE) {
        debug("Selecting ports");
        await this.writeStr(
          "port 0 ; select ; port 1 ; select ; port 2 ; select ; port 3 ; select ; echo 0\r"
        );
        await this.writeStr("list\r");
      } else if (
        currentState === HatState.NEEDNEWFIRMWARE ||
        currentState === HatState.BOOTLOADER
      ) {
        debug("Rebooting for new firmware");
        await this.writeStr("reboot\r");
      }

      debug("init done", currentState);
      // # wait for initialisation to finish
      // with this.cond:
      //     this.cond.wait()
    });
  }

  public async resetHAT() {
    // """Reset the HAT"""
    rpio.init({
      mapping: "gpio",
    });

    rpio.open(BuildHatConst.RESET_GPIO_NUMBER, rpio.OUTPUT);
    rpio.open(BuildHatConst.BOOT0_GPIO_NUMBER, rpio.OUTPUT);

    rpio.write(BuildHatConst.BOOT0_GPIO_NUMBER, rpio.LOW);
    rpio.write(BuildHatConst.RESET_GPIO_NUMBER, rpio.LOW);

    await pause(10);

    rpio.write(BuildHatConst.RESET_GPIO_NUMBER, rpio.HIGH);

    await pause(10);

    rpio.close(BuildHatConst.BOOT0_GPIO_NUMBER);
    rpio.close(BuildHatConst.RESET_GPIO_NUMBER);

    await pause(500);

    rpio.exit();
  }

  public async loadfirmware(firmware: string, signature: string) {
    // """Load firmware

    // :param firmware: Firmware to load
    // :param signature: Signature to load
    // """

    const firm = await fs.readFile(firmware);
    const sig = await fs.readFile(signature);

    await this.writeStr("clear\r");
    await this.getprompt();
    await this.writeStr(`load ${firm.byteLength} ${this.checksum(firm)}\r`);
    await pause(100);
    await this.write(Buffer.from("02", "hex"), "0x02");
    await this.write(firm, "--firmware file--");
    await this.write(Buffer.from("03", "hex"), "0x03");
    await this.writeStr("\r");
    await this.getprompt();
    await this.writeStr(`signature ${sig.length}\r`);
    await pause(100);
    await this.write(Buffer.from("02", "hex"), "0x02");
    await this.write(sig, "--signature file--");
    await this.write(Buffer.from("03", "hex"), "0x03");
    await this.writeStr("\r");
    await this.getprompt();
    debug("Finished loading firmware");
  }

  public async getprompt() {
    // """Loop until prompt is found

    // Need to decide what we will do, when no prompt
    // """
    while (true) {
      const line = await this.read();
      if (cmp(line, BuildHatConst.PROMPT)) {
        debug("Got prompt");
        break;
      }
    }
    debug("Returning from getprompt");
  }

  public checksum(data: Buffer) {
    // 3269132858
    // """Calculate checksum from data

    // :param data: Data to calculate the checksum from
    // :return: Checksum that has been calculated
    // """
    let u = BigInt(1);
    for (let i = 0; i < data.byteLength; i++) {
      // debug("checksum", i);
      // const x = i < data.byteLength ? data.readUInt8(i) : 0;

      if (u & BigInt(0x80000000)) {
        u = (u << BigInt(1)) ^ BigInt(0x1d872b41);
      } else {
        u = u << BigInt(1);
      }
      u = (u ^ BigInt(data.readUInt8(i))) & BigInt(0xffffffff);
    }
    return u;
  }

  public writeStr(data: string) {
    return this.write(Buffer.from(data, "utf-8"));
  }

  public async write(data: Buffer, replace = "") {
    // """Write data to the serial port of Build HAT

    // :param data: Data to write to Build HAT
    // :param log: Whether to log line or not
    // :param replace: Whether to log an alternative string
    // """
    if (!this.fin) {
      if (replace) {
        debug(`> ${replace}`);
      } else {
        debug(`> ${data.toString("utf-8")}`);
      }
    }

    await new Promise<void>((resolve, reject) => {
      const result = this.ser.write(data, (err) =>
        err ? reject(err) : resolve()
      );

      debug("write result", result);
    });
  }

  // public read() {
  //     // """Read data from the serial port of Build HAT

  //     // :return: Line that has been read
  //     // """
  //     let line = ""
  //     try {
  //         line = this.ser.readline().decode('utf-8', 'ignore').strip()
  //     } catch(error) {
  //     console.error(error);
  //     // except serial.SerialException:
  //     //     pass
  //     }
  //     if(line) {
  //         debug(`< ${line}`)
  //     }
  //     return line
  // }

  public shutdown() {
    // """Turn off the Build HAT devices"""
    if (!this.fin) {
      this.fin = true;
      this.running = false;
      const turnoff = "";
      // [0, 1, 2, 3].forEach((p) => {
      //   const conn = this.connections[p];
      //   if (conn.typeid != 64) {
      //     turnoff += `port ${p} ; pwm ; coast ; off ;`;
      //   } else {
      //     // const hexstr = ' '.join(f'{h:x}' for h in [0xc2, 0, 0, 0, 0, 0, 0, 0, 0, 0])
      //     const hexstr = " c2000000000000000000";
      //     this.writeStr(`port ${p} ; write1 ${hexstr}\r`);
      //   }
      // });
      this.writeStr(`${turnoff}\r`);
      this.writeStr(
        "port 0 ; select ; port 1 ; select ; port 2 ; select ; port 3 ; select ; echo 0\r"
      );
    }
  }

  // public callbackloop() {
  //     // """Event handling for callbacks

  //     // :param q: Queue of callback events
  //     // """
  //     while (this.running ) {
  //         let cb = q.get()
  //         // # Test for empty tuple, which should only be passed when
  //         // # we're shutting down
  //         if(cb.length === 0) {
  //             continue
  //         }
  //         if (! cb[0]._alive) {
  //             continue
  //         }
  //         cb[0]()(cb[1])
  //         q.task_done()
  //     }
  // }

  public loop() {
    // """Event handling for Build HAT

    // :param cond: Condition used to block user's script till we're ready
    // :param uselist: Whether we're using the HATs 'list' function or not
    // :param q: Queue for callback events
    // """
    const count = 0;
    this.parser.on("data", (line: string) => {
      if (line.length === 0) {
        return;
      }

      if (line[0] === "P" && line[2] == ":") {
        // const portid = Number(line[1])
        const [, msg] = line.split(":");
        if (cmp(msg, BuildHatConst.CONNECTED)) {
          console.log("connected", msg);
          // typeid = Number(line[2 + len(BuildHatConst.CONNECTED):], 16)
          // this.connections[portid].update(typeid, True)
          // if( typeid == 64) {
          //     this.write(f"port {portid} ; on\r".encode())
          // }
          // if (uselist) {
          //     count += 1
          // }
        } else if (cmp(msg, BuildHatConst.CONNECTEDPASSIVE)) {
          console.log("connect passive", msg);
          // typeid = int(line[2 + len(BuildHatConst.CONNECTEDPASSIVE):], 16)
          // this.connections[portid].update(typeid, True)
          // if (uselist) {
          //     count += 1
          // }
        } else if (cmp(msg, BuildHatConst.DISCONNECTED)) {
          console.log("disconnected", msg);
          // this.connections[portid].update(-1, false)
        } else if (cmp(msg, BuildHatConst.DEVTIMEOUT)) {
          console.log("DEVTIMEOUT", msg);
          // this.connections[portid].update(-1, false)
        } else if (cmp(msg, BuildHatConst.NOTCONNECTED)) {
          console.log("NOTCONNECTED", msg);
          // this.connections[portid].update(-1, false)
          // if( uselist) {
          //     count += 1
          // }
        } else if (cmp(msg, BuildHatConst.RAMPDONE)) {
          console.log("RAMPDONE", msg);
          // with this.rampcond[portid]:
          //     this.rampcond[portid].notify()
        } else if (cmp(msg, BuildHatConst.PULSEDONE)) {
          console.log("RAMPULSEDONEPDONE", msg);
          // with this.pulsecond[portid]:
          //     this.pulsecond[portid].notify()
        }
      }

      // if( uselist && count === 4) {
      //     with cond:
      //         uselist = False
      //         cond.notify()
      // }

      // if( ! uselist && cmp(line, BuildHatConst.DONE)) {
      //     const runit = () => {
      //         with cond:
      //             cond.notify()
      //     };
      //     t = Timer(8.0, runit)
      //     t.start()
      // }

      if (line[0] === "P" && (line[2] === "C" || line[2] === "M")) {
        const portid = Number(line[1]);
        const data: string[] = line.slice(5).split(" ");
        const newdata: number[] = [];
        data.forEach((d) => {
          if (d !== "") {
            newdata.push(Number(d));
          }
        });
        console.log("data", portid, newdata);
        // const callit = this.connections[portid].callit
        // if( callit ) {
        //     q.put([callit, newdata])
        // }
        // this.connections[portid].data = newdata
        // with this.portcond[portid]:
        //     this.portcond[portid].notify()
      }

      if (line.length >= 5 && line[1] === "." && line.endsWith(" V")) {
        const vin = Number(line.split(" ")[0]);
        // this.vin = vin
        console.log("vin", vin);
        // with this.vincond:
        //     this.vincond.notify()
      }
    });
  }
}
