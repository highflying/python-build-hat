import { Device } from "../Device";
import { BuildHAT, Port } from "../BuildHAT";
import { DeviceID } from "../device-map";

type Coord = [number, number];
type Pixel = [number, number];
type MatrixGrid = [
  [Pixel, Pixel, Pixel],
  [Pixel, Pixel, Pixel],
  [Pixel, Pixel, Pixel]
];

export class Matrix extends Device {
  private _matrix: MatrixGrid;

  constructor(hat: BuildHAT, port: Port, deviceId: DeviceID) {
    super(hat, port, deviceId);
    this._matrix = [
      [
        [0, 0],
        [0, 0],
        [0, 0],
      ],
      [
        [0, 0],
        [0, 0],
        [0, 0],
      ],
      [
        [0, 0],
        [0, 0],
        [0, 0],
      ],
    ];
  }

  public static async factory(hat: BuildHAT, port: Port, deviceId: DeviceID) {
    const device = new this(hat, port, deviceId);

    await device.switchOn();
    await device.mode(2);

    return device;
  }

  public setPixels(matrix: MatrixGrid, display = true) {
    matrix.forEach((list, x) =>
      list.forEach((pixel: Pixel, y) => {
        matrix[x][y] = normalizePixel(pixel);
      })
    );

    this._matrix = matrix;
    if (display) {
      this.output();
    }
  }

  private async output() {
    const out = [0xc2];
    [0, 1, 2].forEach((x) =>
      [0, 1, 2].forEach((y) =>
        out.push((this._matrix[x][y][1] << 4) | this._matrix[x][y][0])
      )
    );
    await this.select();
    await this._write1(out.map((x) => x.toString(16)).join(""));
    await this.deselect();
  }

  public clear(pixel: [number | string, number] = [0, 0]) {
    const color = normalizePixel(pixel);
    this._matrix = [
      [color, color, color],
      [color, color, color],
      [color, color, color],
    ];
    return this.output();
  }

  public switchOff() {
    return this.clear();
  }

  public async level(level: number) {
    if (level < 0 || level > 9) {
      throw new Error("Invalid level specified");
    }
    await this.mode(0);
    await this.select();
    await this._write1("c0" + level.toString(16));
    await this.mode(2); // The rest of the Matrix code seems to expect this to be always set
    await this.deselect();
  }

  public async setTransition(transition: number) {
    if (transition < 0 || transition > 2) {
      throw new Error("Invalid transition specified");
    }
    await this.mode(3);
    await this.select();
    await this._write1("c3" + transition.toString(16));
    await this.mode(2); // The rest of the Matrix code seems to expect this to be always set
    await this.deselect();
  }

  public async set_pixel(coord: Coord, pixel: Pixel, display = true) {
    const color = normalizePixel(pixel);
    validateCoordinate(coord);
    const [x, y] = coord;
    this._matrix[x][y] = color;
    if (display) {
      await this.output();
    }
  }
}

const colorMap: Record<string, number> = {
  pink: 1,
  lilac: 2,
  blue: 3,
  cyan: 4,
  turquoise: 5,
  green: 6,
  yellow: 7,
  orange: 8,
  red: 9,
  white: 10,
  black: 0,
};

const colorNameToId = (colorstr: string): number => colorMap[colorstr] || 0;

const normalizePixel = (pixel: [number | string, number]): [number, number] => {
  const c = typeof pixel[0] === "string" ? colorNameToId(pixel[0]) : pixel[0];
  const brightness = pixel[1];

  if (brightness < 0 || brightness > 10) {
    throw new Error("Invalid brightness value specified");
  }
  if (c < 0 || c > 10) {
    throw new Error("Invalid pixel color specified");
  }
  return [c, brightness];
};

const validateCoordinate = (coord: Coord) => {
  if (coord[0] > 2 || coord[0] < 0 || coord[1] > 2 || coord[1] < 0) {
    throw new Error("Invalid coord specified");
  }
};
