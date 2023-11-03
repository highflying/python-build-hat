import { Device, DataMap, ModeMap } from "../Device";
import { BuildHAT, Port } from "../BuildHAT";
import { DeviceID } from "../device-map";

enum MotorRunmode {
  NONE = 0,
  FREE = 1,
  DEGREES = 2,
  SECONDS = 3,
}

type Direction = "shortest" | "clockwise" | "anticlockwise";

enum Mode {
  STATUS = 0x00,
  SPEED = 0x01,
  POSITION = 0x02,
  ABS_POSITION = 0x03,
  CALIB = 0x04,
  STATS = 0x05,
}

type Event =
  | "status"
  | "speed"
  | "position"
  | "absolutePosition"
  | "calib"
  | "stats";

const modeMap: ModeMap<Event> = {
  status: Mode.STATUS,
  speed: Mode.SPEED,
  position: Mode.POSITION,
  absolutePosition: Mode.ABS_POSITION,
  calib: Mode.CALIB,
  stats: Mode.STATS,
};

const dataMap: DataMap<Event> = {
  status: (data) => data,
  speed: (data) => data[0],
  position: (data) => data[0],
  absolutePosition: (data) => data[0],
  calib: (data) => data,
  stats: (data) => data,
};

export class Motor extends Device {
  private _runmode: MotorRunmode;
  private _currentspeed: number;

  constructor(hat: BuildHAT, port: Port, deviceId: DeviceID) {
    super(hat, port, deviceId, modeMap, dataMap);
    this._currentspeed = 0;

    this._runmode = MotorRunmode.NONE;
  }

  public static async factory(hat: BuildHAT, port: Port, deviceId: DeviceID) {
    const device = new this(hat, port, deviceId);

    console.log({ deviceId });
    if (String(deviceId) === "38") {
      await device.mode([
        [1, 0],
        [2, 0],
      ]);
    } else {
      await device.mode([
        [1, 0],
        [2, 0],
        [3, 0],
      ]);
    }
    await device.plimit(0.7);
    await device.bias(0.3);

    return device;
  }

  public run_for_rotations(rotations: number, speed: number) {
    this._runmode = MotorRunmode.DEGREES;
    if (speed < -100 || speed > 100) {
      throw new Error("Invalid Speed");
    }
    return this._run_for_degrees(rotations * 360, speed);
  }

  private async _run_for_degrees(degrees: number, speed: number) {
    this._runmode = MotorRunmode.DEGREES;
    let mul = 1;
    if (speed < 0) {
      speed = Math.abs(speed);
      mul = -1;
    }

    const pos = await new Promise<number>((resolve) => {
      this.once("position", (position) => resolve(position));
    });
    // console.log("initial pos", pos);

    const newpos = (degrees * mul + pos) / 360.0;
    // console.log("new pos", newpos);
    const normalisedPos = pos / 360.0;
    await this._run_positional_ramp(normalisedPos, newpos, speed);
    this._runmode = MotorRunmode.NONE;
  }

  private async _run_to_position(
    degrees: number,
    speed: number,
    direction: Direction
  ) {
    this._runmode = MotorRunmode.DEGREES;
    const data = await new Promise<number[]>((resolve) => {
      this.once("status", (position) => resolve(position));
    });
    let pos = Number(data[1]);
    const apos = Number(data[2]);
    const diff = ((degrees - apos + 180) % 360) - 180;
    let newpos = (pos + diff) / 360;
    const v1 = (degrees - apos) % 360;
    const v2 = (apos - degrees) % 360;
    let mul = 1;
    if (diff > 0) {
      mul = -1;
    }
    const diff2 = [diff, mul * (Math.abs(diff) === v1 ? v2 : v1)].sort();
    if (direction === "shortest") {
    } else if (direction == "clockwise") {
      newpos = (pos + diff2[1]) / 360;
    } else if (direction == "anticlockwise") {
      newpos = (pos + diff2[0]) / 360;
    } else {
      throw new Error(
        "Invalid direction, should be: shortest, clockwise or anticlockwise"
      );
    }
    // # Convert current motor position to decimal rotations from preset position to match newpos units
    pos /= 360.0;
    this._run_positional_ramp(pos, newpos, speed);
    this._runmode = MotorRunmode.NONE;
  }

