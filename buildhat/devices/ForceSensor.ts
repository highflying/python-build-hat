import { Device, DataMap, ModeMap } from "../Device";
import { BuildHAT, Port } from "../BuildHAT";
import { DeviceID } from "../device-map";

enum Mode {
  FORCE = 0x00,
  PRESSED = 0x02,
  PEAK_FORCE = 0x03,
}

type Event = "force" | "pressed" | "peakForce";

const modeMap: ModeMap<Event> = {
  force: Mode.FORCE,
  pressed: Mode.PRESSED,
  peakForce: Mode.PEAK_FORCE,
};

const dataMap: DataMap<Event> = {
  force: (data) => data[0],
  pressed: (data) => data[0],
  peakForce: (data) => data[0],
};

export class ForceSensor extends Device {
  constructor(hat: BuildHAT, port: Port, deviceId: DeviceID) {
    super(hat, port, deviceId, modeMap, dataMap);
  }

  public static async factory(hat: BuildHAT, port: Port, deviceId: DeviceID) {
    const device = new this(hat, port, deviceId);

    await device.switchOn();
    await device.mode([
      [Mode.FORCE, 0],
      [Mode.PRESSED, 0],
      [Mode.PEAK_FORCE, 0],
    ]);

    return device;
  }

  public switchOn() {
    return this._write(`port ${this.port} ; plimit 1 ; set -1\r`);
  }
}
