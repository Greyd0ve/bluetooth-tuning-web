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
  if (escape) buf += '\\';
  result.push(buf);
  return result.map((s) => s.trim());
}

export function escapePacketField(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]');
}

export function makePacket(parts, shortMode = false) {
  const mapped = shortMode ? parts.map((p) => SHORT_MAP[p] || p) : parts;
  return `[${mapped.map(escapePacketField).join(',')}]`;
}

/**
 * 从流式文本中提取完整的 [a,b,c] 数据包。
 * 相比正则匹配，这个状态机能处理串口/BLE 的分包、粘包，以及文本中的 \[、\] 转义。
 * 返回 rest，调用者应保存到下一次接收时继续拼接。
 */
export function extractPacketsFromStream(text, carry = '', maxCarry = 8192) {
  const data = `${carry || ''}${text || ''}`;
  const packets = [];
  let inPacket = false;
  let escaped = false;
  let start = -1;
  let content = '';

  for (let i = 0; i < data.length; i += 1) {
    const ch = data[i];
    if (!inPacket) {
      if (ch === '[') {
        inPacket = true;
        escaped = false;
        start = i;
        content = '';
      }
      continue;
    }

    if (escaped) {
      content += `\\${ch}`;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === ']') {
      packets.push(splitPacketContent(content));
      inPacket = false;
      escaped = false;
      start = -1;
      content = '';
      continue;
    }
    if (ch === '[') {
      // 遇到未转义的新包头，说明前一个包大概率损坏，直接以新的包头重新同步。
      start = i;
      content = '';
      escaped = false;
      continue;
    }
    content += ch;
  }

  let rest = '';
  let overflow = false;
  if (inPacket && start >= 0) rest = data.slice(start);
  if (rest.length > maxCarry) {
    rest = '';
    overflow = true;
  }
  return { packets, rest, overflow };
}

export function parsePacketsFromText(text) {
  return extractPacketsFromStream(text, '', Number.MAX_SAFE_INTEGER).packets;
}
