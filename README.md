# Bluetooth Tuning Web

一个面向嵌入式调试、小车联调、PID 参数整定和蓝牙/串口通信测试的网页上位机。项目基于 **React + Vite** 开发，可部署到 **GitHub Pages**，也可以运行在 **Orange Pi 4 Pro** 上，配合触摸屏做成便携式手持 PID 调参终端。

在线访问：

```text
https://greyd0ve.github.io/bluetooth-tuning-web/
```

---

## 项目定位

本项目不是普通串口助手，而是面向控制类项目的调试工作台。它适合用于：

- 小车速度环、位置环 PID 调参
- 电机、舵机、云台、编码器等嵌入式设备联调
- BLE 蓝牙串口模块调试
- USB-TTL / CH340 / CP2102 / STM32 虚拟串口调试
- Orange Pi 4 Pro 触摸屏手持调参终端
- 实时曲线观察、参数组保存、调试日志查看

---

## 主要功能

### 桌面端三栏工作台

默认进入“工作台”视图，首屏同时显示：

- 顶部连接状态栏
- 左侧连接、桥接、预设和协议提示
- 中央实时曲线主区
- 右侧 PID 参数工作台
- 底部结构化调试日志

适合桌面端和 Orange Pi 外接屏幕调试使用。

### 多种连接方式

支持以下通信方式：

- **BLE 蓝牙串口**
- **Web Serial / USB-TTL**
- **Orange Pi 本地桥**
- **环回测试模式**

其中 Orange Pi 本地桥通过 WebSocket 连接本机 Python 后端，再由 Python 打开串口或蓝牙设备，适合在 Falkon、非 Chromium 浏览器或 Kiosk 环境中使用。

### PID 参数调节

支持常用 PID 参数：

- 目标速度 `target`
- 比例系数 `Kp`
- 积分系数 `Ki`
- 微分系数 `Kd`
- 左轮补偿 `leftBias`
- 右轮补偿 `rightBias`

支持单项发送、分组发送、一键发送全部 PID、参数组保存与载入，以及参数修改后的“未发送”状态提示。

当前电脑端工作台会区分“编辑值”和“上次发送值”。修改参数后只标记为未发送，拖动滑杆不会自动连续下发；点击单项发送、发送改动或发送全部后，发送成功才会变为已同步。每个参数都会显示编辑值、已发值和差值，并支持撤销到上次发送值。

### 实时曲线绘图

支持接收下位机发送的：

```text
[plot,数值1,数值2,数值3,...]
```

并实时绘制曲线。支持：

- 单图 / 分图显示
- 曲线暂停 / 继续
- 清空曲线
- 自动 Y 轴 / 固定 Y 轴
- 曲线名称自定义
- 通道显示 / 隐藏
- 最新值、最大值、最小值、平均值统计
- CSV 导出

默认通道名称为：

```text
CH1 target
CH2 current
CH3 error
CH4 pwm
```

通道名称、显示/隐藏、最大保留点数、自动/固定 Y 轴都可以在工作台中调整。非法 `[plot,...]` 数据包不会导致页面崩溃，会进入 ERROR 日志并累计异常包数量。

### 调试日志

底部日志区按类型区分：

- `TX`：网页发送到设备的数据
- `RX`：设备或桥接服务返回的数据
- `ERROR`：发送失败、解析失败、非法数据包
- `SYSTEM`：连接、断开、导入导出、记录保存等状态变化
- `WARN`：浏览器不支持、未连接发送、缓存溢出等警告

日志支持清空、复制、按类型过滤和暂停自动滚动。日志和曲线数据都有数量限制，适合长时间观察 PID 曲线。

### 推荐环境与排查

- 推荐浏览器：桌面版 Chrome / Edge。Web Serial 和 Web Bluetooth 需要 Chromium 系浏览器支持。
- 推荐分辨率：1920×1080、1600×900、1366×768。
- GitHub Pages：保持静态前端部署即可，不需要后端；部署后 Web Serial / Web Bluetooth 仍受浏览器安全策略影响。
- Orange Pi Bridge：先启动 `orangepi/serial_bridge.py`，再在页面选择 Orange Pi Bridge，并确认地址类似 `ws://127.0.0.1:8765/ws`。
- Loopback：仅用于页面模拟测试，不代表真实硬件已连接。
- 常见问题：没有串口弹窗时检查浏览器兼容性和 HTTPS/localhost 环境；Bridge 连接失败时检查 Python 服务、串口权限和 WebSocket 地址。

