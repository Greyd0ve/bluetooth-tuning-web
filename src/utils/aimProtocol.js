export const AIM_FRAME_SIZE = 22;
export const AIM_HEADER0 = 0xAA;
export const AIM_HEADER1 = 0x55;
export const AIM_VERSION = 0x01;
export const AIM_MSG_VISION = 0x01;
export const AIM_COORD_INVALID = 0xFFFF;

export const AimTrackingState = {
  LOST: 0,
  ACQUIRING: 1,
  TRACKING: 2,
  HOLD: 3,
  FAULT: 4,
};

export const AimTrackingStateNames = {
  0: 'LOST',
  1: 'ACQUIRING',
  2: 'TRACKING',
  3: 'HOLD',
  4: 'FAULT',
};

export const AimValidFlags = {
  RECT_VALID: 0x01,
  LASER_VALID: 0x02,
  TARGET_LOCKED: 0x04,
  MEASUREMENT_FRESH: 0x08,
};

const CRC16_TABLE = [
  0x0000, 0x1021, 0x2042, 0x3063, 0x4084, 0x50A5, 0x60C6, 0x70E7,
  0x8108, 0x9129, 0xA14A, 0xB16B, 0xC18C, 0xD1AD, 0xE1CE, 0xF1EF,
  0x1231, 0x0210, 0x3273, 0x2252, 0x52B5, 0x4294, 0x72F7, 0x62D6,
  0x9339, 0x8318, 0xB37B, 0xA35A, 0xD3BD, 0xC39C, 0xF3FF, 0xE3DE,
  0x2462, 0x3443, 0x0420, 0x1401, 0x64E6, 0x74C7, 0x44A4, 0x5485,
  0xA56A, 0xB54B, 0x8528, 0x9509, 0xE5EE, 0xF5CF, 0xC5AC, 0xD58D,
  0x3653, 0x2672, 0x1611, 0x0630, 0x76D7, 0x66F6, 0x5695, 0x46B4,
  0xB75B, 0xA77A, 0x9719, 0x8738, 0xF7DF, 0xE7FE, 0xD79D, 0xC7BC,
  0x48C4, 0x58E5, 0x6886, 0x78A7, 0x0840, 0x1861, 0x2802, 0x3823,
  0xC9CC, 0xD9ED, 0xE98E, 0xF9AF, 0x8948, 0x9969, 0xA90A, 0xB92B,
  0x5AF5, 0x4AD4, 0x7AB7, 0x6A96, 0x1A71, 0x0A50, 0x3A33, 0x2A12,
  0xDBFD, 0xCBDC, 0xFBBF, 0xEB9E, 0x9B79, 0x8B58, 0xBB3B, 0xAB1A,
  0x6CA6, 0x7C87, 0x4CE4, 0x5CC5, 0x2C22, 0x3C03, 0x0C60, 0x1C41,
  0xEDAE, 0xFD8F, 0xCDEC, 0xDDCD, 0xAD2A, 0xBD0B, 0x8D68, 0x9D49,
  0x7E97, 0x6EB6, 0x5ED5, 0x4EF4, 0x3E13, 0x2E32, 0x1E51, 0x0E70,
  0xFF9F, 0xEFBE, 0xDFDD, 0xCFFC, 0xBF1B, 0xAF3A, 0x9F59, 0x8F78,
  0x9188, 0x81A9, 0xB1CA, 0xA1EB, 0xD10C, 0xC12D, 0xF14E, 0xE16F,
  0x1080, 0x00A1, 0x30C2, 0x20E3, 0x5004, 0x4025, 0x7046, 0x6067,
  0x83B9, 0x9398, 0xA3FB, 0xB3DA, 0xC33D, 0xD31C, 0xE37F, 0xF35E,
  0x02B1, 0x1290, 0x22F3, 0x32D2, 0x4235, 0x5214, 0x6277, 0x7256,
  0xB5EA, 0xA5CB, 0x95A8, 0x8589, 0xF56E, 0xE54F, 0xD52C, 0xC50D,
  0x34E2, 0x24C3, 0x14A0, 0x0481, 0x7466, 0x6447, 0x5424, 0x4405,
  0xA7DB, 0xB7FA, 0x8799, 0x97B8, 0xE75F, 0xF77E, 0xC71D, 0xD73C,
  0x26D3, 0x36F2, 0x0691, 0x16B0, 0x6657, 0x7676, 0x4615, 0x5634,
  0xD94C, 0xC96D, 0xF90E, 0xE92F, 0x99C8, 0x89E9, 0xB98A, 0xA9AB,
  0x5844, 0x4865, 0x7806, 0x6827, 0x18C0, 0x08E1, 0x3882, 0x28A3,
  0xCB7D, 0xDB5C, 0xEB3F, 0xFB1E, 0x8BF9, 0x9BD8, 0xABBB, 0xBB9A,
  0x4A75, 0x5A54, 0x6A37, 0x7A16, 0x0AF1, 0x1AD0, 0x2AB3, 0x3A92,
  0xFD2E, 0xED0F, 0xDD6C, 0xCD4D, 0xBDAA, 0xAD8B, 0x9DE8, 0x8DC9,
  0x7C26, 0x6C07, 0x5C64, 0x4C45, 0x3CA2, 0x2C83, 0x1CE0, 0x0CC1,
  0xEF1F, 0xFF3E, 0xCF5D, 0xDF7C, 0xAF9B, 0xBFBA, 0x8FD9, 0x9FF8,
  0x6E17, 0x7E36, 0x4E55, 0x5E74, 0x2E93, 0x3EB2, 0x0ED1, 0x1EF0,
];

