import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  AlertTriangle,
  Bluetooth,
  BookOpen,
  Cable,
  Car,
  Download,
  FileDown,
  FileUp,
  Gamepad2,
  HelpCircle,
  Keyboard,
  Maximize2,
  Monitor,
  Paintbrush,
  Palette,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Settings,
  SlidersHorizontal,
  SquareMousePointer,
  StopCircle,
  Trash2,
  Usb,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './styles.css';
import {
  bytesToHex,
  bytesToText,
  clamp,
  hexToBytes,
  makePacket,
  normalizeUuid,
  extractPacketsFromStream,
  textToBytes,
} from './utils/protocol.js';
import { downloadTextFile, exportPlotCsv } from './utils/csv.js';
import { loadJson, saveJson } from './utils/storage.js';

const CONFIG_KEY = 'bluetooth_tuning_web_config_v10';
const RECORD_KEY = 'bluetooth_tuning_web_records_v9';

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

const PLOT_COLORS = [
  '#2563eb', '#dc2626', '#16a34a', '#ca8a04', '#9333ea',
  '#ea580c', '#0891b2', '#be185d', '#4f46e5', '#65a30d',
];

const THEME_PRESETS = {
  blue: {
    label: '蓝色清爽',
    values: { primary: '#2563eb', accent: '#0ea5e9', danger: '#dc2626', bg: '#eef2f7', card: '#ffffff', input: '#ffffff', text: '#0f172a', muted: '#475569', border: '#dbe3ef' },
  },
  dark: {
    label: '深色科技',
    values: { primary: '#38bdf8', accent: '#a78bfa', danger: '#fb7185', bg: '#020617', card: '#0f172a', input: '#111827', text: '#e2e8f0', muted: '#94a3b8', border: '#334155' },
  },
  red: {
    label: '竞赛红黑',
    values: { primary: '#ef4444', accent: '#f97316', danger: '#dc2626', bg: '#111827', card: '#1f2937', input: '#111827', text: '#f9fafb', muted: '#d1d5db', border: '#374151' },
  },
  green: {
    label: '护眼绿色',
    values: { primary: '#16a34a', accent: '#22c55e', danger: '#e11d48', bg: '#eef8ef', card: '#ffffff', input: '#fbfffb', text: '#102a19', muted: '#42624b', border: '#cfe8d2' },
  },
  gray: {
    label: '简洁灰白',
    values: { primary: '#334155', accent: '#64748b', danger: '#dc2626', bg: '#f8fafc', card: '#ffffff', input: '#ffffff', text: '#0f172a', muted: '#64748b', border: '#e2e8f0' },
  },
};

const DEFAULT_JOYSTICK = {
  maxX: 100,
  maxY: 100,
  stepX: 1,
  stepY: 1,
  deadzone: 5,
  invertX: false,
  invertY: false,
  shape: 'square',
};

const DEFAULT_PLOT = {
  paused: false,
  autoScroll: true,
  maxPoints: 300,
  yAxisMode: 'auto',
  yMin: -120,
  yMax: 120,
  mode: 'single',
  smooth: false,
  smoothWindow: 3,
};

const DEFAULT_PID = {
  groupName: '默认参数组',
  targetSpeed: 0,
  kp: 120,
  ki: 0,
  kd: 0,
  leftBias: 0,
  rightBias: 0,
  stepSmall: 1,
  stepLarge: 10,
};

const DEFAULT_SERIAL = {
  baudRate: 115200,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  flowControl: 'none',
  useRememberedPort: true,
  packetBufferSize: 8192,
};

const DEFAULT_BRIDGE = {
  url: 'ws://127.0.0.1:8765/ws',
  note: 'Orange Pi 本地串口桥，适合开机自启动和免浏览器串口弹窗',
};

const DEFAULT_THEME = {
  ...THEME_PRESETS.blue.values,
  radius: 20,
  fontScale: 1,
  density: 'comfortable',
  shadow: 'soft',
};

const DEFAULT_CONFIG = {
  transport: 'serial',
  autoReconnect: true,
  preset: 'ffe0',
  uuids: PRESETS.ffe0,
  encoding: 'utf-8',
  newline: '\\r\\n',
  packetNewline: true,
  shortPacket: false,
  sendInterval: 20,
  packetInterval: 50,
  cacheSize: 10000,
  rxMode: 'text',
  txMode: 'text',
  txText: 'Hello',
  tab: 'drive',
  loopback: false,
  joystick: DEFAULT_JOYSTICK,
  plot: DEFAULT_PLOT,
  curveNames: { CH1: '当前速度', CH2: '目标速度', CH3: 'PWM输出', CH4: '速度误差' },
  curveVisible: {},
  theme: DEFAULT_THEME,
  buttons: [
    { name: 'start', lock: false, state: false },
    { name: 'stop', lock: false, state: false },
    { name: 'emergency', lock: false, state: false },
    { name: 'mode', lock: true, state: false },
  ],
  sliders: [
    { name: 'target', min: -100, max: 100, step: 1, value: 0 },
    { name: 'Kp', min: 0, max: 500, step: 1, value: 120 },
    { name: 'Ki', min: 0, max: 500, step: 1, value: 0 },
    { name: 'Kd', min: 0, max: 500, step: 1, value: 0 },
  ],
  pid: DEFAULT_PID,
  pidGroups: [],
  serial: DEFAULT_SERIAL,
  bridge: DEFAULT_BRIDGE,
};

function applyDeadzone(value, deadzone) {
  return Math.abs(value) < Number(deadzone || 0) ? 0 : value;
}

