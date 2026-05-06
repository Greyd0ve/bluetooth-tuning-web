export const SHORT_MAP = { key: 'k', down: 'd', up: 'u', slider: 's', joystick: 'j' };

export function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function normalizeUuid(value) {
  const v = String(value || '').trim();
  if (/^0x[0-9a-f]{4}$/i.test(v)) return Number.parseInt(v, 16);
  if (/^[0-9a-f]{4}$/i.test(v)) return `0000${v.toLowerCase()}-0000-1000-8000-00805f9b34fb`;
  return v;
}

export function textToBytes(text, encoding = 'utf-8') {
  if (encoding.toLowerCase() === 'gbk') {
    console.warn('浏览器 TextEncoder 原生不支持 GBK，本版本按 UTF-8 发送。');
  }
  return new TextEncoder().encode(text);
}

export function bytesToText(bytes, encoding = 'utf-8') {
  if (encoding.toLowerCase() === 'gbk') {
    try {
      return new TextDecoder('gbk').decode(bytes);
    } catch {
      return new TextDecoder().decode(bytes);
    }
  }
  return new TextDecoder().decode(bytes);
}

export function hexToBytes(hex) {
  const cleaned = String(hex || '').replace(/[^0-9a-fA-F]/g, '');
  const out = [];
  for (let i = 0; i + 1 < cleaned.length; i += 2) out.push(Number.parseInt(cleaned.slice(i, i + 2), 16));
  return new Uint8Array(out);
}

export function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

export function splitPacketContent(content) {
  const result = [];
  let buf = '';
  let escape = false;
  for (const ch of String(content || '')) {
    if (escape) {
      buf += ch;
      escape = false;
    } else if (ch === '\\') {
      escape = true;
    } else if (ch === ',') {
      result.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  result.push(buf);
  return result.map((s) => s.trim());
}

export function makePacket(parts, shortMode = false) {
  const mapped = shortMode ? parts.map((p) => SHORT_MAP[p] || p) : parts;
  return `[${mapped.join(',')}]`;
}

export function parsePacketsFromText(text) {
  const packets = [];
  const regex = /\[([^\[\]]*)\]/g;
  let match;
  while ((match = regex.exec(String(text || '')))) {
    packets.push(splitPacketContent(match[1]));
  }
  return packets;
}
