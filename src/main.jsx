import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Bluetooth,
  Cable,
  Send,
  Trash2,
  Settings,
  Gamepad2,
  SlidersHorizontal,
  SquareMousePointer,
  Monitor,
  Activity,
  RefreshCw,
  Download,
  Car,
  RotateCcw,
  Palette,
  HelpCircle,
  BookOpen,
  Paintbrush,
  Pause,
  Play,
  Maximize2,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import './styles.css';

const CONFIG_KEY = 'bluetooth_tuning_web_config_v4';

const PRESETS = {
  nordic: {
    label: 'Nordic UART / 常见 BLE UART',
    service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
    write: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
    notify: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
  },
  ffe0: {
    label: 'FFE0 / FFE1 常见国产 BLE 模块',
    service: '0000ffe0-0000-1000-8000-00805f9b34fb',
    write: '0000ffe1-0000-1000-8000-00805f9b34fb',
    notify: '0000ffe1-0000-1000-8000-00805f9b34fb',
  },
  custom: { label: '自定义 UUID', service: '', write: '', notify: '' },
};

const SHORT_MAP = { key: 'k', down: 'd', up: 'u', slider: 's', joystick: 'j' };

const PLOT_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea',
  '#ea580c', '#0891b2', '#be185d', '#4f46e5', '#65a30d',
];

const DEFAULT_JOYSTICK_CONFIG = {
  maxX: 100,
  maxY: 100,
  stepX: 1,
  stepY: 1,
  deadzone: 5,
  invertX: false,
  invertY: false,
  shape: 'square',
};

const DEFAULT_DRIVE_SETTINGS = {
  targetSpeed: 0,
  kp: 120,
  ki: 0,
  kd: 0,
  leftBias: 0,
  rightBias: 0,
};

const DEFAULT_PLOT_SETTINGS = {
  paused: false,
  autoScroll: true,
  maxPoints: 300,
  yAxisMode: 'auto',
  yMin: -120,
  yMax: 120,
};

const DEFAULT_APPEARANCE = {
  themeName: '蓝色清爽',
  primary: '#2563eb',
  accent: '#16a34a',
  danger: '#dc2626',
  background: '#eef2f7',
  card: '#ffffff',
  text: '#0f172a',
  muted: '#64748b',
  border: '#e2e8f0',
  input: '#ffffff',
  radius: 20,
  fontScale: 1,
  density: 'comfortable',
  shadow: 'soft',
};

const THEME_PRESETS = {
  '蓝色清爽': {
    primary: '#2563eb', accent: '#16a34a', danger: '#dc2626', background: '#eef2f7', card: '#ffffff', text: '#0f172a', muted: '#64748b', border: '#e2e8f0', input: '#ffffff', shadow: 'soft',
  },
  '深色科技': {
    primary: '#38bdf8', accent: '#22c55e', danger: '#fb7185', background: '#020617', card: '#0f172a', text: '#e5e7eb', muted: '#94a3b8', border: '#334155', input: '#111827', shadow: 'glow',
  },
  '竞赛红黑': {
    primary: '#ef4444', accent: '#f59e0b', danger: '#b91c1c', background: '#111827', card: '#1f2937', text: '#f9fafb', muted: '#d1d5db', border: '#374151', input: '#111827', shadow: 'soft',
  },
  '护眼绿色': {
    primary: '#16a34a', accent: '#0f766e', danger: '#dc2626', background: '#ecfdf5', card: '#ffffff', text: '#064e3b', muted: '#047857', border: '#bbf7d0', input: '#ffffff', shadow: 'soft',
  },
  '简洁灰白': {
    primary: '#475569', accent: '#2563eb', danger: '#dc2626', background: '#f8fafc', card: '#ffffff', text: '#111827', muted: '#64748b', border: '#d1d5db', input: '#ffffff', shadow: 'flat',
  },
};

const DRIVE_FIELDS = [
  { key: 'targetSpeed', label: '目标速度', packet: 'target', min: -500, max: 500, step: 1 },
  { key: 'kp', label: 'Kp', packet: 'Kp', min: 0, max: 1000, step: 1 },
  { key: 'ki', label: 'Ki', packet: 'Ki', min: 0, max: 1000, step: 1 },
  { key: 'kd', label: 'Kd', packet: 'Kd', min: 0, max: 1000, step: 1 },
  { key: 'leftBias', label: '左轮补偿', packet: 'leftBias', min: -100, max: 100, step: 1 },
  { key: 'rightBias', label: '右轮补偿', packet: 'rightBias', min: -100, max: 100, step: 1 },
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function Button({ children, variant = 'primary', className = '', ...props }) {
  return <button className={`btn ${variant} ${className}`} {...props}>{children}</button>;
}

function Card({ children, className = '' }) {
  return <section className={`card ${className}`}>{children}</section>;
}

function normalizeUuid(value) {
  const v = String(value || '').trim();
  if (/^0x[0-9a-f]{4}$/i.test(v)) return Number.parseInt(v, 16);
  if (/^[0-9a-f]{4}$/i.test(v)) return `0000${v.toLowerCase()}-0000-1000-8000-00805f9b34fb`;
  return v;
}

function loadSavedConfig() {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

function saveConfig(config) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    // localStorage 可能在隐私模式下不可用，忽略即可。
  }
}

function textToBytes(text, encoding = 'utf-8') {
  if (encoding.toLowerCase() === 'gbk') {
    console.warn('浏览器原生 TextEncoder 不支持 GBK，本版本发送端仍按 UTF-8 编码。');
  }
  return new TextEncoder().encode(text);
}

function bytesToText(bytes, encoding = 'utf-8') {
  if (encoding.toLowerCase() === 'gbk') {
    try { return new TextDecoder('gbk').decode(bytes); } catch { return new TextDecoder().decode(bytes); }
  }
  return new TextDecoder().decode(bytes);
}

function hexToBytes(hex) {
  const cleaned = hex.replace(/[^0-9a-fA-F]/g, '');
  const out = [];
  for (let i = 0; i + 1 < cleaned.length; i += 2) out.push(Number.parseInt(cleaned.slice(i, i + 2), 16));
  return new Uint8Array(out);
}

function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

function splitPacketContent(content) {
  const result = [];
  let buf = '';
  let escape = false;
  for (const ch of content) {
    if (escape) { buf += ch; escape = false; }
    else if (ch === '\\') escape = true;
    else if (ch === ',') { result.push(buf); buf = ''; }
    else buf += ch;
  }
  result.push(buf);
  return result.map((s) => s.trim());
}

