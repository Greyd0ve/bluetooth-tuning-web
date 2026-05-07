#!/usr/bin/env python3
"""
Orange Pi 本地串口桥：
- 后端打开真实串口，例如 /dev/ttyUSB0
- 前端连接 ws://127.0.0.1:8765/ws
- 浏览器不再直接申请 Web Serial 权限，适合 Kiosk 开机自启动
"""
import argparse
import asyncio
import json
import signal
from datetime import datetime
from pathlib import Path

import serial
import serial.tools.list_ports
import websockets


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def list_ports() -> list[str]:
    return [p.device for p in serial.tools.list_ports.comports()]


class SerialBridge:
    def __init__(self, port: str, baudrate: int, log_dir: str | None = None) -> None:
        self.port = port
        self.baudrate = baudrate
        self.ser: serial.Serial | None = None
        self.clients: set[websockets.WebSocketServerProtocol] = set()
        self.running = True
        self.log_file = None
        if log_dir:
            Path(log_dir).mkdir(parents=True, exist_ok=True)
            self.log_file = open(Path(log_dir) / f"serial_{datetime.now():%Y%m%d_%H%M%S}.log", "ab")

    def open(self) -> None:
        self.ser = serial.Serial(self.port, self.baudrate, timeout=0.05)
        print(f"[{now_iso()}] opened {self.port} @ {self.baudrate}", flush=True)

    def close(self) -> None:
        self.running = False
        if self.ser and self.ser.is_open:
            self.ser.close()
        if self.log_file:
            self.log_file.close()

    async def broadcast_rx(self, data: bytes) -> None:
        if self.log_file:
            self.log_file.write(data)
            self.log_file.flush()
        text = data.decode("utf-8", errors="replace")
        message = json.dumps({"type": "rx", "text": text, "hex": data.hex(" ").upper()}, ensure_ascii=False)
        dead = []
        for ws in self.clients:
            try:
                await ws.send(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.clients.discard(ws)

    async def serial_reader(self) -> None:
        assert self.ser is not None
        while self.running:
            try:
                data = await asyncio.to_thread(self.ser.read, 512)
                if data:
                    await self.broadcast_rx(data)
                else:
                    await asyncio.sleep(0.005)
            except Exception as exc:
                print(f"[{now_iso()}] serial read error: {exc}", flush=True)
                await asyncio.sleep(0.5)

    async def handler(self, websocket) -> None:
        self.clients.add(websocket)
        await websocket.send(json.dumps({"type": "status", "message": f"connected to {self.port} @ {self.baudrate}"}, ensure_ascii=False))
        try:
            async for message in websocket:
                if not self.ser or not self.ser.is_open:
                    await websocket.send(json.dumps({"type": "status", "message": "serial is not open"}, ensure_ascii=False))
                    continue
                if isinstance(message, str):
                    payload = message.encode("utf-8")
                else:
                    payload = bytes(message)
                await asyncio.to_thread(self.ser.write, payload)
                await asyncio.to_thread(self.ser.flush)
        finally:
            self.clients.discard(websocket)


async def main() -> None:
    parser = argparse.ArgumentParser(description="Orange Pi local serial WebSocket bridge")
    parser.add_argument("--port", default="auto", help="serial port, e.g. /dev/ttyUSB0, /dev/ttyACM0, or auto")
    parser.add_argument("--baud", type=int, default=115200, help="baud rate")
    parser.add_argument("--host", default="127.0.0.1", help="WebSocket host")
    parser.add_argument("--ws-port", type=int, default=8765, help="WebSocket port")
    parser.add_argument("--log-dir", default="logs", help="directory for raw serial logs, empty to disable")
    args = parser.parse_args()

    port = args.port
    if port == "auto":
        ports = list_ports()
        if not ports:
            raise SystemExit("No serial port found. Plug in USB-TTL or specify --port /dev/ttyUSB0")
        port = ports[0]

    bridge = SerialBridge(port, args.baud, args.log_dir or None)
    bridge.open()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, bridge.close)

    async with websockets.serve(bridge.handler, args.host, args.ws_port, max_size=2**20):
        print(f"[{now_iso()}] websocket listening on ws://{args.host}:{args.ws_port}/ws", flush=True)
        await bridge.serial_reader()


if __name__ == "__main__":
    asyncio.run(main())
