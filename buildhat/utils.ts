export const pause = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(() => resolve(), ms));

export const calcChecksum = (data: Buffer) => {
  let u = BigInt(1);
  for (let i = 0; i < data.byteLength; i++) {
    if (u & BigInt(0x80000000)) {
      u = (u << BigInt(1)) ^ BigInt(0x1d872b41);
    } else {
      u = u << BigInt(1);
    }
    u = (u ^ BigInt(data.readUInt8(i))) & BigInt(0xffffffff);
  }
  return u;
};

export const clamp = (val: number, small: number, large: number): number =>
  Math.max(small, Math.min(val, large));