function makePacket(parts, shortMode) {
  const mapped = shortMode ? parts.map((p) => SHORT_MAP[p] || p) : parts;
  return `[${mapped.join(',')}]`;
}

function csvEscape(value) {
  const s = value === undefined || value === null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function formatNumber(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return Number.isInteger(n) ? String(n) : n.toFixed(digits);
}

function calcStats(rows, key) {
  const values = rows.map((row) => Number(row[key])).filter(Number.isFinite);
  if (!values.length) return { latest: '-', max: '-', min: '-', avg: '-' };
  const latestRaw = values[values.length - 1];
  const max = Math.max(...values);
  const min = Math.min(...values);
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return { latest: formatNumber(latestRaw), max: formatNumber(max), min: formatNumber(min), avg: formatNumber(avg) };
}

function SectionTitle({ icon: Icon, title, right }) {
  return <div className="section-title"><div className="section-title-left"><Icon size={20} /><h2>{title}</h2></div>{right}</div>;
}

function ColorControl({ label, value, onChange }) {
  return <label className="color-control">
    <span>{label}</span>
    <div className="color-row">
      <input className="color-picker" type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      <input className="color-text" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  </label>;
}

function Joystick({ label, config, value, onChange, onActiveChange = () => {}, onRelease = () => {} }) {
  const ref = useRef(null);
  const pointerId = useRef(null);
  const maxX = Math.max(1, Number(config.maxX) || 100);
  const maxY = Math.max(1, Number(config.maxY) || 100);

  const applyConfig = (dx, dy) => {
    let nx = clamp(dx, -1, 1);
    let ny = clamp(dy, -1, 1);
    if (config.shape === 'circle') {
      const r = Math.hypot(nx, ny);
      if (r > 1) { nx /= r; ny /= r; }
    }
    const sx = Math.max(1, Number(config.stepX) || 1);
    const sy = Math.max(1, Number(config.stepY) || 1);
    let x = Math.round((nx * maxX) / sx) * sx;
    let y = Math.round((ny * maxY) / sy) * sy;
    const deadzone = Math.max(0, Number(config.deadzone) || 0);
    if (Math.abs(x) <= deadzone) x = 0;
    if (Math.abs(y) <= deadzone) y = 0;
    if (config.invertX) x = -x;
    if (config.invertY) y = -y;
    return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
  };

  const updateFromPointer = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (cy - e.clientY) / (rect.height / 2);
    onChange(applyConfig(dx, dy));
  };

  return <div className="joystick-wrap">
    <div className="small-title">{label}: X={value.x}, Y={value.y}</div>
    <div
      ref={ref}
      className={`joystick ${config.shape === 'circle' ? 'circle' : ''}`}
      onPointerDown={(e) => { pointerId.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); onActiveChange(true); updateFromPointer(e); }}
      onPointerMove={(e) => { if (pointerId.current === e.pointerId) updateFromPointer(e); }}
      onPointerUp={() => { pointerId.current = null; onChange({ x: 0, y: 0 }); onActiveChange(false); onRelease(); }}
      onPointerCancel={() => { pointerId.current = null; onChange({ x: 0, y: 0 }); onActiveChange(false); onRelease(); }}
    >
      <div className="joy-v" />
      <div className="joy-h" />
      <div
        className="joy-dot"
        style={{ left: `${50 + (clamp(value.x, -maxX, maxX) / maxX) * 45}%`, top: `${50 - (clamp(value.y, -maxY, maxY) / maxY) * 45}%` }}
      >●</div>
    </div>
  </div>;
}

