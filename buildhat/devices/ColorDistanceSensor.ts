import { Device, DataMap, ModeMap } from "../Device";
import { BuildHAT, Port } from "../BuildHAT";
import { clamp } from "../utils";
import { DeviceID } from "../device-map";

enum Mode {
  COLOR = 0x00,
  DISTANCE = 0x01,
  DISTANCE_COUNT = 0x02,
  REFLECT = 0x03,
  AMBIENT = 0x04,
  LED = 0x05,
  RGB_I = 0x06,
  PF_IR = 0x07,
  COLOR_AND_DISTANCE = 0x08,
}

type Event =
  | "color"
  | "distance"
  | "distanceCount"
  | "reflect"
  | "ambient"
  | "rgbIntensity"
  | "colorAndDistance";

const modeMap: ModeMap<Event> = {
  color: Mode.COLOR,
  distance: Mode.DISTANCE,
  distanceCount: Mode.DISTANCE_COUNT,
  reflect: Mode.REFLECT,
  ambient: Mode.AMBIENT,
  rgbIntensity: Mode.RGB_I,
  colorAndDistance: Mode.COLOR_AND_DISTANCE,
};

const dataMap: DataMap<Event> = {
  color: (data) => data[0],
  distance: (data) => data[0],
  distanceCount: (data) => data[0],
  reflect: (data) => data[0],
  ambient: (data) => data[0],
  rgbIntensity: (data) =>
    data.map(Number).map((value) => (clamp(value, 0, 400) / 400) * 255),
  colorAndDistance: (data) => data,
};

export class ColorDistanceSensor extends Device {
  static get typeName() {
    return "COLOR_DISTANCE_SENSOR";
  }

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
