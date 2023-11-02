import {
  ColorSensor,
  ColorDistanceSensor,
  DistanceSensor,
  ForceSensor,
  Light,
  Matrix,
  MotionSensor,
  Motor,
  PassiveMotor,
  TiltSensor,
} from "./devices";
import { BuildHAT, Port } from "./BuildHAT";

export enum DeviceID {
  SimpleMotor = 1,
  TrainMotor = 2,
  Light = 8,
  TiltSensor = 34,
  MotionSensor = 35,
  ColorDistanceSensor = 37,
  MediumLinearMotor = 38,
  LargeMotor = 46,
  XLMotor = 47,
  MediumAngularMotorCyan = 48,
  LargeAngularMotorCyan = 49,
  ColorSensor = 61,
  DistanceSensor = 62,
  ForceSensor = 63,
  Matrix = 64,
  SmallAngularMotor = 65,
  MediumAngularMotorGrey = 75,
  LargeAngularMotorGrey = 76,
}

export type BuildHatDevice = InstanceType<
  | typeof ColorDistanceSensor
  | typeof PassiveMotor
  | typeof Light
  | typeof TiltSensor
  | typeof MotionSensor
  | typeof Motor
  | typeof ColorSensor
  | typeof DistanceSensor
  | typeof ForceSensor
  | typeof Matrix
>;

export const DeviceMap = {
  [DeviceID.SimpleMotor]: PassiveMotor, // 45303
  [DeviceID.TrainMotor]: PassiveMotor, // 88011
  // Untested
  [DeviceID.Light]: Light, // 88005
  // Untested
  [DeviceID.TiltSensor]: TiltSensor, // 45305
  // Untested
  [DeviceID.MotionSensor]: MotionSensor, // 45304
  [DeviceID.ColorDistanceSensor]: ColorDistanceSensor, // 88007
  // Untested
  [DeviceID.MediumLinearMotor]: Motor, // 88008
  [DeviceID.LargeMotor]: Motor, // 88013
  [DeviceID.XLMotor]: Motor, // 88014
  [DeviceID.MediumAngularMotorCyan]: Motor, // 45603
  [DeviceID.LargeAngularMotorCyan]: Motor, // 45602
  // Untested
  [DeviceID.ColorSensor]: ColorSensor, // 45605
  // Untested
  [DeviceID.DistanceSensor]: DistanceSensor, // 45604
  // Untested
  [DeviceID.ForceSensor]: ForceSensor, // 45606
  // Untested
  [DeviceID.Matrix]: Matrix, // 45608
  // Untested
  [DeviceID.SmallAngularMotor]: Motor, // 45607
  // Untested
  [DeviceID.MediumAngularMotorGrey]: Motor, // 88018
  // Untested
  [DeviceID.LargeAngularMotorGrey]: Motor, // 88017
};

export const validateDeviceId = (typeId: number | string): DeviceID => {
  const id = String(typeId);
  if (!(DeviceMap as any)[id]) {
    throw new Error(`Unsupported device id ${typeId}`);
  }

  return id as unknown as keyof typeof DeviceMap;
};

export const DeviceFactory = <D extends DeviceID>(
  hat: BuildHAT,
  deviceId: D,
  port: Port
): Promise<InstanceType<(typeof DeviceMap)[D]>> => {
  const device = DeviceMap[deviceId];

  return device.factory(hat, port, deviceId) as Promise<
    InstanceType<(typeof DeviceMap)[D]>
  >;
};