### 工具页功能

工具页保留完整高级功能：

- 完整串口收发
- 曲线完整版
- 显示屏协议测试
- 自定义按键
- 自定义滑杆
- 记录回放
- 外观说明

### 自定义按键数据包

在 **工具 → 按键** 中，每个按键都可以配置自定义数据包。

例如填写：

```text
[pid,start]
```

点击该按键后会直接发送：

```text
[pid,start]
```

如果自定义数据包为空，则保留原来的默认按键协议：

```text
[key,按键名称,down]
[key,按键名称,up]
```

---

## 通信协议

项目默认使用文本方括号协议：

```text
[命令,参数1,参数2,...]
```

常用数据包示例：

```text
[slider,Kp,1.20]
[slider,Ki,0.03]
[slider,Kd,0.15]
[slider,target,100]
[joystick,0,100,0,0]
[key,emergency,down]
[plot,100,95,5,230]
[display,10,20,Hello,26]
[plot-clear]
[display-clear]
```

建议单片机端通过 `[` 和 `]` 识别完整包，再用 `,` 分割字段，可使用 `strtok`、`strcmp`、`atoi`、`atof` 等函数解析。

下位机返回曲线数据示例：

```c
printf("[plot,%d,%d,%d,%d]\r\n", target_speed, current_speed, error, pwm_output);
```

---

## 推荐下位机协议设计

PID 调参建议使用如下命令：

```text
[pid,set,kp,1.20]
[pid,set,ki,0.03]
[pid,set,kd,0.15]
[pid,set,target,100]
[pid,start]
[pid,stop]
[pid,get]
```

下位机可以返回：

```text
[pid,val,kp,1.20,ki,0.03,kd,0.15,target,100]
[status,ok]
[plot,100,95,5,230]
```

---

## 本地开发

### 环境要求

- Node.js
- npm
- Chrome / Edge / Chromium 系浏览器

### 安装依赖

```bash
npm install
```

### 启动开发服务器

```bash
npm run dev
```

浏览器打开：

```text
http://localhost:5173/
```

### 局域网调试

```bash
npm run dev:lan
```

### 构建静态网站

```bash
npm run build
```

构建结果在：

```text
dist/
```

### 本地预览构建结果

```bash
npm run preview
```

---

## GitHub Pages 部署

项目已经适配 GitHub Pages。常规流程：

```bash
git add .
git commit -m "update"
git push
```

然后在 GitHub 仓库中检查：

```text
Actions
Settings -> Pages
```

如果使用 GitHub Actions 自动部署，请确保 Pages 来源设置正确。

---

## Windows 上传 Orange Pi 离线部署包

如果 Orange Pi 无法访问 GitHub，可以在 Windows 上构建后传输到 Orange Pi。

### Windows 构建

```powershell
npm install
npm run build -- --base=./
Compress-Archive -Path .\dist\* -DestinationPath .\dist-orange-pi.zip -Force
scp .\dist-orange-pi.zip orangepi@你的OrangePi_IP:/home/orangepi/
```

### Orange Pi 解压

```bash
mkdir -p ~/pid-web
rm -rf ~/pid-web/*
unzip -o ~/dist-orange-pi.zip -d ~/pid-web
```

如果没有 `unzip`：

```bash
python3 -m zipfile -e ~/dist-orange-pi.zip ~/pid-web
```

---

## Orange Pi 本地网页服务

创建 systemd 服务：

```bash
sudo tee /etc/systemd/system/pid-web.service > /dev/null <<'EOF'
[Unit]
Description=PID tuning web static server
After=network.target

[Service]
Type=simple
User=orangepi
WorkingDirectory=/home/orangepi/pid-web
ExecStart=/usr/bin/python3 -m http.server 8080 --bind 127.0.0.1
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF
```

启用：

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pid-web.service
```

检查：

```bash
sudo systemctl status pid-web.service --no-pager
curl -I http://127.0.0.1:8080
```

浏览器打开：

```text
http://127.0.0.1:8080
```

---

## Orange Pi 开机自动打开调参界面

创建启动脚本：

```bash
mkdir -p ~/bin
tee ~/bin/start-pid-kiosk.sh > /dev/null <<'EOF'
#!/bin/bash

