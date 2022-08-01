import { Device, DataMap, ModeMap } from "../Device";
import { BuildHAT, Port } from "../BuildHAT";
import { DeviceID } from "../device-map";

enum Mode {
  DISTANCE = 0x00,
}

type Event = "distance";

const modeMap: ModeMap<Event> = {
  distance: Mode.DISTANCE,
};

const dataMap: DataMap<Event> = {
  distance: (data) => data,
};

export class DistanceSensor extends Device {
  constructor(hat: BuildHAT, port: Port, deviceId: DeviceID) {
    super(hat, port, deviceId, modeMap, dataMap);
  }

  public static async factory(hat: BuildHAT, port: Port, deviceId: DeviceID) {
    const device = new this(hat, port, deviceId);

    await device.switchOn();
    await device.mode(Mode.DISTANCE);

    return device;
  }

  public eyes(brightness: [number, number, number, number]) {
    const cmd = ["c5"];

    brightness.forEach((value) => {
      if (value < 0 || value > 100) {
        throw new Error("Need 4 brightness args, of 0 to 100");
      }

      cmd.push(value.toString(16));
    });

    return this._write1(cmd.join(""));
  }

  public switchOn() {
    return this._write(`port ${this.port} ; plimit 1 ; set -1\r`);
  }
}