function App() {
  const saved = useMemo(loadSavedConfig, []);

  const [tab, setTab] = useState(saved.tab || 'serial');
  const [status, setStatus] = useState(saved.loopbackMode ? '环回模式：无需连接蓝牙' : '未连接');
  const [preset, setPreset] = useState(saved.preset || 'nordic');
  const [uuids, setUuids] = useState(saved.uuids || PRESETS[saved.preset || 'nordic'] || PRESETS.nordic);
  const [encoding, setEncoding] = useState(saved.encoding || 'utf-8');
  const [newline, setNewline] = useState(saved.newline || '\\r\\n');
  const [packetNewline, setPacketNewline] = useState(saved.packetNewline ?? true);
  const [shortPacket, setShortPacket] = useState(saved.shortPacket ?? false);
  const [sendInterval, setSendInterval] = useState(saved.sendInterval ?? 20);
  const [packetInterval, setPacketInterval] = useState(saved.packetInterval ?? 30);
  const [cacheSize, setCacheSize] = useState(saved.cacheSize ?? 8000);
  const [rxMode, setRxMode] = useState(saved.rxMode || 'text');
  const [txMode, setTxMode] = useState(saved.txMode || 'text');
  const [txText, setTxText] = useState(saved.txText || 'Hello');
  const [loopbackMode, setLoopbackMode] = useState(saved.loopbackMode ?? false);
  const [rxLog, setRxLog] = useState('');
  const [txLog, setTxLog] = useState('');
  const [displayItems, setDisplayItems] = useState([]);
  const [plotData, setPlotData] = useState([]);
  const [plotChannelSettings, setPlotChannelSettings] = useState(saved.plotChannelSettings || {
    CH1: { name: '当前速度', visible: true },
    CH2: { name: '目标速度', visible: true },
    CH3: { name: 'PWM输出', visible: true },
  });
  const [plotPaused, setPlotPaused] = useState(saved.plotPaused ?? DEFAULT_PLOT_SETTINGS.paused);
  const [plotAutoScroll, setPlotAutoScroll] = useState(saved.plotAutoScroll ?? DEFAULT_PLOT_SETTINGS.autoScroll);
  const [plotMaxPoints, setPlotMaxPoints] = useState(saved.plotMaxPoints ?? DEFAULT_PLOT_SETTINGS.maxPoints);
  const [plotYAxisMode, setPlotYAxisMode] = useState(saved.plotYAxisMode || DEFAULT_PLOT_SETTINGS.yAxisMode);
  const [plotYMin, setPlotYMin] = useState(saved.plotYMin ?? DEFAULT_PLOT_SETTINGS.yMin);
  const [plotYMax, setPlotYMax] = useState(saved.plotYMax ?? DEFAULT_PLOT_SETTINGS.yMax);
  const [pausedPlotPackets, setPausedPlotPackets] = useState(0);
  const [buttons, setButtons] = useState(saved.buttons || [
    { name: '1', lock: false, state: false },
    { name: '2', lock: false, state: false },
    { name: 'LED', lock: true, state: false },
  ]);
  const [sliders, setSliders] = useState(saved.sliders || [
    { name: '1', min: 0, max: 100, step: 1, value: 50 },
    { name: '2', min: -100, max: 100, step: 1, value: 0 },
  ]);
  const [leftJoy, setLeftJoy] = useState({ x: 0, y: 0 });
  const [rightJoy, setRightJoy] = useState({ x: 0, y: 0 });
  const [activeJoys, setActiveJoys] = useState({ left: false, right: false });
  const [joystickContinuous, setJoystickContinuous] = useState(saved.joystickContinuous ?? true);
  const [joystickConfig, setJoystickConfig] = useState({ ...DEFAULT_JOYSTICK_CONFIG, ...(saved.joystickConfig || {}) });
  const [driveSettings, setDriveSettings] = useState({ ...DEFAULT_DRIVE_SETTINGS, ...(saved.driveSettings || {}) });
  const [appearance, setAppearance] = useState({ ...DEFAULT_APPEARANCE, ...(saved.appearance || {}) });

  const bluetoothRef = useRef({ device: null, server: null, writeChar: null, notifyChar: null });
  const packetTimer = useRef(0);
  const plotIndex = useRef(0);
  const leftJoyRef = useRef(leftJoy);
  const rightJoyRef = useRef(rightJoy);
  const joystickSendingRef = useRef(false);
  const rxPacketBufferRef = useRef('');
  const plotStartTimeRef = useRef(null);
  const plotPausedRef = useRef(plotPaused);
  const newlineValue = useMemo(() => newline.replace('\\r', '\r').replace('\\n', '\n'), [newline]);
  const pageStyle = useMemo(() => ({
    '--app-primary': appearance.primary,
    '--app-accent': appearance.accent,
    '--app-danger': appearance.danger,
    '--app-bg': appearance.background,
    '--app-card': appearance.card,
    '--app-text': appearance.text,
    '--app-muted': appearance.muted,
    '--app-border': appearance.border,
    '--app-input': appearance.input,
    '--app-radius': `${appearance.radius}px`,
    '--app-font-scale': Number(appearance.fontScale) || 1,
  }), [appearance]);

  const updateLeftJoy = (value) => { leftJoyRef.current = value; setLeftJoy(value); };
  const updateRightJoy = (value) => { rightJoyRef.current = value; setRightJoy(value); };
  const setJoyActive = (side, active) => setActiveJoys((old) => old[side] === active ? old : { ...old, [side]: active });
  const isJoystickActive = activeJoys.left || activeJoys.right;

  useEffect(() => {
    if (preset !== 'custom') setUuids(PRESETS[preset]);
  }, [preset]);

  useEffect(() => {
    saveConfig({
      tab,
      preset,
      uuids,
      encoding,
      newline,
      packetNewline,
      shortPacket,
      sendInterval,
      packetInterval,
      cacheSize,
      rxMode,
      txMode,
      txText,
      loopbackMode,
      plotChannelSettings,
      plotPaused,
      plotAutoScroll,
      plotMaxPoints,
      plotYAxisMode,
      plotYMin,
      plotYMax,
      buttons,
      sliders,
      joystickContinuous,
      joystickConfig,
      driveSettings,
      appearance,
    });
  }, [tab, preset, uuids, encoding, newline, packetNewline, shortPacket, sendInterval, packetInterval, cacheSize, rxMode, txMode, txText, loopbackMode, plotChannelSettings, plotPaused, plotAutoScroll, plotMaxPoints, plotYAxisMode, plotYMin, plotYMax, buttons, sliders, joystickContinuous, joystickConfig, driveSettings, appearance]);

  useEffect(() => {
    plotPausedRef.current = plotPaused;
  }, [plotPaused]);

  useEffect(() => {
    if (loopbackMode) setStatus('环回模式：无需连接蓝牙，发送内容会直接进入接收区');
    else if (!bluetoothRef.current.device) setStatus('未连接');
  }, [loopbackMode]);

  const appendRx = (text) => setRxLog((old) => {
    const next = old + text;
    const size = Number(cacheSize) || 0;
    return size > 0 && next.length > size ? next.slice(next.length - size) : next;
  });
  const appendTx = (text) => setTxLog((old) => `${old}${text}\n`.slice(-12000));

  const handlePacket = (parts) => {
    const cmd = (parts[0] || '').toLowerCase();
    if (cmd === 'display' || cmd === 'd') {
      const x = Number(parts[1] || 0);
      const y = Number(parts[2] || 0);
      const maybeSize = Number(parts[parts.length - 1]);
      const hasSize = parts.length >= 5 && Number.isFinite(maybeSize);
      const content = parts.slice(3, hasSize ? -1 : undefined).join(',');
      const size = hasSize ? maybeSize : 18;
      setDisplayItems((old) => [...old.filter((it) => !(it.x === x && it.y === y)), { x, y, content, size }].slice(-300));
    } else if (cmd === 'display-clear' || cmd === 'd-c') {
      setDisplayItems([]);
    } else if (cmd === 'plot' || cmd === 'p') {
      const values = parts.slice(1, 11).map(Number).filter(Number.isFinite);
      if (values.length) {
        if (plotPausedRef.current) {
          setPausedPlotPackets((old) => old + 1);
          return;
        }
        const now = Date.now();
        if (!plotStartTimeRef.current) plotStartTimeRef.current = now;
        const timeMs = now - plotStartTimeRef.current;
        const row = { idx: plotIndex.current++, timeMs, timeS: Number((timeMs / 1000).toFixed(3)), timeIso: new Date(now).toISOString() };
        values.forEach((v, i) => { row[`CH${i + 1}`] = v; });
        setPlotData((old) => [...old, row].slice(-20000));
      }
    } else if (cmd === 'plot-clear' || cmd === 'p-c') {
      plotIndex.current = 0;
      plotStartTimeRef.current = null;
      setPausedPlotPackets(0);
      setPlotData([]);
    }
  };

  const parsePackets = (text) => {
    let buffer = `${rxPacketBufferRef.current}${text}`;
    const regex = /\[([^\[\]]*)\]/g;
    let match;
    let lastIndex = 0;
    while ((match = regex.exec(buffer))) {
      lastIndex = regex.lastIndex;
      handlePacket(splitPacketContent(match[1]));
    }
    buffer = buffer.slice(lastIndex);
    if (buffer.length > 2000) {
      const start = buffer.lastIndexOf('[');
      buffer = start >= 0 ? buffer.slice(start) : '';
    }
    rxPacketBufferRef.current = buffer;
  };

  const onNotify = (event) => {
    const bytes = new Uint8Array(event.target.value.buffer);
    const decodedText = bytesToText(bytes, encoding);
    const text = rxMode === 'hex' ? `${bytesToHex(bytes)} ` : decodedText;
    appendRx(text);
    parsePackets(decodedText);
  };

  const connectBluetooth = async () => {
    if (loopbackMode) {
      setStatus('环回模式已开启：不需要连接蓝牙');
      return;
    }
    if (!navigator.bluetooth) {
      setStatus('当前浏览器不支持 Web Bluetooth，请使用桌面版 Chrome / Edge，并通过 localhost 或 HTTPS 打开。');
      return;
    }
    try {
      setStatus('请求设备权限...');
      const serviceUuid = normalizeUuid(uuids.service);
      const writeUuid = normalizeUuid(uuids.write);
      const notifyUuid = normalizeUuid(uuids.notify || uuids.write);
      const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [serviceUuid] });
      device.addEventListener('gattserverdisconnected', () => setStatus(`已断开：${device.name || '未知设备'}`));
      setStatus('连接 GATT...');
      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(serviceUuid);
      const writeChar = await service.getCharacteristic(writeUuid);
      const notifyChar = await service.getCharacteristic(notifyUuid);
      bluetoothRef.current = { device, server, writeChar, notifyChar };
      await notifyChar.startNotifications();
      notifyChar.addEventListener('characteristicvaluechanged', onNotify);
      setStatus(`已连接：${device.name || '未知设备'}`);
    } catch (err) {
      setStatus(`连接失败：${err.message}`);
    }
  };

  const disconnectBluetooth = () => {
    const { device, notifyChar } = bluetoothRef.current;
    try {
      notifyChar?.removeEventListener('characteristicvaluechanged', onNotify);
      if (device?.gatt?.connected) device.gatt.disconnect();
    } finally {
      bluetoothRef.current = { device: null, server: null, writeChar: null, notifyChar: null };
      setStatus(loopbackMode ? '环回模式：无需连接蓝牙' : '未连接');
    }
  };

  const writeBytes = async (bytes) => {
    const ch = bluetoothRef.current.writeChar;
    if (!ch) throw new Error('尚未连接写入特征值，或请先打开环回测试模式');
    const step = 20;
    const delay = Number(sendInterval) || 0;
    for (let i = 0; i < bytes.length; i += step) {
      const chunk = bytes.slice(i, i + step);
      if (ch.writeValueWithoutResponse) await ch.writeValueWithoutResponse(chunk);
      else await ch.writeValue(chunk);
      if (delay > 0 && i + step < bytes.length) await new Promise((r) => setTimeout(r, delay));
    }
  };

  const sendRaw = async (value, mode = txMode, silent = false) => {
    try {
      const bytes = mode === 'hex' ? hexToBytes(value) : textToBytes(value, encoding);
      const printable = mode === 'hex' ? bytesToHex(bytes) : value.replace(/\r/g, '\\r').replace(/\n/g, '\\n');

      if (loopbackMode) {
        const loopText = mode === 'hex' ? bytesToText(bytes, encoding) : value;
        appendRx(mode === 'hex' ? `${bytesToHex(bytes)} ` : value);
        parsePackets(loopText);
        if (!silent) appendTx(`${printable}  ← 环回`);
        return;
      }

      await writeBytes(bytes);
      if (!silent) appendTx(printable);
    } catch (err) {
      appendTx(`发送失败：${err.message}`);
    }
  };

  const sendPacket = async (parts, silent = false) => {
    const now = Date.now();
    const wait = Math.max(0, Number(packetInterval) || 0) - (now - packetTimer.current);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    packetTimer.current = Date.now();
    const packet = makePacket(parts, shortPacket) + (packetNewline ? newlineValue : '');
    await sendRaw(packet, 'text', silent);
  };

  const sendJoystickPacket = async (silent = true) => {
    await sendPacket(['joystick', leftJoyRef.current.x, leftJoyRef.current.y, rightJoyRef.current.x, rightJoyRef.current.y], silent);
  };

  useEffect(() => {
    if (!joystickContinuous || !isJoystickActive) return;
    const period = Math.max(20, Number(packetInterval) || 30);
    const tick = async () => {
      if (joystickSendingRef.current) return;
      joystickSendingRef.current = true;
      try { await sendJoystickPacket(); } finally { joystickSendingRef.current = false; }
    };
    tick();
    const id = setInterval(tick, period);
    return () => clearInterval(id);
  }, [joystickContinuous, isJoystickActive, packetInterval, shortPacket, packetNewline, newlineValue, encoding, sendInterval, loopbackMode]);

  const plotKeys = useMemo(() => {
    const keys = new Set();
    plotData.forEach((row) => Object.keys(row).forEach((k) => k !== 'idx' && keys.add(k)));
    return [...keys];
  }, [plotData]);

  const getPlotSetting = (key) => plotChannelSettings[key] || { name: key, visible: true };
  const updatePlotSetting = (key, patch) => setPlotChannelSettings((old) => ({ ...old, [key]: { ...getPlotSetting(key), ...patch } }));

  const exportCsv = () => {
    if (!plotData.length) {
      appendTx('CSV 导出失败：当前没有绘图数据');
      return;
    }
    const headers = ['time_iso', 'time_ms', 'time_s', ...plotKeys.map((key) => getPlotSetting(key).name || key)];
    const rows = plotData.map((row) => [
      row.timeIso || '',
      row.timeMs ?? '',
      row.timeS ?? '',
      ...plotKeys.map((key) => row[key] ?? ''),
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(',')).join('\r\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plot-data-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    appendTx('CSV 已导出：包含时间戳、时间轴和曲线名称');
  };

  const applySpeedPlotTemplate = () => {
    setPlotChannelSettings((old) => ({
      ...old,
      CH1: { ...(old.CH1 || {}), name: '当前速度', visible: true },
      CH2: { ...(old.CH2 || {}), name: '目标速度', visible: true },
      CH3: { ...(old.CH3 || {}), name: 'PWM输出', visible: true },
      CH4: { ...(old.CH4 || {}), name: '速度误差', visible: true },
    }));
    setPlotAutoScroll(true);
    setPlotYAxisMode('auto');
    setPlotMaxPoints(300);
    appendTx('已应用速度闭环绘图模板：CH1 当前速度，CH2 目标速度，CH3 PWM输出，CH4 速度误差');
  };

  const clearPlotData = () => {
    plotIndex.current = 0;
    plotStartTimeRef.current = null;
    setPausedPlotPackets(0);
    setPlotData([]);
  };

  const clearSavedConfig = () => {
    localStorage.removeItem(CONFIG_KEY);
    window.location.reload();
  };

  const sendAllDriveSettings = async () => {
    for (const item of DRIVE_FIELDS) {
      await sendPacket(['slider', item.packet, driveSettings[item.key]], false);
    }
  };

  const updateDriveValue = (key, value) => {
    setDriveSettings((old) => ({ ...old, [key]: value }));
    const field = DRIVE_FIELDS.find((item) => item.key === key);
    if (field) sendPacket(['slider', field.packet, value], false);
  };


  const updateAppearance = (patch) => setAppearance((old) => ({ ...old, ...patch }));
  const applyThemePreset = (name) => setAppearance((old) => ({ ...old, ...THEME_PRESETS[name], themeName: name }));
  const resetAppearance = () => setAppearance(DEFAULT_APPEARANCE);

  const renderHelpAppearancePanel = () => <div className="help-layout">
    <Card>
      <SectionTitle icon={BookOpen} title="使用说明" />
      <div className="help-grid">
        <div className="help-step"><b>1. 选择模块预设</b><p>常见国产 BLE 串口模块优先试 FFE0 / FFE1；如果连接失败，再按模块资料填写自定义 UUID。</p></div>
        <div className="help-step"><b>2. 连接蓝牙</b><p>点击右上角“连接”，在浏览器弹窗里选择你的 BLE 模块。网页需要 HTTPS 或 localhost 环境。</p></div>
        <div className="help-step"><b>3. 串口测试</b><p>进入“串口”页面，先发送 Hello 或十六进制数据，确认电脑蓝牙到单片机串口链路正常。</p></div>
        <div className="help-step"><b>4. 小车联调</b><p>进入“小车联调”，一边推动摇杆发送目标值，一边观察单片机回传的 [plot,...] 曲线。</p></div>
        <div className="help-step"><b>5. 绘图回传</b><p>单片机可持续发送 [plot,当前速度,目标速度,PWM]，网页会按真实时间轴绘制曲线，并显示最新/最大/最小/平均值。</p></div>
        <div className="help-step"><b>6. 环回测试</b><p>没有蓝牙模块时，打开“环回测试模式”，网页发送的数据会直接进入接收区，用于测试界面和协议。</p></div>
      </div>
      <div className="protocol-card">
        <h3>当前协议保持不变</h3>
        <div className="protocol-list">
          <code>[key,name,down/up]</code>
          <code>[slider,name,value]</code>
          <code>[joystick,lx,ly,rx,ry]</code>
          <code>[plot,v1,v2,...]</code>
          <code>[display,x,y,text,size]</code>
          <code>[plot-clear] / [display-clear]</code>
        </div>
      </div>
    </Card>

    <Card>
      <SectionTitle
        icon={Palette}
        title="界面颜色与风格设置"
        right={<Button variant="secondary" onClick={resetAppearance}><RotateCcw size={16} />恢复外观默认</Button>}
      />
      <div className="theme-presets">
        {Object.keys(THEME_PRESETS).map((name) => <Button key={name} variant={appearance.themeName === name ? 'primary' : 'secondary'} onClick={() => applyThemePreset(name)}>{name}</Button>)}
      </div>
      <div className="appearance-grid">
        <ColorControl label="主色" value={appearance.primary} onChange={(v) => updateAppearance({ primary: v, themeName: '自定义' })} />
        <ColorControl label="强调色" value={appearance.accent} onChange={(v) => updateAppearance({ accent: v, themeName: '自定义' })} />
        <ColorControl label="危险色" value={appearance.danger} onChange={(v) => updateAppearance({ danger: v, themeName: '自定义' })} />
        <ColorControl label="背景色" value={appearance.background} onChange={(v) => updateAppearance({ background: v, themeName: '自定义' })} />
        <ColorControl label="卡片色" value={appearance.card} onChange={(v) => updateAppearance({ card: v, themeName: '自定义' })} />
        <ColorControl label="输入框色" value={appearance.input} onChange={(v) => updateAppearance({ input: v, themeName: '自定义' })} />
        <ColorControl label="文字色" value={appearance.text} onChange={(v) => updateAppearance({ text: v, themeName: '自定义' })} />
        <ColorControl label="辅助文字" value={appearance.muted} onChange={(v) => updateAppearance({ muted: v, themeName: '自定义' })} />
        <ColorControl label="边框色" value={appearance.border} onChange={(v) => updateAppearance({ border: v, themeName: '自定义' })} />
      </div>
      <div className="style-grid">
        <label>圆角大小<input type="range" min="8" max="34" value={appearance.radius} onChange={(e) => updateAppearance({ radius: Number(e.target.value), themeName: '自定义' })} /><span className="range-value">{appearance.radius}px</span></label>
        <label>字体缩放<input type="range" min="0.9" max="1.15" step="0.01" value={appearance.fontScale} onChange={(e) => updateAppearance({ fontScale: Number(e.target.value), themeName: '自定义' })} /><span className="range-value">{Math.round(appearance.fontScale * 100)}%</span></label>
        <label>界面密度<select value={appearance.density} onChange={(e) => updateAppearance({ density: e.target.value, themeName: '自定义' })}><option value="compact">紧凑</option><option value="comfortable">舒适</option><option value="large">宽松</option></select></label>
        <label>阴影风格<select value={appearance.shadow} onChange={(e) => updateAppearance({ shadow: e.target.value, themeName: '自定义' })}><option value="flat">扁平</option><option value="soft">柔和阴影</option><option value="glow">科技发光</option></select></label>
      </div>
      <div className="style-preview">
        <div className="preview-card"><Paintbrush size={20} /><b>外观设置会自动保存</b><span>刷新网页后仍然保留；不会改变蓝牙通信协议。</span></div>
        <Button>主按钮</Button><Button variant="secondary">次按钮</Button><Button variant="danger">危险按钮</Button>
      </div>
    </Card>
  </div>;

  const renderPlotCard = (compact = false) => {
    const visibleKeys = plotKeys.filter((key) => getPlotSetting(key).visible !== false);
    const safeMaxPoints = Math.max(20, Number(plotMaxPoints) || DEFAULT_PLOT_SETTINGS.maxPoints);
    const displayData = plotAutoScroll ? plotData.slice(-safeMaxPoints) : plotData;
    const yMin = Number(plotYMin);
    const yMax = Number(plotYMax);
    const fixedYAxisValid = plotYAxisMode === 'fixed' && Number.isFinite(yMin) && Number.isFinite(yMax) && yMin < yMax;
    const yAxisProps = fixedYAxisValid ? { domain: [yMin, yMax] } : {};
    const lastTime = plotData.length ? `${formatNumber(plotData[plotData.length - 1].timeS, 3)}s` : '-';

    return <Card>
      <SectionTitle
        icon={Activity}
        title={compact ? '速度反馈绘图：[plot,v1,v2,...]' : '绘图：接收 [plot,v1,v2,...] / [plot-clear]'}
        right={<div className="row">
          <span className={`send-badge ${plotPaused ? '' : 'active'}`}>{plotPaused ? `已暂停${pausedPlotPackets ? ` · 忽略 ${pausedPlotPackets} 包` : ''}` : '实时绘图中'}</span>
          <Button variant="secondary" onClick={() => setPlotPaused((v) => !v)}>{plotPaused ? <Play size={16} /> : <Pause size={16} />}{plotPaused ? '继续' : '暂停'}</Button>
          <Button variant="secondary" onClick={exportCsv}><Download size={16} />导出 CSV</Button>
          <Button variant="secondary" onClick={clearPlotData}><Trash2 size={16} />清空</Button>
        </div>}
      />
      <div className={`plot-control-panel ${compact ? 'compact' : ''}`}>
        <label className="check"><input type="checkbox" checked={plotAutoScroll} onChange={(e) => setPlotAutoScroll(e.target.checked)} />自动滚动</label>
        <label>显示点数<input type="number" min="20" max="5000" value={plotMaxPoints} onChange={(e) => setPlotMaxPoints(Number(e.target.value))} /></label>
        <label>Y 轴模式<select value={plotYAxisMode} onChange={(e) => setPlotYAxisMode(e.target.value)}><option value="auto">自动缩放</option><option value="fixed">固定范围</option></select></label>
        <label>Y 最小值<input type="number" disabled={plotYAxisMode !== 'fixed'} value={plotYMin} onChange={(e) => setPlotYMin(Number(e.target.value))} /></label>
        <label>Y 最大值<input type="number" disabled={plotYAxisMode !== 'fixed'} value={plotYMax} onChange={(e) => setPlotYMax(Number(e.target.value))} /></label>
        <Button variant="secondary" onClick={applySpeedPlotTemplate}><Maximize2 size={16} />速度闭环模板</Button>
        <span className="plot-meta">数据点：{plotData.length} · 当前时间：{lastTime}</span>
      </div>
      <div className={`plot-box ${compact ? 'compact' : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={displayData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="timeS"
              type="number"
              tickFormatter={(value) => `${formatNumber(value, 1)}s`}
              label={compact ? undefined : { value: '时间 / s', position: 'insideBottomRight', offset: -4 }}
            />
            <YAxis {...yAxisProps} />
            <Tooltip
              labelFormatter={(value) => `时间：${formatNumber(value, 3)} s`}
              formatter={(value, name) => [formatNumber(value), name]}
            />
            <Legend />
            {visibleKeys.map((key) => {
              const index = plotKeys.indexOf(key);
              const setting = getPlotSetting(key);
              return <Line
                key={key}
                name={setting.name || key}
                type="monotone"
                dataKey={key}
                dot={false}
                stroke={PLOT_COLORS[index % PLOT_COLORS.length]}
                strokeWidth={2.5}
                isAnimationActive={false}
                connectNulls
              />;
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      {plotKeys.length > 0 && <div className="plot-channel-panel enhanced">
        {plotKeys.map((key, index) => {
          const setting = getPlotSetting(key);
          const stats = calcStats(plotData, key);
          return <div className="plot-channel-row enhanced" key={key}>
            <div className="plot-channel-main">
              <span className="plot-color-chip"><i style={{ backgroundColor: PLOT_COLORS[index % PLOT_COLORS.length] }} />{key}</span>
              <input value={setting.name || ''} onChange={(e) => updatePlotSetting(key, { name: e.target.value })} placeholder={key} />
              <label className="check inline"><input type="checkbox" checked={setting.visible !== false} onChange={(e) => updatePlotSetting(key, { visible: e.target.checked })} />显示</label>
            </div>
            <div className="plot-stat-grid">
              <span>最新<b>{stats.latest}</b></span>
              <span>最大<b>{stats.max}</b></span>
              <span>最小<b>{stats.min}</b></span>
              <span>平均<b>{stats.avg}</b></span>
            </div>
          </div>;
        })}
      </div>}
    </Card>;
  };

  const renderJoystickConfig = () => <div className="joystick-config-panel">
    <div className="grid2">
      <label>横向最大值<input type="number" value={joystickConfig.maxX} onChange={(e) => setJoystickConfig({ ...joystickConfig, maxX: Number(e.target.value) })} /></label>
      <label>纵向最大值<input type="number" value={joystickConfig.maxY} onChange={(e) => setJoystickConfig({ ...joystickConfig, maxY: Number(e.target.value) })} /></label>
      <label>横向步距<input type="number" value={joystickConfig.stepX} onChange={(e) => setJoystickConfig({ ...joystickConfig, stepX: Number(e.target.value) })} /></label>
      <label>纵向步距<input type="number" value={joystickConfig.stepY} onChange={(e) => setJoystickConfig({ ...joystickConfig, stepY: Number(e.target.value) })} /></label>
      <label>死区<input type="number" value={joystickConfig.deadzone} onChange={(e) => setJoystickConfig({ ...joystickConfig, deadzone: Number(e.target.value) })} /></label>
      <label>摇杆形状<select value={joystickConfig.shape} onChange={(e) => setJoystickConfig({ ...joystickConfig, shape: e.target.value })}><option value="square">方形</option><option value="circle">圆形</option></select></label>
    </div>
    <div className="row compact-row">
      <label className="check"><input type="checkbox" checked={joystickConfig.invertX} onChange={(e) => setJoystickConfig({ ...joystickConfig, invertX: e.target.checked })} />横向反向</label>
      <label className="check"><input type="checkbox" checked={joystickConfig.invertY} onChange={(e) => setJoystickConfig({ ...joystickConfig, invertY: e.target.checked })} />纵向反向</label>
    </div>
  </div>;

  const renderJoystickCard = (compact = false) => <Card>
    <SectionTitle
      icon={Gamepad2}
      title={compact ? '目标值摇杆：持续发送 [joystick,lx,ly,rx,ry]' : '摇杆：持续发送 [joystick,lx,ly,rx,ry]'}
      right={<div className="row"><span className={`send-badge ${isJoystickActive ? 'active' : ''}`}>{isJoystickActive ? '持续发送中' : '待机'}</span><Button variant="secondary" onClick={() => { updateLeftJoy({ x: 0, y: 0 }); updateRightJoy({ x: 0, y: 0 }); sendJoystickPacket(false); }}><RefreshCw size={16} />回中</Button></div>}
    />
    <div className="joystick-hint">按住并推动摇杆后，会按照“数据包间隔 ms”周期连续发送；松开时自动回中并发送 0 值。死区、最大值、反向设置会自动保存。</div>
    {!compact && renderJoystickConfig()}
    <div className={`joystick-grid ${compact ? 'compact' : ''}`}>
      <Joystick label="左摇杆" config={joystickConfig} value={leftJoy} onChange={updateLeftJoy} onActiveChange={(active) => setJoyActive('left', active)} onRelease={() => sendJoystickPacket(false)} />
      <Joystick label="右摇杆" config={joystickConfig} value={rightJoy} onChange={updateRightJoy} onActiveChange={(active) => setJoyActive('right', active)} onRelease={() => sendJoystickPacket(false)} />
    </div>
  </Card>;

  const renderDrivePanel = () => <Card>
    <SectionTitle
      icon={Car}
      title="小车专用联调面板"
      right={<Button variant="secondary" onClick={sendAllDriveSettings}><Send size={16} />发送全部参数</Button>}
    />
    <div className="drive-actions">
      <Button onClick={() => sendPacket(['key', 'start', 'down'], false)}>启动</Button>
      <Button variant="secondary" onClick={() => sendPacket(['key', 'stop', 'down'], false)}>停止</Button>
      <Button variant="danger" onClick={() => sendPacket(['key', 'emergency', 'down'], false)}>急停</Button>
      <Button variant="secondary" onClick={() => { setDriveSettings(DEFAULT_DRIVE_SETTINGS); sendPacket(['key', 'reset', 'down'], false); }}><RotateCcw size={16} />复位参数</Button>
    </div>
    <div className="drive-fields">
      {DRIVE_FIELDS.map((field) => <div className="drive-field" key={field.key}>
        <div className="drive-field-head"><b>{field.label}</b><span>{driveSettings[field.key]}</span></div>
        <input type="range" min={field.min} max={field.max} step={field.step} value={driveSettings[field.key]} onChange={(e) => updateDriveValue(field.key, Number(e.target.value))} />
        <input type="number" value={driveSettings[field.key]} onChange={(e) => updateDriveValue(field.key, Number(e.target.value))} />
      </div>)}
    </div>
    <div className="joystick-hint">小车面板发送的是 [key,start/stop/emergency,down] 和 [slider,Kp/Ki/Kd/target,value]，便于单片机端沿用同一套解析逻辑。</div>
  </Card>;

  const renderLoopbackTools = () => <div className="loopback-tools">
    <Button variant="secondary" onClick={() => sendRaw('[plot,10,20,30]\r\n[plot,15,20,35]\r\n[plot,18,20,40]\r\n', 'text')}>测试绘图</Button>
    <Button variant="secondary" onClick={() => sendRaw('[display,20,30,Loopback OK,24]\r\n', 'text')}>测试显示屏</Button>
    <Button variant="secondary" onClick={() => sendRaw('[plot-clear]\r\n[display-clear]\r\n', 'text')}>清空测试</Button>
  </div>;

  return <main className={`page density-${appearance.density} shadow-${appearance.shadow}`} style={pageStyle}>
    <div className="container">
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="hero">
        <div><h1>网页蓝牙远程调参助手 v8</h1><p>协议不变 · 绘图增强 · 时间轴/统计/Y轴控制/CSV 时间戳 · 自定义外观</p></div>
        <Card className="connection"><div className="status">{status}</div><Button onClick={connectBluetooth}><Bluetooth size={16} />连接</Button><Button variant="secondary" onClick={disconnectBluetooth}><Cable size={16} />断开</Button></Card>
      </motion.header>

      <div className="layout">
        <aside className="sidebar">
          <Card>
            <SectionTitle icon={Settings} title="蓝牙与通用设置" />
            <label className="check"><input type="checkbox" checked={loopbackMode} onChange={(e) => setLoopbackMode(e.target.checked)} />环回测试模式</label>
            {loopbackMode && renderLoopbackTools()}
            <label>模块预设<select value={preset} onChange={(e) => setPreset(e.target.value)}>{Object.entries(PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
            {[["service", "Service UUID"], ["write", "发送 Characteristic UUID"], ["notify", "接收 Characteristic UUID"]].map(([key, label]) => <label key={key}>{label}<input value={uuids[key]} onChange={(e) => { setPreset('custom'); setUuids({ ...uuids, [key]: e.target.value }); }} /></label>)}
            <div className="grid2"><label>文本编码<select value={encoding} onChange={(e) => setEncoding(e.target.value)}><option value="utf-8">UTF-8</option><option value="gbk">GBK</option></select></label><label>换行格式<select value={newline} onChange={(e) => setNewline(e.target.value)}><option value="\r\n">\r\n</option><option value="\n">\n</option><option value="\r">\r</option></select></label></div>
            <div className="grid2"><label>发送节流 ms<input type="number" value={sendInterval} onChange={(e) => setSendInterval(e.target.value)} /></label><label>数据包间隔 ms<input type="number" value={packetInterval} onChange={(e) => setPacketInterval(e.target.value)} /></label></div>
            <label>接收缓存 ch<input type="number" value={cacheSize} onChange={(e) => setCacheSize(e.target.value)} /></label>
            <label className="check"><input type="checkbox" checked={packetNewline} onChange={(e) => setPacketNewline(e.target.checked)} />数据包末尾加换行</label>
            <label className="check"><input type="checkbox" checked={shortPacket} onChange={(e) => setShortPacket(e.target.checked)} />数据包使用短格式</label>
            <label className="check"><input type="checkbox" checked={joystickContinuous} onChange={(e) => setJoystickContinuous(e.target.checked)} />摇杆按住持续发送</label>
            <Button variant="secondary" className="full-btn" onClick={clearSavedConfig}>恢复默认配置</Button>
          </Card>
          <Card className="tabs">
            {[["serial", Cable, "串口"], ["display", Monitor, "显示屏"], ["drive", Car, "小车联调"], ["plot", Activity, "绘图"], ["buttons", SquareMousePointer, "按键"], ["sliders", SlidersHorizontal, "滑杆"], ["joystick", Gamepad2, "摇杆"], ["help", HelpCircle, "说明/外观"]].map(([k, Icon, label]) => <Button key={k} variant={tab === k ? 'primary' : 'secondary'} onClick={() => setTab(k)}><Icon size={16} />{label}</Button>)}
          </Card>
        </aside>

        <section className="content">
          {tab === 'serial' && <div className="two-cols">
            <Card><SectionTitle icon={Cable} title="接收区" right={<div className="row"><Button variant="secondary" onClick={() => setRxMode(rxMode === 'text' ? 'hex' : 'text')}>{rxMode === 'text' ? '文本' : 'HEX'}</Button><Button variant="secondary" onClick={() => setRxLog('')}><Trash2 size={16} /></Button></div>} /><textarea className="big-text" value={rxLog} readOnly /></Card>
            <Card><SectionTitle icon={Send} title="发送区" right={<div className="row"><Button variant="secondary" onClick={() => setTxMode(txMode === 'text' ? 'hex' : 'text')}>{txMode === 'text' ? '文本' : 'HEX'}</Button><Button variant="secondary" onClick={() => setTxText('')}><Trash2 size={16} /></Button></div>} /><textarea className="small-text" value={txText} onChange={(e) => setTxText(e.target.value)} /><div className="row mt"><Button onClick={() => sendRaw(txMode === 'text' ? txText + newlineValue : txText)}><Send size={16} />发送</Button><Button variant="secondary" onClick={() => setTxLog('')}><Trash2 size={16} />清空记录</Button></div><pre className="log">{txLog}</pre></Card>
          </div>}

          {tab === 'display' && <Card><SectionTitle icon={Monitor} title="显示屏：接收 [display,x,y,text,size] / [display-clear]" right={<Button variant="secondary" onClick={() => setDisplayItems([])}><Trash2 size={16} />清空</Button>} /><div className="display-screen"><span className="origin">坐标原点 (0,0)，向右为 X，向下为 Y</span>{displayItems.map((it, idx) => <div key={`${it.x}-${it.y}-${idx}`} className="display-item" style={{ left: it.x, top: it.y, fontSize: it.size }}>{it.content}</div>)}</div></Card>}

          {tab === 'plot' && renderPlotCard(false)}

          {tab === 'drive' && <div className="drive-dashboard">{renderDrivePanel()}<div className="drive-split">{renderPlotCard(true)}{renderJoystickCard(true)}</div></div>}

          {tab === 'buttons' && <Card><SectionTitle icon={SquareMousePointer} title="按键：发送 [key,name,down/up]" right={<Button variant="secondary" onClick={() => setButtons([...buttons, { name: String(buttons.length + 1), lock: false, state: false }])}>增加一项</Button>} /><div className="button-grid">{buttons.map((btn, idx) => <div key={idx} className="button-editor"><input value={btn.name} onChange={(e) => setButtons(buttons.map((b, i) => i === idx ? { ...b, name: e.target.value } : b))} /><label className="check"><input type="checkbox" checked={btn.lock} onChange={(e) => setButtons(buttons.map((b, i) => i === idx ? { ...b, lock: e.target.checked } : b))} />自锁</label><button className={`remote-button ${btn.state ? 'active' : ''}`} onPointerDown={() => { if (btn.lock) return; setButtons(buttons.map((b, i) => i === idx ? { ...b, state: true } : b)); sendPacket(['key', btn.name, 'down']); }} onPointerUp={() => { if (btn.lock) { const next = !btn.state; setButtons(buttons.map((b, i) => i === idx ? { ...b, state: next } : b)); sendPacket(['key', btn.name, next ? 'down' : 'up']); } else { setButtons(buttons.map((b, i) => i === idx ? { ...b, state: false } : b)); sendPacket(['key', btn.name, 'up']); } }}>{btn.name}</button></div>)}</div></Card>}

          {tab === 'sliders' && <Card><SectionTitle icon={SlidersHorizontal} title="滑杆：发送 [slider,name,value]" right={<Button variant="secondary" onClick={() => setSliders([...sliders, { name: String(sliders.length + 1), min: 0, max: 100, step: 1, value: 50 }])}>增加一项</Button>} /><div className="slider-list">{sliders.map((s, idx) => <div key={idx} className="slider-editor"><div className="slider-config"><input value={s.name} onChange={(e) => setSliders(sliders.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} /><input type="number" value={s.min} onChange={(e) => setSliders(sliders.map((x, i) => i === idx ? { ...x, min: Number(e.target.value) } : x))} /><input type="number" value={s.max} onChange={(e) => setSliders(sliders.map((x, i) => i === idx ? { ...x, max: Number(e.target.value) } : x))} /><input type="number" value={s.step} onChange={(e) => setSliders(sliders.map((x, i) => i === idx ? { ...x, step: Number(e.target.value) } : x))} /><div className="value-box">值：{s.value}</div></div><input type="range" min={s.min} max={s.max} step={s.step} value={s.value} onChange={(e) => { const value = Number(e.target.value); setSliders(sliders.map((x, i) => i === idx ? { ...x, value } : x)); sendPacket(['slider', s.name, value]); }} /></div>)}</div></Card>}

          {tab === 'joystick' && renderJoystickCard(false)}

          {tab === 'help' && renderHelpAppearancePanel()}
        </section>
      </div>
    </div>
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);
