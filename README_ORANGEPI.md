# Orange Pi 4 Pro 手持 PID 调参终端部署说明

本版本仍然可以作为普通 GitHub Pages 静态网站部署，同时增加了面向 Orange Pi 4 Pro 的手持调参终端支持。

## 推荐硬件连接

```text
Orange Pi 4 Pro
  USB-A / USB-C
    ↓
USB-TTL 模块：CH340 / CP2102 / FT232 / STM32 虚拟串口
    ↓
单片机 UART
```

注意：不要把 5V TTL 直接接到 Orange Pi GPIO。手持调试建议优先使用 USB-TTL，避免烧板。

## 方案 A：直接使用 Web Serial

适合快速原型。步骤：

```bash
npm install
npm run dev:lan
```

在 Orange Pi 的 Chromium 浏览器打开本地页面，选择：

```text
连接方式 -> Web Serial / USB-TTL
波特率 -> 与单片机一致，例如 115200
点击连接
```

优点：不用后端，代码简单。

缺点：Chromium 可能需要手动选择串口设备，不适合完全无人值守开机自启。

## 方案 B：使用 Orange Pi 本地串口桥

适合最终手持设备。Python 后端负责打开真实串口，网页只连接本机 WebSocket。

### 安装依赖

```bash
cd orangepi
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 查看串口

```bash
ls /dev/ttyUSB* /dev/ttyACM* 2>/dev/null
```

### 启动串口桥

```bash
python3 serial_bridge.py --port /dev/ttyUSB0 --baud 115200
```

也可以自动选择第一个串口：

```bash
python3 serial_bridge.py --port auto --baud 115200
```

网页中选择：

```text
连接方式 -> Orange Pi 本地桥
本地桥 WebSocket 地址 -> ws://127.0.0.1:8765/ws
点击连接
```

## GitHub Pages 与本地桥的关系

GitHub Pages 部署出来的网站依然是静态网页，适合普通电脑、手机浏览器或开发调试。

Orange Pi 手持设备建议把网站也放在本机运行，避免 HTTPS 页面连接本地 ws 时受到浏览器安全策略限制：

```bash
npm run build
npm run preview -- --host 127.0.0.1
```

然后打开：

```text
http://127.0.0.1:4173/bluetooth-tuning-web/
```

## Kiosk 全屏启动建议

可以用 `orangepi/run-kiosk.sh` 启动 Chromium 全屏模式。实际使用时建议配合 systemd：

```text
1. systemd 启动 serial_bridge.py
2. systemd 或桌面自启动打开 Chromium kiosk
3. 插上 USB-TTL 后进入 PID 调参页面
```

## 单片机端建议

网页调参会发送：

```text
[slider,target,目标速度]
[slider,Kp,Kp值]
[slider,Ki,Ki值]
[slider,Kd,Kd值]
[joystick,lx,ly,rx,ry]
[key,emergency,down]
```

单片机建议返回：

```c
printf("[plot,%d,%d,%d,%d]\r\n", current_speed, target_speed, pwm_output, error);
```

并在下位机端增加失联保护：

```text
300ms ~ 500ms 没收到控制包就自动停车或关闭输出。
```