export DISPLAY=:0
export XAUTHORITY=/home/orangepi/.Xauthority

URL="http://127.0.0.1:8080"

sleep 8

for i in $(seq 1 30); do
    if curl -s "$URL" > /dev/null; then
        break
    fi
    sleep 1
done

pkill -f "falkon" || true
falkon "$URL" &

sleep 6

xdotool search --onlyvisible --class falkon windowactivate key F11 || true
EOF
chmod +x ~/bin/start-pid-kiosk.sh
```

创建 XFCE 自启动项：

```bash
mkdir -p ~/.config/autostart
tee ~/.config/autostart/pid-web-kiosk.desktop > /dev/null <<'EOF'
[Desktop Entry]
Type=Application
Name=PID Web Kiosk
Comment=Open PID tuning web page on startup
Exec=/home/orangepi/bin/start-pid-kiosk.sh
Terminal=false
X-GNOME-Autostart-enabled=true
EOF
```

重启后即可自动进入全屏调参界面。

---

## Orange Pi 本地串口桥

如果浏览器不支持 Web Serial，推荐使用本地桥：

```text
网页
  ↓ WebSocket
Python 串口桥
  ↓ pyserial
USB-TTL / 单片机
```

安装依赖：

```bash
sudo apt install python3-serial python3-websockets -y
sudo usermod -aG dialout $USER
```

启动串口桥：

```bash
python3 orangepi/serial_bridge.py --port auto --baud 115200
```

网页中选择：

```text
连接方式：Orange Pi 本地桥
WebSocket：ws://127.0.0.1:8765/ws
```

---

## BLE 蓝牙模块说明

如果使用 BLE 蓝牙串口模块，推荐架构是：

```text
Falkon / 浏览器网页
  ↓ WebSocket
Orange Pi Python BLE 桥
  ↓ BlueZ / bleak
BLE 蓝牙串口模块
  ↓ UART
单片机
```

这样不依赖浏览器 Web Bluetooth，适合 Orange Pi 手持终端。

注意：不同 BLE 模块的 Service UUID / Characteristic UUID 可能不同，需要根据模块实际信息配置。

常见 BLE UART UUID：

```text
Nordic UART Service:
write:  6e400002-b5a3-f393-e0a9-e50e24dcca9e
notify: 6e400003-b5a3-f393-e0a9-e50e24dcca9e

FFE0 / FFE1:
write/notify: 0000ffe1-0000-1000-8000-00805f9b34fb
```

---

## 项目结构

```text
.
├── index.html
├── package.json
├── vite.config.js
├── start.bat
├── src/
│   ├── main.jsx
│   ├── styles.css
│   └── utils/
│       ├── protocol.js
│       ├── csv.js
│       └── storage.js
├── public/
│   └── .nojekyll
└── orangepi/
    ├── serial_bridge.py
    ├── requirements.txt
    └── run-kiosk.sh
```

---

## 不建议提交的文件

建议 `.gitignore` 中包含：

```gitignore
node_modules/
dist/
.DS_Store
*.log
.env
.env.local
```

如果已经误提交过，可以执行：

```bash
git rm -r --cached node_modules
git rm -r --cached dist
git add .gitignore
git commit -m "remove generated files"
```

---

## 常用快捷键

| 快捷键 | 功能 |
|---|---|
| 空格 | 急停 |
| W / A / S / D | 摇杆控制 |
| P | 暂停 / 继续绘图 |
| R | 清空曲线 |
| F | 浏览器全屏 |
| C | 连接 / 断开 |

---

## 安全建议

调试小车、电机、云台等设备时建议：

- 保留物理急停开关
- 下位机端加入通信超时保护
- 参数范围做限幅
- 第一次调参时架空轮子或断开负载
- 不要让电机控制完全依赖网页端安全逻辑

推荐下位机策略：

```text
300 ms ~ 500 ms 未收到控制包，自动停车或关闭输出。
```

---

## 当前版本重点

当前版本包含：

- 桌面三栏工作台
- Orange Pi 本地部署支持
- Falkon 全屏 Kiosk 使用方式
- Web Serial / BLE / 本地桥连接方式
- PID 未发送状态提示
- 曲线名称编辑优化
- 自定义按键数据包发送

---

## License

本项目当前未指定开源许可证。如需公开开源，建议后续补充 `LICENSE` 文件，例如 MIT License。