  private async _run_positional_ramp(
    pos: number,
    newpos: number,
    speed: number
  ) {
    const collapsedSpeed = speed * 0.05;
    const dur = Math.abs((newpos - pos) / collapsedSpeed);
    // console.log({ pos, newpos, speed, dur, collapsedSpeed });
    const cmd =
      // `port ${this.port}; combi 0 1 0 2 0 3 0 ; select 0; pid ${this.port} 0 1 s4 0.0027777778 0 5 0 .1 3 0.01; ` +
      `port ${this.port}; combi 0 1 0 2 0 ; select 0; selrate 100; pid ${this.port} 0 1 s4 0.0027777778 0 5 0 .1 3; ` +
      `set ramp ${pos} ${newpos} ${dur} 0\r`;
    // console.log({ cmd });
    await this._write(cmd);
  }

  public run_for_degrees(degrees: number, speed: number) {
    this._runmode = MotorRunmode.DEGREES;

    if (speed < -100 || speed > 100) {
      throw new Error("Invalid Speed");
    }

    return this._run_for_degrees(degrees, speed);
  }

  public run_to_position(
    degrees: number,
    speed: number,
    direction: Direction = "shortest"
  ) {
    this._runmode = MotorRunmode.DEGREES;
    if (speed < 0 || speed > 100) {
      throw new Error("Invalid Speed");
    }
    if (degrees < -180 || degrees > 180) {
      throw new Error("Invalid angle");
    }

    return this._run_to_position(degrees, speed, direction);
  }

  private async _run_for_seconds(seconds: number, speed: number) {
    this._runmode = MotorRunmode.SECONDS;
    const cmd =
      // `port ${this.port} ; combi 0 1 0 2 0 3 0 ; select 0 ; pid ${this.port} 0 0 s1 1 0 0.003 0.01 0 100; ` +
      `port ${this.port} ; ` + `set pulse ${speed} 0.0 ${seconds} 0 \r`;
    await this._write(cmd);

    this._runmode = MotorRunmode.NONE;
  }

  public run_for_seconds(seconds: number, speed: number) {
    this._runmode = MotorRunmode.SECONDS;
    if (speed < 0 || speed > 100) {
      throw new Error("Invalid Speed");
    }
    return this._run_for_seconds(seconds, speed);
  }

  public setSpeed(speed: number) {
    if (this._runmode === MotorRunmode.FREE) {
      if (this._currentspeed == speed) {
        return;
      }
    } else if (this._runmode !== MotorRunmode.NONE) {
      return;
    }

    if (speed < 0 || speed > 100) {
      throw new Error("Invalid Speed");
    }

    let cmd = `port ${this.port} ; set ${speed}\r`;
    if (this._runmode === MotorRunmode.NONE) {
      cmd =
        // `port ${this.port} ; combi 0 1 0 2 0 3 0 ; pid ${this.port} 0 0 s1 1 0 0.003 0.01 0 100; ` +
        `port ${this.port}; ` + `set ${speed}\r`;
    }
    this._runmode = MotorRunmode.FREE;
    this._currentspeed = speed;
    return this._write(cmd);
  }

  public stop() {
    // """Stop motor"""
    this._runmode = MotorRunmode.NONE;
    this._currentspeed = 0;
    return this.coast();
  }

  public plimit(plimit: number) {
    if (plimit < 0 || plimit > 1) {
      throw new Error("plimit should be 0 to 1");
    }
    return this._write(`port ${this.port} ; plimit ${plimit}\r`);
  }

  public bias(bias: number) {
    if (bias < 0 || bias > 1) {
      throw new Error("bias should be 0 to 1");
    }
    return this._write(`port ${this.port} ; bias ${bias}\r`);
  }

  public async pwm(pwmv: number) {
    if (pwmv < -1 || pwmv > 1) {
      throw new Error("pwm should be -1 to 1");
    }
    await this._write(`port ${this.port} ; pwm ; set ${pwmv}\r`);
  }

  public coast() {
    return this._write(`port ${this.port} ; coast\r`);
  }

  public float() {
    return this.pwm(0);
  }
}
