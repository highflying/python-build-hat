import { Device, DataMap, ModeMap } from "../Device";
import { BuildHAT, Port } from "../BuildHAT";
import { DeviceID } from "../device-map";

enum Mode {
  TILT = 0x00,
}

type Event = "tilt";

const modeMap: ModeMap<Event> = {
  tilt: Mode.TILT,
};

const dataMap: DataMap<Event> = {
  tilt: (data) => data,
};

export class TiltSensor extends Device {
  constructor(hat: BuildHAT, port: Port, deviceId: DeviceID) {
    super(hat, port, deviceId, modeMap, dataMap);
  }

  public static async factory(hat: BuildHAT, port: Port, deviceId: DeviceID) {
    const device = new this(hat, port, deviceId);

    await device.switchOn();
    await device.mode(Mode.TILT);

    return device;
  }
}