export function crc16CcittFalse(data) {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = ((crc << 8) ^ CRC16_TABLE[((crc >> 8) ^ (data[i] & 0xFF)) & 0xFF]) & 0xFFFF;
  }
  return crc;
}

export function buildAimVisionFrame(fields) {
  const {
    sequence = 0,
    timestamp = 0,
    rect_x = AIM_COORD_INVALID,
    rect_y = AIM_COORD_INVALID,
    laser_x = AIM_COORD_INVALID,
    laser_y = AIM_COORD_INVALID,
    valid_flags = 0,
    tracking_state = 0,
  } = fields;

  const frame = new Uint8Array(AIM_FRAME_SIZE);
  const view = new DataView(frame.buffer);

  view.setUint8(0, AIM_HEADER0);
  view.setUint8(1, AIM_HEADER1);
  view.setUint8(2, AIM_VERSION);
  view.setUint8(3, AIM_MSG_VISION);
  view.setUint16(4, sequence & 0xFFFF, true);
  view.setUint32(6, (timestamp >>> 0) & 0xFFFFFFFF, true);
  view.setUint16(10, rect_x & 0xFFFF, true);
  view.setUint16(12, rect_y & 0xFFFF, true);
  view.setUint16(14, laser_x & 0xFFFF, true);
  view.setUint16(16, laser_y & 0xFFFF, true);
  view.setUint8(18, valid_flags & 0xFF);
  view.setUint8(19, tracking_state & 0xFF);

  const crc = crc16CcittFalse(frame.subarray(0, 20));
  view.setUint16(20, crc, true);

  return frame;
}

export function decodeAimVisionFrame(bytes) {
  if (!bytes || bytes.length < AIM_FRAME_SIZE) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const header0 = view.getUint8(0);
  const header1 = view.getUint8(1);
  if (header0 !== AIM_HEADER0 || header1 !== AIM_HEADER1) return null;

  const version = view.getUint8(2);
  const msg_type = view.getUint8(3);
  const sequence = view.getUint16(4, true);
  const timestamp = view.getUint32(6, true);
  const rect_x = view.getUint16(10, true);
  const rect_y = view.getUint16(12, true);
  const laser_x = view.getUint16(14, true);
  const laser_y = view.getUint16(16, true);
  const valid_flags = view.getUint8(18);
  const tracking_state = view.getUint8(19);
  const crc = view.getUint16(20, true);

  const computedCrc = crc16CcittFalse(bytes.subarray(0, 20));
  const crcValid = computedCrc === crc;

  return {
    header0, header1, version, msg_type,
    sequence, timestamp,
    rect_x, rect_y, laser_x, laser_y,
    valid_flags, tracking_state,
    crc, crcValid,
  };
}

export function validateAimVisionFields(fields) {
  const errors = [];
  const {
    rect_x, rect_y, laser_x, laser_y,
    valid_flags, tracking_state,
  } = fields;

  const rectValid = (valid_flags & AimValidFlags.RECT_VALID) !== 0;
  const laserValid = (valid_flags & AimValidFlags.LASER_VALID) !== 0;

  if (rectValid) {
    if (rect_x < 0 || rect_x > 639) errors.push(`RECT_VALID=1 时 rect_x 必须 0~639，当前 ${rect_x}`);
    if (rect_y < 0 || rect_y > 479) errors.push(`RECT_VALID=1 时 rect_y 必须 0~479，当前 ${rect_y}`);
  } else {
    if (rect_x !== AIM_COORD_INVALID) errors.push(`RECT_VALID=0 时 rect_x 必须为 65535，当前 ${rect_x}`);
    if (rect_y !== AIM_COORD_INVALID) errors.push(`RECT_VALID=0 时 rect_y 必须为 65535，当前 ${rect_y}`);
  }

  if (laserValid) {
    if (laser_x < 0 || laser_x > 639) errors.push(`LASER_VALID=1 时 laser_x 必须 0~639，当前 ${laser_x}`);
    if (laser_y < 0 || laser_y > 479) errors.push(`LASER_VALID=1 时 laser_y 必须 0~479，当前 ${laser_y}`);
  } else {
    if (laser_x !== AIM_COORD_INVALID) errors.push(`LASER_VALID=0 时 laser_x 必须为 65535，当前 ${laser_x}`);
    if (laser_y !== AIM_COORD_INVALID) errors.push(`LASER_VALID=0 时 laser_y 必须为 65535，当前 ${laser_y}`);
  }

  if (tracking_state < 0 || tracking_state > 4) {
    errors.push(`tracking_state 必须 0~4，当前 ${tracking_state}`);
  }

  return { valid: errors.length === 0, errors };
}

export function crc16CcittSelfTest() {
  const testData = new TextEncoder().encode('123456789');
  const result = crc16CcittFalse(testData);
  return result === 0x29B1;
}
