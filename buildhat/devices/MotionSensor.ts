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

export class MotionSensor extends Device {
  constructor(hat: BuildHAT, port: Port, deviceId: DeviceID) {
    super(hat, port, deviceId, modeMap, dataMap);
  }

  public static async factory(hat: BuildHAT, port: Port, deviceId: DeviceID) {
    const device = new this(hat, port, deviceId);

    await device.switchOn();
    await device.mode(Mode.DISTANCE);

    return device;
  }
}
