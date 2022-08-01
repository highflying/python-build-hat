import { Device, DataMap, ModeMap } from "../Device";
import { BuildHAT, Port } from "../BuildHAT";
import { DeviceID } from "../device-map";

enum Mode {
  REFLECT = 0x01,
  AMBIENT = 0x02,
  RGB_I = 0x05,
}

type Event = "reflect" | "ambient" | "rgbIntensity";

const modeMap: ModeMap<Event> = {
  reflect: Mode.REFLECT,
  ambient: Mode.AMBIENT,
  rgbIntensity: Mode.RGB_I,
};

const dataMap: DataMap<Event> = {
  reflect: (data) => data[0],
  ambient: (data) => data[0],
  rgbIntensity: (data) => data.map(Number).map((value) => (value / 1024) * 255),
};

export class ColorSensor extends Device {
  constructor(hat: BuildHAT, port: Port, deviceId: DeviceID) {
    super(hat, port, deviceId, modeMap, dataMap);
  }

  public static async factory(hat: BuildHAT, port: Port, deviceId: DeviceID) {
    const device = new this(hat, port, deviceId);

    await device.switchOn();
    await device.mode(Mode.RGB_I);

    return device;
  }

  public switchOn() {
    return this._write(`port ${this.port} ; plimit 1 ; set -1\r`);
  }
}
