import { Device } from "../Device";

export class Light extends Device {
  public brightness(brightness: number) {
    if (brightness < 0 || brightness > 100) {
      throw new Error("Need brightness arg, of 0 to 100");
    }

    if (brightness === 0) {
      return this._write(`port ${this.port} ; off\r`);
    }

    return this._write(
      `port ${this.port} ; on ; plimit ${brightness / 100.0}\r`
    );
  }
}
