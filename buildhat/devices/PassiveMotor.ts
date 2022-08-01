import { Device } from "../Device";
import { BuildHAT, Port } from "../BuildHAT";
import { DeviceID } from "../device-map";

export class PassiveMotor extends Device {
  private _currentspeed = 0;

  public static async factory(hat: BuildHAT, port: Port, deviceId: DeviceID) {
    const device = new this(hat, port, deviceId);

    await device.plimit(0.7);
    await device.bias(0.3);

    return device;
  }

  public setPower(speed: number) {
    if (this._currentspeed === speed) {
      // # Already running at this speed, do nothing
      return;
    }

    if (speed < -100 || speed > 100) {
      throw new Error("Invalid Speed");
    }

    this._currentspeed = speed;
    const cmd = `port ${this.port} ; pwm ; set ${speed / 100}\r`;
    return this._write(cmd);
  }

  public async stop() {
    const cmd = `port ${this.port} ; off\r`;
    await this._write(cmd);
    this._currentspeed = 0;
  }

  public async coast() {
    await this._write(`port ${this.port} ; coast\r`);
    this._currentspeed = 0;
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
}
