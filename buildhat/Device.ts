// """Functionality for handling Build HAT devices"""

import { BuildHAT, Port } from "./BuildHAT";
import { EventEmitter } from "stream";
import DebugFactory from "debug";
import { DeviceID } from "./device-map";

const debug = DebugFactory("buildhat:devices");

export type ModeMap<T extends string = string> = Record<T, number>;

export type DataMap<T extends string = string> = Record<
  T,
  (data: number[]) => number | number[]
>;

// const UNKNOWN_DEVICE = "Unknown";
// const DISCONNECTED_DEVICE = "Disconnected";

export class Device extends EventEmitter {
  // """Creates a single instance of the buildhat for all devices to use"""

  protected port: number;
  private _simplemode: number;
  private _combimode: number;
  protected typeId: number;
  private _autoSubscribe = true;
  private _hat: BuildHAT;
  protected modeMap: Record<string, number> = {};
  protected dataMap:
    | {
        [event: string]: (data: number[]) => number | number[];
      }
    | undefined;

  private listenerCounts: Record<string, number> = {};

  public static async factory(hat: BuildHAT, port: Port, deviceId: DeviceID) {
    const device = new this(hat, port, deviceId);

    return device;
  }

  public constructor(
    hat: BuildHAT,
    port: Port,
    deviceId: DeviceID,
    modeMap: ModeMap = {},
    dataMap: DataMap = {},
  ) {
    super();

    this.typeId = deviceId;
    this.modeMap = modeMap;
    this.dataMap = dataMap;

    // """Initialise device

    // :param port: Port of device
    // :raises DeviceError: Occurs if incorrect port specified or port already used
    // """

    this._hat = hat;

    const p = port;
    this.port = p;
    this._simplemode = -1;
    this._combimode = -1;

    const eventAttachListener = (event: string) => {
      if (event === "detach") {
        return;
      }
      debug("Someone listening for", event);
      if (this._autoSubscribe) {
        if (this.modeMap[event] !== undefined) {
          debug("Subscribing to", event);
          this.listenerCounts[event]++;
          this.subscribe(this.modeMap[event]);
        }
      }
    };

    const deviceDetachListener = (device: Device) => {
      if (device.port === this.port) {
        // this._connected = false;
        this._hat.removeListener("detach", deviceDetachListener);
        this.emit("detach");
      }
    };

    this._hat.on("newListener", eventAttachListener);
    this.on("newListener", eventAttachListener);
    this._hat.on("detach", deviceDetachListener);
    this.on("removeListener", (event) => {
      this.listenerCounts[event]--;

      if (this.listenerCounts[event] < 0) {
        this.listenerCounts[event] = 0;
      }

      if (!this.listenerCounts[event]) {
        this._write(`port ${this.port}; select \r`);
      }
    });

    this._hat.on(
      "data",
      (data: {portId: Port, type: "C" | "M", mode: number, data: number[]}) => {
        if (data.portId !== this.port) {
          return;
        }

        const match = Object.entries(this.modeMap).find(
          ([_event, modeId]) => data.mode === modeId,
        );
        if (!match) {
          debug("Not listening for", data.portId, data.mode);
          return;
        }

        const mappedData = this.dataMapper(match[0], data.data);

        this.emit(match[0], mappedData);
      },
    );
  }

  private dataMapper(event: string, data: number[]): number | number[] {
    if (!this.dataMap) {
      return data;
    }

    const map = this.dataMap;
    if (!map) {
      return data;
    }

    const dataMapper = map[event];

    if (!dataMapper) {
      return data;
    }

    return dataMapper(data);
  }

  public subscribe(mode: number) {
    return this._write(`port ${this.port} ; select ${mode}\r`);
  }

  //   private __del__() {
  //     // """Handle deletion of device"""
  //     if (this.port && Device._used[this.port]) {
  //       Device._used[this.port] = false;
  //       //   this._conn.callit = undefined;
  //       this.deselect();
  //       this.off();
  //     }
  //   }

  public get typeid() {
    // """Type ID of device

    // :return: Type ID
    // """
    return this.typeId;
  }

  public isconnected() {
    // """Whether it is connected or not

    // :raises DeviceError: Occurs if device no longer the same
    // """
    // if (!this.connected) {
    //   throw new Error("No device found");
    // }
    // if (this.typeid !== this.typeidcur) {
    //   throw new Error("Device has changed");
    // }
    // TODO
    return true;
  }

  public reverse() {
    // """Reverse polarity"""
    this._write(`port ${this.port} ; plimit 1 ; set -1\r`);
  }

  public async get(): Promise<number[]> {
    // """Extract information from device

    // :return: Data from device
    // :raises DeviceError: Occurs if device not in valid mode
    // """
    this.isconnected();
    let idx = -1;
    if (this._simplemode !== -1) {
      idx = this._simplemode;
    } else if (this._combimode !== -1) {
      idx = this._combimode;
    } else {
      throw new Error("Not in simple or combimode");
    }
    await this._write(`port ${this.port} ; selonce ${idx}\r`);
    // FIXME
    // # wait for data
    // with Device._instance.portcond[self.port]:
    //     Device._instance.portcond[self.port].wait()
    // return self._conn.data

    const data = await this._hat.read();
    return data.split(" ").map(Number);
  }

  public async mode(modev: number | [number, number][]) {
    // """Set combimode or simple mode

    // :param modev: List of tuples for a combimode, or integer for simple mode
    // """
    this.isconnected();
    if (Array.isArray(modev)) {
      this._combimode = 0;
      const modestr = modev.map(([t1, t2]) => `${t1} ${t2}`).join(" ");
      await this._write(
        `port ${this.port} ; combi ${this._combimode} ${modestr}\r`,
      );
      this._simplemode = -1;
    } else {
      // # Remove combi mode
      if (this._combimode !== -1) {
        await this._write(`port ${this.port} ; combi ${this._combimode}\r`);
      }
      this._combimode = -1;
      this._simplemode = modev;
    }
  }

  public select() {
    // """Request data from mode

    // :raises DeviceError: Occurs if device not in valid mode
    // """
    this.isconnected();
    let idx = 0;
    if (this._simplemode !== -1) {
      idx = this._simplemode;
    } else if (this._combimode !== -1) {
      idx = this._combimode;
    } else {
      throw new Error("Not in simple or combimode");
    }
    return this._write(`port ${this.port} ; select ${idx}\r`);
  }

  public switchOn() {
    // """Turn on sensor"""
    return this._write(`port ${this.port} ; plimit 1 ; on\r`);
  }

  public switchOff() {
    // """Turn off sensor"""
    return this._write(`port ${this.port} ; off\r`);
  }

  public deselect() {
    // """Unselect data from mode"""
    return this._write(`port ${this.port} ; select\r`);
  }

  protected _write(cmd: string) {
    this.isconnected();
    return this._hat.writeStr(cmd);
  }

  protected _write1(data: string) {
    // hexstr = ' '.join(f'{h:x}' for h in data)
    const hexstr = data;
    return this._hat.writeStr(`port ${this.port} ; write1 ${hexstr}\r`);
  }

  public waitForEvent(event: string) {
    return new Promise<number | number[]>((resolve) => {
      this.once(event, (data) => resolve(data));
    });
  }
}