function formatDuration(ms) {
  if (!ms) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const sec = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${sec}`;
}

function useInterval(callback, delay) {
  const saved = useRef(callback);
  useEffect(() => { saved.current = callback; }, [callback]);
  useEffect(() => {
    if (delay == null) return undefined;
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

function Card({ children, className = '' }) {
  return <div className={`card ${className}`}>{children}</div>;
}

function Button({ children, variant = 'secondary', className = '', ...props }) {
  return <button className={`btn ${variant} ${className}`} {...props}>{children}</button>;
}

function SectionTitle({ icon: Icon, title, right }) {
  return (
    <div className="section-title">
      <div className="section-title-left">{Icon && <Icon size={20} />}<h2>{title}</h2></div>
      {right}
    </div>
  );
}

function MiniInput({ label, value, onChange, type = 'text', ...props }) {
  return <label>{label}<input type={type} value={value} onChange={(e) => onChange(type === 'number' ? Number(e.target.value) : e.target.value)} {...props} /></label>;
}

function Joystick({ label, value, config, onChange, onActiveChange, large = false }) {
  const ref = useRef(null);
  const pointerId = useRef(null);

  const update = (e) => {
    const rect = ref.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clamp((e.clientX - cx) / (rect.width / 2), -1, 1);
    let dy = clamp((cy - e.clientY) / (rect.height / 2), -1, 1);
    if (config.shape === 'circle') {
      const mag = Math.hypot(dx, dy);
      if (mag > 1) {
        dx /= mag;
        dy /= mag;
      }
    }
    const sx = Math.max(1, Number(config.stepX) || 1);
    const sy = Math.max(1, Number(config.stepY) || 1);
    let x = Math.round((dx * Number(config.maxX || 100)) / sx) * sx;
    let y = Math.round((dy * Number(config.maxY || 100)) / sy) * sy;
    if (config.invertX) x = -x;
    if (config.invertY) y = -y;
    x = applyDeadzone(x, config.deadzone);
    y = applyDeadzone(y, config.deadzone);
    onChange({ x, y });
  };

  const maxX = Math.max(1, Math.abs(Number(config.maxX) || 100));
  const maxY = Math.max(1, Math.abs(Number(config.maxY) || 100));
  const knobLeft = 50 + clamp(value.x / maxX, -1, 1) * 45;
  const knobTop = 50 - clamp(value.y / maxY, -1, 1) * 45;

  return (
    <div className="joystick-wrap">
      <div className="joystick-head"><b>{label}</b><span>X={value.x}, Y={value.y}</span></div>
      <div
        ref={ref}
        className={`joystick ${large ? 'large' : ''} ${config.shape === 'circle' ? 'round' : ''}`}
        onPointerDown={(e) => {
          pointerId.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          onActiveChange?.(true);
          update(e);
        }}
        onPointerMove={(e) => {
          if (pointerId.current === e.pointerId) update(e);
        }}
        onPointerUp={(e) => {
          pointerId.current = null;
          onChange({ x: 0, y: 0 });
          onActiveChange?.(false);
        }}
        onPointerCancel={() => {
          pointerId.current = null;
          onChange({ x: 0, y: 0 });
          onActiveChange?.(false);
        }}
      >
        <div className="axis-y" /><div className="axis-x" />
        <div className="knob" style={{ left: `${knobLeft}%`, top: `${knobTop}%` }}>●</div>
      </div>
    </div>
  );
}

function PlotChart({ rows, keys, names, visible, colors, settings, compact = false }) {
  const filteredKeys = keys.filter((k) => visible[k] !== false);
  const domain = settings.yAxisMode === 'fixed' ? [Number(settings.yMin), Number(settings.yMax)] : ['auto', 'auto'];
  if (settings.mode === 'split' && !compact) {
    return (
      <div className="split-plots">
        {filteredKeys.map((key, i) => (
          <div className="plot-box split" key={key}>
            <div className="split-title"><i style={{ background: colors[i % colors.length] }} />{names[key] || key}</div>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="t" type="number" tickFormatter={(v) => `${Number(v).toFixed(1)}s`} domain={['auto', 'auto']} />
                <YAxis domain={domain} />
                <Tooltip labelFormatter={(v) => `${Number(v).toFixed(3)} s`} />
                <Line type={settings.smooth ? 'monotone' : 'linear'} dataKey={key} name={names[key] || key} dot={false} strokeWidth={2} stroke={colors[i % colors.length]} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className={`plot-box ${compact ? 'compact' : ''}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="t" type="number" tickFormatter={(v) => `${Number(v).toFixed(1)}s`} domain={['auto', 'auto']} />
          <YAxis domain={domain} />
          <Tooltip labelFormatter={(v) => `${Number(v).toFixed(3)} s`} />
          <Legend />
          {filteredKeys.map((key, i) => (
            <Line key={key} type={settings.smooth ? 'monotone' : 'linear'} dataKey={key} name={names[key] || key} dot={false} strokeWidth={2} stroke={colors[i % colors.length]} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function App() {
  const saved = useMemo(() => loadJson(CONFIG_KEY, DEFAULT_CONFIG), []);
  const [transport, setTransport] = useState(saved.transport);
  const [autoReconnect, setAutoReconnect] = useState(saved.autoReconnect);
  const [preset, setPreset] = useState(saved.preset);
  const [uuids, setUuids] = useState(saved.uuids);
  const [encoding, setEncoding] = useState(saved.encoding);
  const [newline, setNewline] = useState(saved.newline);
  const [packetNewline, setPacketNewline] = useState(saved.packetNewline);
  const [shortPacket, setShortPacket] = useState(saved.shortPacket);
  const [sendInterval, setSendInterval] = useState(saved.sendInterval);
  const [packetInterval, setPacketInterval] = useState(saved.packetInterval);
  const [cacheSize, setCacheSize] = useState(saved.cacheSize);
  const [rxMode, setRxMode] = useState(saved.rxMode);
  const [txMode, setTxMode] = useState(saved.txMode);
  const [txText, setTxText] = useState(saved.txText);
  const [tab, setTab] = useState(saved.tab);
  const [loopback, setLoopback] = useState(saved.loopback);
  const [joystickConfig, setJoystickConfig] = useState(saved.joystick);
  const [plotSettings, setPlotSettings] = useState(saved.plot);
  const [curveNames, setCurveNames] = useState(saved.curveNames || {});
  const [curveVisible, setCurveVisible] = useState(saved.curveVisible || {});
  const [theme, setTheme] = useState(saved.theme);
  const [buttons, setButtons] = useState(saved.buttons);
  const [sliders, setSliders] = useState(saved.sliders);
  const [pid, setPid] = useState({ ...DEFAULT_PID, ...(saved.pid || {}) });
  const [pidGroups, setPidGroups] = useState(saved.pidGroups || []);
  const [serialSettings, setSerialSettings] = useState({ ...DEFAULT_SERIAL, ...(saved.serial || {}) });
  const [bridgeSettings, setBridgeSettings] = useState({ ...DEFAULT_BRIDGE, ...(saved.bridge || {}) });
  const [records, setRecords] = useState(() => loadJson(RECORD_KEY, { records: [] }).records || []);

  const [status, setStatus] = useState('未连接');
  const [deviceName, setDeviceName] = useState('');
  const [connectedAt, setConnectedAt] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [rxLog, setRxLog] = useState('');
  const [txLog, setTxLog] = useState('');
  const [displayItems, setDisplayItems] = useState([]);
  const [plotData, setPlotData] = useState([]);
  const [leftJoy, setLeftJoy] = useState({ x: 0, y: 0 });
  const [rightJoy, setRightJoy] = useState({ x: 0, y: 0 });
  const [joyActive, setJoyActive] = useState(false);
  const [keyboardVector, setKeyboardVector] = useState({ x: 0, y: 0, active: false });
  const [recording, setRecording] = useState(false);
  const [recordName, setRecordName] = useState('速度阶跃测试');

  const bluetoothRef = useRef({ device: null, server: null, writeChar: null, notifyChar: null });
  const serialRef = useRef({ port: null, reader: null, writer: null, keepReading: false });
  const bridgeRef = useRef({ ws: null });
  const rxPacketBuffer = useRef('');
  const intentionallyDisconnected = useRef(false);
  const plotStart = useRef(Date.now());
  const packetTimer = useRef(0);
  const recordBuffer = useRef([]);
  const keysDown = useRef(new Set());
  const rxModeRef = useRef(rxMode);
  const encodingRef = useRef(encoding);
  const plotPausedRef = useRef(plotSettings.paused);
  const recordingRef = useRef(recording);

  useEffect(() => { rxModeRef.current = rxMode; }, [rxMode]);
  useEffect(() => { encodingRef.current = encoding; }, [encoding]);
  useEffect(() => { plotPausedRef.current = plotSettings.paused; }, [plotSettings.paused]);
  useEffect(() => { recordingRef.current = recording; }, [recording]);
  useInterval(() => setNow(Date.now()), connectedAt ? 1000 : null);

  const appClass = `page density-${theme.density} shadow-${theme.shadow}`;
  const themeStyle = {
    '--app-primary': theme.primary,
    '--app-accent': theme.accent,
    '--app-danger': theme.danger,
    '--app-bg': theme.bg,
    '--app-card': theme.card,
    '--app-input': theme.input,
    '--app-text': theme.text,
    '--app-muted': theme.muted,
    '--app-border': theme.border,
    '--app-radius': `${theme.radius}px`,
    '--app-font-scale': theme.fontScale,
  };

  const newlineValue = useMemo(() => newline.replace('\\r', '\r').replace('\\n', '\n'), [newline]);
  const connected = status.startsWith('已连接') || status.startsWith('串口已连接') || status.startsWith('本地桥已连接') || loopback;

  useEffect(() => {
    if (preset !== 'custom') setUuids(PRESETS[preset]);
  }, [preset]);

  useEffect(() => {
    saveJson(CONFIG_KEY, {
      transport, autoReconnect, preset, uuids, encoding, newline, packetNewline, shortPacket,
      sendInterval, packetInterval, cacheSize, rxMode, txMode, txText, tab, loopback,
      joystick: joystickConfig, plot: plotSettings, curveNames, curveVisible, theme,
      buttons, sliders, pid, pidGroups, serial: serialSettings, bridge: bridgeSettings,
    });
  }, [transport, autoReconnect, preset, uuids, encoding, newline, packetNewline, shortPacket, sendInterval, packetInterval, cacheSize, rxMode, txMode, txText, tab, loopback, joystickConfig, plotSettings, curveNames, curveVisible, theme, buttons, sliders, pid, pidGroups, serialSettings, bridgeSettings]);

  useEffect(() => { saveJson(RECORD_KEY, { records }); }, [records]);

  const appendRx = (text) => {
    setRxLog((old) => {
      const next = old + text;
      const size = Number(cacheSize) || 0;
      return size > 0 && next.length > size ? next.slice(next.length - size) : next;
    });
  };

  const appendTx = (text) => setTxLog((old) => `${old}${text}\n`.slice(-12000));

  const smoothRows = (rows, keys) => {
    const win = Math.max(2, Number(plotSettings.smoothWindow) || 3);
    if (!plotSettings.smooth || rows.length < win) return rows;
    return rows.map((row, idx) => {
      const out = { ...row };
      const from = Math.max(0, idx - win + 1);
      const slice = rows.slice(from, idx + 1);
      keys.forEach((k) => {
        const vals = slice.map((r) => Number(r[k])).filter(Number.isFinite);
        if (vals.length) out[k] = vals.reduce((a, b) => a + b, 0) / vals.length;
      });
      return out;
    });
  };

  const handlePackets = (packets) => {
    for (const parts of packets) {
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
      } else if (cmd === 'plot-clear' || cmd === 'p-c') {
        plotStart.current = Date.now();
        setPlotData([]);
      } else if ((cmd === 'plot' || cmd === 'p') && !plotPausedRef.current) {
        const values = parts.slice(1, 11).map(Number).filter(Number.isFinite);
        if (values.length) {
          const tms = Date.now() - plotStart.current;
          const row = { iso: new Date().toISOString(), tms, t: tms / 1000 };
          values.forEach((v, i) => { row[`CH${i + 1}`] = v; });
          if (recordingRef.current) recordBuffer.current.push(row);
          setPlotData((old) => {
            const next = [...old, row];
            return next.slice(-5000);
          });
        }
      }
    }
  };

  const parsePackets = (text) => {
    const { packets, rest, overflow } = extractPacketsFromStream(text, rxPacketBuffer.current, Number(serialSettings.packetBufferSize) || 8192);
    rxPacketBuffer.current = rest;
    if (overflow) appendTx('接收协议缓存过长，已自动清空不完整数据包');
    handlePackets(packets);
  };

  const onNotify = (event) => {
    const bytes = new Uint8Array(event.target.value.buffer);
    const rawText = bytesToText(bytes, encodingRef.current);
    appendRx(rxModeRef.current === 'hex' ? bytesToHex(bytes) + ' ' : rawText);
    parsePackets(rawText);
  };

  async function attachBleDevice(device) {
    const serviceUuid = normalizeUuid(uuids.service);
    const writeUuid = normalizeUuid(uuids.write);
    const notifyUuid = normalizeUuid(uuids.notify || uuids.write);
    setStatus('连接 GATT 服务...');
    const server = await device.gatt.connect();
    const service = await server.getPrimaryService(serviceUuid);
    const writeChar = await service.getCharacteristic(writeUuid);
    const notifyChar = await service.getCharacteristic(notifyUuid);
    bluetoothRef.current = { device, server, writeChar, notifyChar };
    await notifyChar.startNotifications();
    notifyChar.addEventListener('characteristicvaluechanged', onNotify);
    setDeviceName(device.name || '未知设备');
    setConnectedAt(Date.now());
    setStatus(`已连接：${device.name || '未知设备'}`);
  }

  const connectBle = async () => {
    if (!navigator.bluetooth) {
      setStatus('当前浏览器不支持 Web Bluetooth，请使用桌面版 Chrome / Edge');
      return;
    }
    try {
      intentionallyDisconnected.current = false;
      setTransport('ble');
      const serviceUuid = normalizeUuid(uuids.service);
      setStatus('请求蓝牙设备权限...');
      const device = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: [serviceUuid] });
      device.addEventListener('gattserverdisconnected', async () => {
        setConnectedAt(null);
        setStatus(`已断开：${device.name || '未知设备'}`);
        if (!intentionallyDisconnected.current) await safeStop();
        if (autoReconnect && !intentionallyDisconnected.current) {
          setStatus(`已断开，3 秒后尝试重连：${device.name || '未知设备'}`);
          setTimeout(() => attachBleDevice(device).catch((err) => setStatus(`自动重连失败：${err.message}`)), 3000);
        }
      });
      await attachBleDevice(device);
    } catch (err) {
      setStatus(`BLE 连接失败：${err.message}`);
    }
  };

  const connectSerial = async () => {
    if (!navigator.serial) {
      setStatus('当前浏览器不支持 Web Serial，请使用桌面版 Chrome / Edge');
      return;
    }
    try {
      setTransport('serial');
      intentionallyDisconnected.current = false;
      rxPacketBuffer.current = '';
      let port = null;
      if (serialSettings.useRememberedPort && navigator.serial.getPorts) {
        const ports = await navigator.serial.getPorts();
        port = ports?.[0] || null;
      }
      if (!port) port = await navigator.serial.requestPort();
      const options = {
        baudRate: Number(serialSettings.baudRate) || 115200,
        dataBits: Number(serialSettings.dataBits) || 8,
        stopBits: Number(serialSettings.stopBits) || 1,
        parity: serialSettings.parity || 'none',
        flowControl: serialSettings.flowControl || 'none',
      };
      await port.open(options);
      const writer = port.writable.getWriter();
      serialRef.current = { port, writer, reader: null, keepReading: true };
      setDeviceName('Web Serial 设备');
      setConnectedAt(Date.now());
      setStatus(`串口已连接：${options.baudRate}bps / ${options.dataBits}${options.parity[0].toUpperCase()}${options.stopBits}`);
      readSerialLoop(port);
    } catch (err) {
      setStatus(`串口连接失败：${err.message}`);
    }
  };

  const readSerialLoop = async (port) => {
    while (port.readable && serialRef.current.keepReading) {
      const reader = port.readable.getReader();
      serialRef.current.reader = reader;
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          if (value) {
            const rawText = bytesToText(value, encodingRef.current);
            appendRx(rxModeRef.current === 'hex' ? bytesToHex(value) + ' ' : rawText);
            parsePackets(rawText);
          }
        }
      } catch (err) {
        if (serialRef.current.keepReading) setStatus(`串口读取失败：${err.message}`);
      } finally {
        reader.releaseLock();
      }
    }
  };

  const connectBridge = async () => {
    try {
      setTransport('bridge');
      intentionallyDisconnected.current = false;
      rxPacketBuffer.current = '';
      setStatus('正在连接本地串口桥...');
      const ws = new WebSocket(bridgeSettings.url || DEFAULT_BRIDGE.url);
      ws.binaryType = 'arraybuffer';
      bridgeRef.current.ws = ws;
      ws.onopen = () => {
        setDeviceName('Orange Pi 本地串口桥');
        setConnectedAt(Date.now());
        setStatus('本地桥已连接');
      };
      ws.onmessage = async (event) => {
        let rawText = '';
        let bytes = null;
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'rx') {
              rawText = msg.text || '';
              if (msg.hex) appendRx(rxModeRef.current === 'hex' ? `${msg.hex} ` : rawText);
            } else if (msg.type === 'status') {
              appendTx(`本地桥：${msg.message}`);
              return;
            }
          } catch {
            rawText = event.data;
            appendRx(rawText);
          }
        } else if (event.data instanceof Blob) {
          bytes = new Uint8Array(await event.data.arrayBuffer());
          rawText = bytesToText(bytes, encodingRef.current);
          appendRx(rxModeRef.current === 'hex' ? `${bytesToHex(bytes)} ` : rawText);
        } else {
          bytes = new Uint8Array(event.data);
          rawText = bytesToText(bytes, encodingRef.current);
          appendRx(rxModeRef.current === 'hex' ? `${bytesToHex(bytes)} ` : rawText);
        }
        if (rawText) parsePackets(rawText);
      };
      ws.onclose = () => {
        bridgeRef.current.ws = null;
        setConnectedAt(null);
        if (!intentionallyDisconnected.current) safeStop().catch(() => {});
        setStatus('本地桥已断开');
      };
      ws.onerror = () => setStatus('本地桥连接失败，请确认 Orange Pi 后端服务已启动');
    } catch (err) {
      setStatus(`本地桥连接失败：${err.message}`);
    }
  };

  const disconnect = async () => {
    intentionallyDisconnected.current = true;
    await safeStop();
    try {
      const { device, notifyChar } = bluetoothRef.current;
      notifyChar?.removeEventListener('characteristicvaluechanged', onNotify);
      if (device?.gatt?.connected) device.gatt.disconnect();
    } catch {}
    try {
      serialRef.current.keepReading = false;
      await serialRef.current.reader?.cancel();
      serialRef.current.writer?.releaseLock?.();
      await serialRef.current.port?.close?.();
    } catch {}
    try { bridgeRef.current.ws?.close?.(); } catch {}
    bluetoothRef.current = { device: null, server: null, writeChar: null, notifyChar: null };
    serialRef.current = { port: null, reader: null, writer: null, keepReading: false };
    bridgeRef.current = { ws: null };
    rxPacketBuffer.current = '';
    setConnectedAt(null);
    setStatus('未连接');
  };

  const writeBytes = async (bytes) => {
    if (loopback) return;
    if (transport === 'serial') {
      const writer = serialRef.current.writer;
      if (!writer) throw new Error('尚未连接串口');
      await writer.write(bytes);
      return;
    }
    if (transport === 'bridge') {
      const ws = bridgeRef.current.ws;
      if (!ws || ws.readyState !== WebSocket.OPEN) throw new Error('尚未连接本地串口桥');
      ws.send(bytes);
      return;
    }
    const ch = bluetoothRef.current.writeChar;
    if (!ch) throw new Error('尚未连接 BLE 写入特征值');
    const step = 20;
    const delay = Number(sendInterval) || 0;
    for (let i = 0; i < bytes.length; i += step) {
      const chunk = bytes.slice(i, i + step);
      if ('writeValueWithoutResponse' in ch) await ch.writeValueWithoutResponse(chunk);
      else await ch.writeValue(chunk);
      if (delay > 0 && i + step < bytes.length) await new Promise((r) => setTimeout(r, delay));
    }
  };

  const sendRaw = async (value, mode = txMode, silent = false) => {
    try {
      const bytes = mode === 'hex' ? hexToBytes(value) : textToBytes(value, encoding);
      await writeBytes(bytes);
      if (loopback) {
        const text = mode === 'hex' ? bytesToText(bytes, encoding) : value;
        appendRx(mode === 'hex' ? bytesToHex(bytes) + ' ' : text);
        parsePackets(text);
      }
      if (!silent) appendTx(mode === 'hex' ? bytesToHex(bytes) : value.replace(/\r/g, '\\r').replace(/\n/g, '\\n'));
    } catch (err) {
      appendTx(`发送失败：${err.message}`);
    }
  };

  const sendPacket = async (parts, silent = false) => {
    const nowTime = Date.now();
    const wait = Math.max(0, Number(packetInterval) || 0) - (nowTime - packetTimer.current);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    packetTimer.current = Date.now();
    const packet = makePacket(parts, shortPacket) + (packetNewline ? newlineValue : '');
    await sendRaw(packet, 'text', silent);
  };

  async function safeStop() {
    await sendPacket(['joystick', 0, 0, 0, 0], true);
  }

  const emergencyStop = async () => {
    setLeftJoy({ x: 0, y: 0 });
    setRightJoy({ x: 0, y: 0 });
    await sendPacket(['key', 'emergency', 'down']);
    await safeStop();
    appendTx('已触发急停：发送 emergency + joystick 回中');
  };

  useEffect(() => {
    const onBeforeUnload = () => { safeStop(); };
    const onVisibility = () => { if (document.hidden) safeStop(); };
    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  useInterval(() => {
    if (!connected) return;
    const active = joyActive || keyboardVector.active || tab === 'remote';
    if (!active) return;
    const lj = keyboardVector.active ? { x: keyboardVector.x, y: keyboardVector.y } : leftJoy;
    sendPacket(['joystick', lj.x, lj.y, rightJoy.x, rightJoy.y], true);
  }, Math.max(20, Number(packetInterval) || 50));

  useEffect(() => {
    if (!joyActive && !keyboardVector.active) safeStop();
  }, [joyActive, keyboardVector.active]);

  useEffect(() => {
    const updateVector = () => {
      const keys = keysDown.current;
      const speed = Number(joystickConfig.maxY) || 100;
      const turn = Number(joystickConfig.maxX) || 100;
      let x = 0, y = 0;
      if (keys.has('w')) y += speed;
      if (keys.has('s')) y -= speed;
      if (keys.has('a')) x -= turn;
      if (keys.has('d')) x += turn;
      setKeyboardVector({ x, y, active: x !== 0 || y !== 0 });
    };
    const down = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      const editing = ['input', 'textarea', 'select'].includes(tag);
      const k = e.key.toLowerCase();
      if (!editing && ['w', 'a', 's', 'd'].includes(k)) {
        e.preventDefault(); keysDown.current.add(k); updateVector(); return;
      }
      if (editing) return;
      if (k === ' ') { e.preventDefault(); emergencyStop(); }
      else if (k === 'p') setPlotSettings((p) => ({ ...p, paused: !p.paused }));
      else if (k === 'r') clearPlot();
      else if (k === 'f') requestFullscreen();
      else if (k === 'c') connected ? disconnect() : (transport === 'serial' ? connectSerial() : transport === 'bridge' ? connectBridge() : connectBle());
    };
    const up = (e) => {
      const k = e.key.toLowerCase();
      if (['w', 'a', 's', 'd'].includes(k)) { keysDown.current.delete(k); updateVector(); }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, [connected, transport, joystickConfig, leftJoy, rightJoy, shortPacket, packetNewline, newlineValue, packetInterval]);

  const plotKeys = useMemo(() => {
    const keys = new Set();
    plotData.forEach((row) => Object.keys(row).forEach((k) => { if (k.startsWith('CH')) keys.add(k); }));
    return [...keys].sort((a, b) => Number(a.slice(2)) - Number(b.slice(2)));
  }, [plotData]);

  const visibleRowsRaw = useMemo(() => {
    const rows = plotSettings.autoScroll ? plotData.slice(-Math.max(10, Number(plotSettings.maxPoints) || 300)) : plotData;
    return rows;
  }, [plotData, plotSettings.autoScroll, plotSettings.maxPoints]);

  const visibleRows = useMemo(() => smoothRows(visibleRowsRaw, plotKeys), [visibleRowsRaw, plotKeys, plotSettings.smooth, plotSettings.smoothWindow]);

  const stats = useMemo(() => {
    const out = {};
    for (const key of plotKeys) {
      const vals = plotData.map((r) => Number(r[key])).filter(Number.isFinite);
      if (!vals.length) continue;
      out[key] = {
        latest: vals[vals.length - 1],
        max: Math.max(...vals),
        min: Math.min(...vals),
        avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      };
    }
    return out;
  }, [plotData, plotKeys]);

  const clearPlot = () => { plotStart.current = Date.now(); setPlotData([]); };
  const applySpeedTemplate = () => setCurveNames((old) => ({ ...old, CH1: '当前速度', CH2: '目标速度', CH3: 'PWM输出', CH4: '速度误差' }));

  const startRecord = () => { recordBuffer.current = []; setRecording(true); appendTx(`开始记录：${recordName}`); };
  const stopRecord = () => {
    setRecording(false);
    const rows = recordBuffer.current.slice();
    if (!rows.length) { appendTx('记录为空，未保存'); return; }
    const rec = { id: Date.now(), name: recordName || '未命名记录', createdAt: new Date().toISOString(), rows, curveNames };
    setRecords((old) => [rec, ...old].slice(0, 20));
    appendTx(`已保存记录：${rec.name}，${rows.length} 点`);
  };
  const replayRecord = (rec) => { plotStart.current = Date.now(); setCurveNames(rec.curveNames || curveNames); setPlotData(rec.rows || []); setTab('plot'); };

  const sendSlider = async (name, value) => sendPacket(['slider', name, value]);
  const sendAllPid = async () => {
    const items = [
      ['target', pid.targetSpeed], ['Kp', pid.kp], ['Ki', pid.ki], ['Kd', pid.kd], ['leftBias', pid.leftBias], ['rightBias', pid.rightBias],
    ];
    for (const item of items) await sendSlider(item[0], item[1]);
  };
  const savePidGroup = () => {
    const group = { ...pid, id: Date.now(), savedAt: new Date().toISOString() };
    setPidGroups((old) => [group, ...old.filter((g) => g.groupName !== group.groupName)].slice(0, 12));
  };

  const exportConfig = () => {
    const config = { transport, autoReconnect, preset, uuids, encoding, newline, packetNewline, shortPacket, sendInterval, packetInterval, cacheSize, rxMode, txMode, txText, tab, loopback, joystick: joystickConfig, plot: plotSettings, curveNames, curveVisible, theme, buttons, sliders, pid, pidGroups, serial: serialSettings, bridge: bridgeSettings };
    downloadTextFile(`bluetooth_tuning_config_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(config, null, 2), 'application/json;charset=utf-8');
  };
  const importConfig = async (file) => {
    if (!file) return;
    const text = await file.text();
    const cfg = { ...DEFAULT_CONFIG, ...JSON.parse(text) };
    setTransport(cfg.transport); setAutoReconnect(cfg.autoReconnect); setPreset(cfg.preset); setUuids(cfg.uuids); setEncoding(cfg.encoding); setNewline(cfg.newline); setPacketNewline(cfg.packetNewline); setShortPacket(cfg.shortPacket); setSendInterval(cfg.sendInterval); setPacketInterval(cfg.packetInterval); setCacheSize(cfg.cacheSize); setRxMode(cfg.rxMode); setTxMode(cfg.txMode); setTxText(cfg.txText); setTab(cfg.tab); setLoopback(cfg.loopback); setJoystickConfig(cfg.joystick); setPlotSettings(cfg.plot); setCurveNames(cfg.curveNames); setCurveVisible(cfg.curveVisible); setTheme(cfg.theme); setButtons(cfg.buttons); setSliders(cfg.sliders); setPid({ ...DEFAULT_PID, ...(cfg.pid || {}) }); setPidGroups(cfg.pidGroups || []); setSerialSettings({ ...DEFAULT_SERIAL, ...(cfg.serial || {}) }); setBridgeSettings({ ...DEFAULT_BRIDGE, ...(cfg.bridge || {}) });
  };
  const resetConfig = () => {
    if (!confirm('确认恢复默认配置？当前浏览器保存的界面设置会被覆盖。')) return;
    localStorage.removeItem(CONFIG_KEY);
    location.reload();
  };

  const requestFullscreen = () => document.documentElement.requestFullscreen?.();

  const renderStatus = () => (
    <Card className="connection">
      <div className={`status ${connected ? 'ok' : 'bad'}`}>{status}</div>
      <div className="status-meta">设备：{deviceName || '未选择'} · 方式：{loopback ? '环回' : transport === 'serial' ? 'Web Serial' : transport === 'bridge' ? '本地桥' : 'BLE'} · 时长：{formatDuration(connectedAt ? now - connectedAt : 0)}</div>
      <Button variant="primary" onClick={transport === 'serial' ? connectSerial : transport === 'bridge' ? connectBridge : connectBle}>{transport === 'serial' ? <Usb size={16} /> : transport === 'bridge' ? <Cable size={16} /> : <Bluetooth size={16} />}连接</Button>
      <Button onClick={disconnect}><Cable size={16} />断开</Button>
      <Button variant="danger" onClick={emergencyStop}><AlertTriangle size={16} />急停</Button>
    </Card>
  );

  const renderSettings = () => (
    <Card>
      <SectionTitle icon={Settings} title="连接与通用设置" />
      <div className="grid2">
        <label>连接方式<select value={transport} onChange={(e) => setTransport(e.target.value)}><option value="serial">Web Serial / USB-TTL</option><option value="bridge">Orange Pi 本地桥</option><option value="ble">BLE 蓝牙</option></select></label>
        <label className="check with-title"><span>环回测试</span><input type="checkbox" checked={loopback} onChange={(e) => setLoopback(e.target.checked)} /></label>
      </div>
      {transport === 'ble' && <>
        <label>模块预设<select value={preset} onChange={(e) => setPreset(e.target.value)}>{Object.entries(PRESETS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
        {['service', 'write', 'notify'].map((key) => <label key={key}>{key.toUpperCase()} UUID<input className="mono" value={uuids[key]} onChange={(e) => { setPreset('custom'); setUuids({ ...uuids, [key]: e.target.value }); }} /></label>)}
        <label className="check"><input type="checkbox" checked={autoReconnect} onChange={(e) => setAutoReconnect(e.target.checked)} />断线后自动尝试重连</label>
      </>}
      {transport === 'serial' && <div className="serial-options">
        <div className="grid3">
          <MiniInput label="波特率" type="number" value={serialSettings.baudRate} onChange={(v) => setSerialSettings({ ...serialSettings, baudRate: v })} />
          <label>数据位<select value={serialSettings.dataBits} onChange={(e) => setSerialSettings({ ...serialSettings, dataBits: Number(e.target.value) })}><option value={8}>8</option><option value={7}>7</option></select></label>
          <label>停止位<select value={serialSettings.stopBits} onChange={(e) => setSerialSettings({ ...serialSettings, stopBits: Number(e.target.value) })}><option value={1}>1</option><option value={2}>2</option></select></label>
        </div>
        <div className="grid3">
          <label>校验位<select value={serialSettings.parity} onChange={(e) => setSerialSettings({ ...serialSettings, parity: e.target.value })}><option value="none">none</option><option value="even">even</option><option value="odd">odd</option></select></label>
          <label>流控<select value={serialSettings.flowControl} onChange={(e) => setSerialSettings({ ...serialSettings, flowControl: e.target.value })}><option value="none">none</option><option value="hardware">hardware</option></select></label>
          <MiniInput label="协议残包缓存" type="number" value={serialSettings.packetBufferSize} onChange={(v) => setSerialSettings({ ...serialSettings, packetBufferSize: v })} />
        </div>
        <label className="check"><input type="checkbox" checked={serialSettings.useRememberedPort} onChange={(e) => setSerialSettings({ ...serialSettings, useRememberedPort: e.target.checked })} />优先连接已授权串口，适合 Orange Pi Kiosk 模式</label>
        <p className="hint">建议 Orange Pi 手持版优先用 USB-TTL：CH340 / CP2102 / STM32 虚拟串口均可。</p>
      </div>}
      {transport === 'bridge' && <div className="serial-options">
        <label>本地桥 WebSocket 地址<input className="mono" value={bridgeSettings.url} onChange={(e) => setBridgeSettings({ ...bridgeSettings, url: e.target.value })} /></label>
        <p className="hint">本地桥由 Orange Pi 上的 Python 程序打开真实串口，网页只连 ws://127.0.0.1:8765/ws，可减少浏览器串口授权弹窗。</p>
      </div>}
      <div className="grid2">
        <label>文本编码<select value={encoding} onChange={(e) => setEncoding(e.target.value)}><option value="utf-8">UTF-8</option><option value="gbk">GBK</option></select></label>
        <label>换行格式<select value={newline} onChange={(e) => setNewline(e.target.value)}><option value="\r\n">\r\n</option><option value="\n">\n</option><option value="\r">\r</option></select></label>
      </div>
      <div className="grid2">
        <MiniInput label="发送节流 ms" type="number" value={sendInterval} onChange={setSendInterval} />
        <MiniInput label="数据包间隔 ms" type="number" value={packetInterval} onChange={setPacketInterval} />
      </div>
      <MiniInput label="接收缓存 ch" type="number" value={cacheSize} onChange={setCacheSize} />
      <label className="check"><input type="checkbox" checked={packetNewline} onChange={(e) => setPacketNewline(e.target.checked)} />数据包末尾加换行</label>
      <label className="check"><input type="checkbox" checked={shortPacket} onChange={(e) => setShortPacket(e.target.checked)} />数据包使用短格式</label>
    </Card>
  );

  const renderTabs = () => (
    <Card className="nav-card">
      {[
        ['serial', Cable, '串口'], ['drive', Car, '小车联调'], ['remote', Gamepad2, '全屏驾驶'], ['plot', Activity, '绘图'],
        ['display', Monitor, '显示屏'], ['buttons', SquareMousePointer, '按键'], ['sliders', SlidersHorizontal, '滑杆'],
        ['records', Save, '记录回放'], ['theme', Palette, '说明/外观'], ['config', FileDown, '配置'],
      ].map(([k, Icon, label]) => <Button key={k} variant={tab === k ? 'primary' : 'secondary'} onClick={() => setTab(k)}><Icon size={16} />{label}</Button>)}
    </Card>
  );

  const renderSerial = () => (
    <div className="two-cols">
      <Card><SectionTitle icon={Cable} title="接收区" right={<div className="row"><Button onClick={() => setRxMode(rxMode === 'text' ? 'hex' : 'text')}>{rxMode}</Button><Button onClick={() => setRxLog('')}><Trash2 size={16} /></Button></div>} /><textarea className="big-text" value={rxLog} readOnly /></Card>
      <Card><SectionTitle icon={Send} title="发送区" right={<Button onClick={() => setTxMode(txMode === 'text' ? 'hex' : 'text')}>{txMode}</Button>} /><textarea className="small-text" value={txText} onChange={(e) => setTxText(e.target.value)} /><div className="row mt"><Button variant="primary" onClick={() => sendRaw(txMode === 'text' ? txText + newlineValue : txText)}><Send size={16} />发送</Button><Button onClick={() => setTxLog('')}><Trash2 size={16} />清记录</Button></div><pre className="log">{txLog}</pre></Card>
    </div>
  );

  const renderPlotControls = (compact = false) => (
    <Card className={compact ? 'compact-card' : ''}>
      <SectionTitle icon={Activity} title="绘图控制" right={<div className="row"><Button onClick={() => setPlotSettings((p) => ({ ...p, paused: !p.paused }))}>{plotSettings.paused ? <Play size={16} /> : <Pause size={16} />}{plotSettings.paused ? '继续' : '暂停'}</Button><Button onClick={clearPlot}><Trash2 size={16} />清空</Button></div>} />
      <div className="grid3">
        <label>显示模式<select value={plotSettings.mode} onChange={(e) => setPlotSettings({ ...plotSettings, mode: e.target.value })}><option value="single">单图模式</option><option value="split">分图模式</option></select></label>
        <label>Y 轴<select value={plotSettings.yAxisMode} onChange={(e) => setPlotSettings({ ...plotSettings, yAxisMode: e.target.value })}><option value="auto">自动范围</option><option value="fixed">固定范围</option></select></label>
        <MiniInput label="最近点数" type="number" value={plotSettings.maxPoints} onChange={(v) => setPlotSettings({ ...plotSettings, maxPoints: v })} />
      </div>
      <div className="grid3">
        <MiniInput label="Y 最小" type="number" value={plotSettings.yMin} onChange={(v) => setPlotSettings({ ...plotSettings, yMin: v })} />
        <MiniInput label="Y 最大" type="number" value={plotSettings.yMax} onChange={(v) => setPlotSettings({ ...plotSettings, yMax: v })} />
        <label className="check with-title"><span>自动滚动</span><input type="checkbox" checked={plotSettings.autoScroll} onChange={(e) => setPlotSettings({ ...plotSettings, autoScroll: e.target.checked })} /></label>
      </div>
      <div className="row mt"><label className="check inline"><input type="checkbox" checked={plotSettings.smooth} onChange={(e) => setPlotSettings({ ...plotSettings, smooth: e.target.checked })} />曲线平滑</label><MiniInput label="平滑窗口" type="number" value={plotSettings.smoothWindow} onChange={(v) => setPlotSettings({ ...plotSettings, smoothWindow: v })} /><Button onClick={() => exportPlotCsv(plotData, plotKeys, curveNames)}><Download size={16} />导出 CSV</Button><Button onClick={applySpeedTemplate}><Car size={16} />速度闭环模板</Button></div>
    </Card>
  );

  const renderPlotPanel = (compact = false) => (
    <div className="stack">
      {!compact && renderPlotControls()}
      <Card>
        <SectionTitle icon={Activity} title="实时曲线" right={<span className="hint">数据点：{plotData.length}，显示：{visibleRows.length}</span>} />
        <PlotChart rows={visibleRows} keys={plotKeys} names={curveNames} visible={curveVisible} colors={PLOT_COLORS} settings={plotSettings} compact={compact} />
        {!compact && <>
          <div className="plot-channel-panel">
            {plotKeys.map((key, i) => <div className="plot-channel-row" key={key}>
              <span className="plot-color-chip"><i style={{ background: PLOT_COLORS[i % PLOT_COLORS.length] }} />{key}</span>
              <input value={curveNames[key] || key} onChange={(e) => setCurveNames({ ...curveNames, [key]: e.target.value })} />
              <label className="check inline"><input type="checkbox" checked={curveVisible[key] !== false} onChange={(e) => setCurveVisible({ ...curveVisible, [key]: e.target.checked })} />显示</label>
              <span className="value-box small">最新 {stats[key]?.latest?.toFixed?.(2) ?? '-'}</span>
            </div>)}
          </div>
          <div className="stat-grid">
            {plotKeys.map((key) => <div className="stat-card" key={key}><b>{curveNames[key] || key}</b><span>最新：{stats[key]?.latest?.toFixed?.(3) ?? '-'}</span><span>最大：{stats[key]?.max?.toFixed?.(3) ?? '-'}</span><span>最小：{stats[key]?.min?.toFixed?.(3) ?? '-'}</span><span>平均：{stats[key]?.avg?.toFixed?.(3) ?? '-'}</span></div>)}
          </div>
        </>}
      </Card>
    </div>
  );

  const renderPidPanel = () => {
    const pidItems = [
      ['targetSpeed', '目标速度', 'target'], ['kp', 'Kp', 'Kp'], ['ki', 'Ki', 'Ki'], ['kd', 'Kd', 'Kd'], ['leftBias', '左轮补偿', 'leftBias'], ['rightBias', '右轮补偿', 'rightBias'],
    ];
    const change = (key, delta) => setPid((p) => ({ ...p, [key]: Number(p[key] || 0) + delta }));
    return <Card><SectionTitle icon={SlidersHorizontal} title="PID 参数组" right={<div className="row"><Button variant="primary" onClick={sendAllPid}><Send size={16} />一键发送全部</Button><Button onClick={savePidGroup}><Save size={16} />保存参数组</Button></div>} />
      <MiniInput label="参数组名称" value={pid.groupName} onChange={(v) => setPid({ ...pid, groupName: v })} />
      <div className="pid-grid">{pidItems.map(([key, label, sendName]) => <div className="pid-row" key={key}><b>{label}</b><Button onClick={() => change(key, -Number(pid.stepLarge || 10))}>-{pid.stepLarge}</Button><Button onClick={() => change(key, -Number(pid.stepSmall || 1))}>-{pid.stepSmall}</Button><input type="number" value={pid[key]} onChange={(e) => setPid({ ...pid, [key]: Number(e.target.value) })} /><Button onClick={() => change(key, Number(pid.stepSmall || 1))}>+{pid.stepSmall}</Button><Button onClick={() => change(key, Number(pid.stepLarge || 10))}>+{pid.stepLarge}</Button><Button onClick={() => sendSlider(sendName, pid[key])}><Send size={14} /></Button></div>)}</div>
      <div className="grid2"><MiniInput label="小步进" type="number" value={pid.stepSmall} onChange={(v) => setPid({ ...pid, stepSmall: v })} /><MiniInput label="大步进" type="number" value={pid.stepLarge} onChange={(v) => setPid({ ...pid, stepLarge: v })} /></div>
      <h3>已保存参数组</h3><div className="group-list">{pidGroups.map((g) => <div className="group-row" key={g.id || g.groupName}><span><b>{g.groupName}</b><em>Kp={g.kp}, Ki={g.ki}, Kd={g.kd}, Target={g.targetSpeed}</em></span><Button onClick={() => setPid({ ...DEFAULT_PID, ...g })}>载入</Button><Button onClick={() => setPidGroups(pidGroups.filter((x) => x !== g))}><Trash2 size={14} /></Button></div>)}</div>
    </Card>;
  };

  const renderDrive = (remote = false) => (
    <div className={remote ? 'remote-layout' : 'drive-split'}>
      <div className="stack">
        {!remote && renderPidPanel()}
        <Card><SectionTitle icon={Gamepad2} title="摇杆控制" right={<Button onClick={() => sendPacket(['joystick', 0, 0, 0, 0])}><RotateCcw size={16} />回中</Button>} />
          <div className="joy-grid"><Joystick label="左摇杆 / WASD" value={keyboardVector.active ? { x: keyboardVector.x, y: keyboardVector.y } : leftJoy} config={joystickConfig} onChange={setLeftJoy} onActiveChange={setJoyActive} large={remote} /><Joystick label="右摇杆" value={rightJoy} config={joystickConfig} onChange={setRightJoy} onActiveChange={setJoyActive} large={remote} /></div>
          {!remote && <div className="grid3 mt"><MiniInput label="横向最大值" type="number" value={joystickConfig.maxX} onChange={(v) => setJoystickConfig({ ...joystickConfig, maxX: v })} /><MiniInput label="纵向最大值" type="number" value={joystickConfig.maxY} onChange={(v) => setJoystickConfig({ ...joystickConfig, maxY: v })} /><MiniInput label="死区" type="number" value={joystickConfig.deadzone} onChange={(v) => setJoystickConfig({ ...joystickConfig, deadzone: v })} /><MiniInput label="横向步距" type="number" value={joystickConfig.stepX} onChange={(v) => setJoystickConfig({ ...joystickConfig, stepX: v })} /><MiniInput label="纵向步距" type="number" value={joystickConfig.stepY} onChange={(v) => setJoystickConfig({ ...joystickConfig, stepY: v })} /><label>形状<select value={joystickConfig.shape} onChange={(e) => setJoystickConfig({ ...joystickConfig, shape: e.target.value })}><option value="square">方形</option><option value="circle">圆形</option></select></label><label className="check"><input type="checkbox" checked={joystickConfig.invertX} onChange={(e) => setJoystickConfig({ ...joystickConfig, invertX: e.target.checked })} />横向反向</label><label className="check"><input type="checkbox" checked={joystickConfig.invertY} onChange={(e) => setJoystickConfig({ ...joystickConfig, invertY: e.target.checked })} />纵向反向</label></div>}
        </Card>
      </div>
      <div className="stack">{remote && <Card><SectionTitle icon={StopCircle} title="驾驶模式" right={<Button onClick={requestFullscreen}><Maximize2 size={16} />浏览器全屏</Button>} /><div className="remote-kpis"><div>连接：{status}</div><div>左摇杆：{leftJoy.x},{leftJoy.y}</div><div>右摇杆：{rightJoy.x},{rightJoy.y}</div><div>键盘：WASD 控制，空格急停</div></div></Card>}{renderPlotPanel(true)}</div>
    </div>
  );

  const renderDisplay = () => <Card><SectionTitle icon={Monitor} title="显示屏：接收 [display,x,y,text,size]" right={<Button onClick={() => setDisplayItems([])}><Trash2 size={16} />清空</Button>} /><div className="display-screen"><div className="origin">(0,0)</div>{displayItems.map((it, idx) => <div className="display-item" key={`${it.x}-${it.y}-${idx}`} style={{ left: it.x, top: it.y, fontSize: it.size }}>{it.content}</div>)}</div></Card>;

  const renderButtons = () => <Card><SectionTitle icon={SquareMousePointer} title="按键" right={<Button onClick={() => setButtons([...buttons, { name: String(buttons.length + 1), lock: false, state: false }])}>增加</Button>} /><div className="button-grid">{buttons.map((btn, idx) => <div className="button-editor" key={idx}><input value={btn.name} onChange={(e) => setButtons(buttons.map((b, i) => i === idx ? { ...b, name: e.target.value } : b))} /><label className="check"><input type="checkbox" checked={btn.lock} onChange={(e) => setButtons(buttons.map((b, i) => i === idx ? { ...b, lock: e.target.checked } : b))} />自锁</label><Button className="big-button" variant={btn.state ? 'primary' : 'secondary'} onPointerDown={() => { if (btn.lock) return; setButtons(buttons.map((b, i) => i === idx ? { ...b, state: true } : b)); sendPacket(['key', btn.name, 'down']); }} onPointerUp={() => { if (btn.lock) { const next = !btn.state; setButtons(buttons.map((b, i) => i === idx ? { ...b, state: next } : b)); sendPacket(['key', btn.name, next ? 'down' : 'up']); } else { setButtons(buttons.map((b, i) => i === idx ? { ...b, state: false } : b)); sendPacket(['key', btn.name, 'up']); } }}>{btn.name}</Button></div>)}</div></Card>;

  const renderSliders = () => <Card><SectionTitle icon={SlidersHorizontal} title="滑杆" right={<Button onClick={() => setSliders([...sliders, { name: String(sliders.length + 1), min: 0, max: 100, step: 1, value: 50 }])}>增加</Button>} /><div className="stack">{sliders.map((s, idx) => <div className="slider-row" key={idx}><div className="grid5"><input value={s.name} onChange={(e) => setSliders(sliders.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} /><input type="number" value={s.min} onChange={(e) => setSliders(sliders.map((x, i) => i === idx ? { ...x, min: Number(e.target.value) } : x))} /><input type="number" value={s.max} onChange={(e) => setSliders(sliders.map((x, i) => i === idx ? { ...x, max: Number(e.target.value) } : x))} /><input type="number" value={s.step} onChange={(e) => setSliders(sliders.map((x, i) => i === idx ? { ...x, step: Number(e.target.value) } : x))} /><div className="value-box">{s.value}</div></div><input type="range" min={s.min} max={s.max} step={s.step} value={s.value} onChange={(e) => { const value = Number(e.target.value); setSliders(sliders.map((x, i) => i === idx ? { ...x, value } : x)); sendPacket(['slider', s.name, value]); }} /></div>)}</div></Card>;

  const renderRecords = () => <div className="stack"><Card><SectionTitle icon={Save} title="数据记录" right={<div className="row"><Button variant={recording ? 'danger' : 'primary'} onClick={recording ? stopRecord : startRecord}>{recording ? <StopCircle size={16} /> : <Play size={16} />}{recording ? '停止并保存' : '开始记录'}</Button></div>} /><MiniInput label="记录名称" value={recordName} onChange={setRecordName} /><p>记录时不会改变协议，只保存网页收到的 [plot,...] 数据。可用于不同 PID 参数的曲线对比。</p></Card><Card><SectionTitle icon={RefreshCw} title="历史记录回放" /><div className="group-list">{records.map((rec) => <div className="group-row" key={rec.id}><span><b>{rec.name}</b><em>{new Date(rec.createdAt).toLocaleString()} · {rec.rows?.length || 0} 点</em></span><Button onClick={() => replayRecord(rec)}>回放</Button><Button onClick={() => exportPlotCsv(rec.rows || [], Object.keys(rec.rows?.[0] || {}).filter((k) => k.startsWith('CH')), rec.curveNames || {})}><Download size={14} /></Button><Button onClick={() => setRecords(records.filter((r) => r.id !== rec.id))}><Trash2 size={14} /></Button></div>)}</div></Card></div>;

  const renderThemeHelp = () => <div className="stack"><Card><SectionTitle icon={HelpCircle} title="使用说明" /><div className="help-grid"><div><h3>连接</h3><p>Web Serial 可直接连接 USB-TTL、CH340、CP2102、STM32 虚拟串口；Orange Pi 本地桥适合开机自启动；BLE 模式仍保留 UUID 预设。环回测试不需要硬件。</p></div><div><h3>协议</h3><pre>[key,name,down/up]\n[slider,name,value]\n[joystick,lx,ly,rx,ry]\n[plot,v1,v2,...]\n[display,x,y,text,size]</pre></div><div><h3>快捷键</h3><p>空格急停；W/A/S/D 控制左摇杆；P 暂停绘图；R 清空绘图；F 浏览器全屏；C 连接/断开。</p></div><div><h3>安全</h3><p>页面隐藏、断开连接、关闭页面时会尽量发送 [joystick,0,0,0,0]，急停按钮固定在页面右上角。串口接收已加入分包/粘包缓存。</p></div></div></Card><Card><SectionTitle icon={Paintbrush} title="外观设置" right={<div className="row">{Object.entries(THEME_PRESETS).map(([k, v]) => <Button key={k} onClick={() => setTheme({ ...theme, ...v.values })}>{v.label}</Button>)}</div>} /><div className="theme-grid">{['primary','accent','danger','bg','card','input','text','muted','border'].map((key) => <label key={key}>{key}<input type="color" value={theme[key]} onChange={(e) => setTheme({ ...theme, [key]: e.target.value })} /></label>)}</div><div className="grid3"><MiniInput label="圆角" type="number" value={theme.radius} onChange={(v) => setTheme({ ...theme, radius: v })} /><MiniInput label="字体缩放" type="number" step="0.05" value={theme.fontScale} onChange={(v) => setTheme({ ...theme, fontScale: v })} /><label>密度<select value={theme.density} onChange={(e) => setTheme({ ...theme, density: e.target.value })}><option value="compact">紧凑</option><option value="comfortable">舒适</option><option value="large">宽松</option></select></label><label>阴影<select value={theme.shadow} onChange={(e) => setTheme({ ...theme, shadow: e.target.value })}><option value="flat">扁平</option><option value="soft">柔和阴影</option><option value="glow">科技发光</option></select></label></div></Card></div>;

  const renderConfig = () => <Card><SectionTitle icon={FileDown} title="配置导入 / 导出" /><div className="row"><Button variant="primary" onClick={exportConfig}><FileDown size={16} />导出配置 JSON</Button><label className="file-btn"><FileUp size={16} />导入配置 JSON<input type="file" accept="application/json,.json" onChange={(e) => importConfig(e.target.files?.[0])} /></label><Button variant="danger" onClick={resetConfig}><RotateCcw size={16} />恢复默认配置</Button></div><p>配置包含蓝牙 UUID、主题、摇杆参数、曲线名称、显示隐藏、PID 参数组、按键和滑杆。换电脑或队友共用时可直接导入。</p></Card>;

  let content = null;
  if (tab === 'serial') content = renderSerial();
  else if (tab === 'drive') content = renderDrive(false);
  else if (tab === 'remote') content = renderDrive(true);
  else if (tab === 'plot') content = renderPlotPanel(false);
  else if (tab === 'display') content = renderDisplay();
  else if (tab === 'buttons') content = renderButtons();
  else if (tab === 'sliders') content = renderSliders();
  else if (tab === 'records') content = renderRecords();
  else if (tab === 'theme') content = renderThemeHelp();
  else if (tab === 'config') content = renderConfig();

  return <div className={appClass} style={themeStyle}>
    <Button className="sticky-emergency" variant="danger" onClick={emergencyStop}><AlertTriangle size={18} />急停 SPACE</Button>
    <div className="container">
      <header className="hero"><div><h1>手持 PID 调参终端</h1><p>Orange Pi · Web Serial · 本地串口桥 · BLE 调参 · 小车联调 · 实时绘图</p></div>{renderStatus()}</header>
      <div className="layout"><aside className="sidebar">{renderSettings()}{renderTabs()}</aside><main className="content">{content}</main></div>
    </div>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
