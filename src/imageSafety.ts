export const MAX_AVATAR_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_RASTER_PIXELS = 16_000_000;
export const MAX_RASTER_SIDE = 8_192;
export const ACCEPTED_RASTER_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type RasterDimensions = {
  width: number;
  height: number;
};

function matches(bytes: Uint8Array, offset: number, signature: number[]) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function pngDimensions(bytes: Uint8Array, view: DataView): RasterDimensions | null {
  if (bytes.length < 24 || !matches(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    || !matches(bytes, 12, [0x49, 0x48, 0x44, 0x52])) {
    return null;
  }
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function isJpegStartOfFrame(marker: number) {
  return marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
}

function jpegDimensions(bytes: Uint8Array, view: DataView): RasterDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 1 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) return null;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 2 > bytes.length) return null;
    const segmentLength = view.getUint16(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) return null;
    if (isJpegStartOfFrame(marker)) {
      if (segmentLength < 7) return null;
      return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3) };
    }
    offset += segmentLength;
  }
  return null;
}

function readUint24LittleEndian(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function webpDimensions(bytes: Uint8Array, view: DataView): RasterDimensions | null {
  if (bytes.length < 20 || !matches(bytes, 0, [0x52, 0x49, 0x46, 0x46])
    || !matches(bytes, 8, [0x57, 0x45, 0x42, 0x50])) {
    return null;
  }
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkSize = view.getUint32(offset + 4, true);
    const dataOffset = offset + 8;
    if (chunkSize > bytes.length - dataOffset) return null;
    if (matches(bytes, offset, [0x56, 0x50, 0x38, 0x58]) && chunkSize >= 10) {
      return {
        width: readUint24LittleEndian(bytes, dataOffset + 4) + 1,
        height: readUint24LittleEndian(bytes, dataOffset + 7) + 1,
      };
    }
    if (matches(bytes, offset, [0x56, 0x50, 0x38, 0x4c]) && chunkSize >= 5 && bytes[dataOffset] === 0x2f) {
      const byte1 = bytes[dataOffset + 1];
      const byte2 = bytes[dataOffset + 2];
      const byte3 = bytes[dataOffset + 3];
      const byte4 = bytes[dataOffset + 4];
      return {
        width: 1 + byte1 + ((byte2 & 0x3f) << 8),
        height: 1 + (byte2 >> 6) + (byte3 << 2) + ((byte4 & 0x0f) << 10),
      };
    }
    if (matches(bytes, offset, [0x56, 0x50, 0x38, 0x20]) && chunkSize >= 10
      && matches(bytes, dataOffset + 3, [0x9d, 0x01, 0x2a])) {
      return {
        width: view.getUint16(dataOffset + 6, true) & 0x3fff,
        height: view.getUint16(dataOffset + 8, true) & 0x3fff,
      };
    }
    offset = dataOffset + chunkSize + (chunkSize % 2);
  }
  return null;
}

export function readRasterDimensions(buffer: ArrayBuffer): RasterDimensions {
  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const dimensions = pngDimensions(bytes, view)
    || jpegDimensions(bytes, view)
    || webpDimensions(bytes, view);
  if (!dimensions || dimensions.width <= 0 || dimensions.height <= 0) {
    throw new Error("图片格式无效或不受支持");
  }
  return dimensions;
}

export function assertSafeRasterDimensions(buffer: ArrayBuffer) {
  const dimensions = readRasterDimensions(buffer);
  if (dimensions.width > MAX_RASTER_SIDE || dimensions.height > MAX_RASTER_SIDE
    || dimensions.width * dimensions.height > MAX_RASTER_PIXELS) {
    throw new Error("图片像素尺寸过大");
  }
  return dimensions;
}

export function boundedCanvasScale(
  width: number,
  height: number,
  requestedScale: number,
  maxPixels = MAX_RASTER_PIXELS,
) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || !Number.isFinite(requestedScale)
    || !Number.isFinite(maxPixels) || width <= 0 || height <= 0 || requestedScale <= 0 || maxPixels <= 0) {
    throw new Error("页面尺寸无效");
  }
  return Math.min(
    requestedScale,
    Math.sqrt(maxPixels / (width * height)),
    MAX_RASTER_SIDE / width,
    MAX_RASTER_SIDE / height,
  );
}
