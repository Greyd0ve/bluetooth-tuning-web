# 网页蓝牙 / 串口远程调参助手 v9

这是一个面向小车、嵌入式设备和 BLE 串口模块的网页上位机。项目基于 Vite + React，可部署到 GitHub Pages，也可以在本机一键启动。网页端协议保持兼容，不改变单片机端已有解析逻辑。

## 固定协议格式

本版本没有修改协议，仍然使用文本方括号数据包：

```text
[key,按键名称,down]
[key,按键名称,up]
[slider,滑杆名称,滑杆值]
[joystick,左X,左Y,右X,右Y]
[plot,数值1,数值2,数值3,...]
[plot-clear]
[display,X坐标,Y坐标,显示内容,字号]
[display-clear]
```

单片机端可以继续使用原来的 `strtok`、`strcmp`、`atoi`、`atof` 等方式解析。

---

## v9 新增优化内容

### 1. 蓝牙连接稳定性优化

- BLE 连接成功后显示设备名、连接方式和连接时长。
- 显示当前连接状态，断开后会提示原因。
- 支持断线后自动尝试重连。
- 保留常见 BLE UART UUID 预设：Nordic UART、FFE0/FFE1、自定义 UUID。

### 2. 小车安全控制优化

- 页面右上角固定显示“急停 SPACE”按钮。
- 急停会发送：

```text
[key,emergency,down]
[joystick,0,0,0,0]
```

- 页面隐藏、刷新、关闭、主动断开连接时，会尽量发送 `[joystick,0,0,0,0]`。
- 摇杆释放后自动回中。

### 3. PID 调参面板升级

- 支持 Kp、Ki、Kd、目标速度、左右轮补偿。
- 支持小步进 / 大步进微调。
- 支持一键发送全部参数，仍然用原协议发送：

```text
[slider,target,目标速度]
[slider,Kp,Kp值]
[slider,Ki,Ki值]
[slider,Kd,Kd值]
[slider,leftBias,左补偿]
[slider,rightBias,右补偿]
```

- 支持保存多组 PID 参数并快速载入。

### 4. 绘图分图模式

绘图界面支持两种显示方式：

- 单图模式：所有曲线显示在同一个图表里。
- 分图模式：每条曲线单独一个图表，适合速度、PWM、误差范围差距较大的场景。

保留原有功能：

- 曲线名称自定义。
- 曲线显示 / 隐藏。
- Y 轴自动范围 / 固定范围。
- X 轴真实时间。
- 最新值、最大值、最小值、平均值。
- CSV 导出。
- 速度闭环模板。

### 5. 数据记录和回放

新增“记录回放”页面：

- 开始记录：保存当前收到的 `[plot,...]` 数据。
- 停止并保存：把本次调试曲线保存到浏览器本地。
- 回放：把历史记录重新加载到绘图界面。
- 导出：把某条历史记录导出成 CSV。

这适合对比不同 PID 参数下的小车响应。

### 6. 配置导入 / 导出

新增“配置”页面：

- 导出配置 JSON。
- 导入配置 JSON。
- 恢复默认配置。

配置内容包含：

- 蓝牙 UUID。
- 主题颜色。
- 摇杆参数。
- 按键 / 滑杆设置。
- PID 参数组。
- 曲线名称和显示状态。

适合换电脑、换浏览器或队友共用。

### 7. 键盘快捷键

| 快捷键 | 功能 |
|---|---|
| 空格 | 急停 |
| W / A / S / D | 控制左摇杆 |
| P | 暂停 / 继续绘图 |
| R | 清空绘图 |
| F | 浏览器全屏 |
| C | 连接 / 断开 |

### 8. 全屏驾驶模式

新增“全屏驾驶”页面：

- 大摇杆。
- 固定急停。
- 连接状态。
- 小车速度曲线。
- 适合比赛调车、遥控测试时使用。

### 9. Web Serial 模式

除 BLE 蓝牙外，新增 Web Serial 连接方式，可用于：

- USB-TTL。
- CH340。
- CP2102。
- STM32 虚拟串口。
- 其他浏览器支持的串口设备。

Web Serial 模式不改变协议，只是把数据从蓝牙发送改成串口发送。

### 10. 代码结构优化

本版本将常用工具函数拆分到 `src/utils`：

```text
src/utils/protocol.js   协议、HEX、编码、UUID 工具
src/utils/csv.js        CSV 和文件下载工具
src/utils/storage.js    本地配置存储工具
src/main.jsx            主界面和业务逻辑
src/styles.css          样式文件
```

后续可以继续拆分为更细的组件，例如 `PlotPanel.jsx`、`JoystickPanel.jsx`、`BluetoothPanel.jsx`。

---

## 本地运行

第一次运行需要安装依赖：

```powershell
npm install
```

启动本机网站：

```powershell
npm run dev
```

浏览器打开：

```text
http://localhost:5173/
```

推荐使用桌面版 Chrome 或 Edge。

---

## 一键启动

Windows 下可以双击：

```text
start.bat
```

脚本会自动检查依赖并启动本地网站。

---

## 构建静态网站

```powershell
npm run build
```

构建结果会生成在：

```text
dist
```

---

## GitHub Pages 部署

本项目已经包含 GitHub Actions 配置：

```text
.github/workflows/deploy.yml
```

上传到 GitHub 后，在仓库中开启：

```text
Settings -> Pages -> Source -> GitHub Actions
```

以后每次执行：

```powershell
git add .
git commit -m "update website"
git push
```

GitHub 会自动构建并发布到固定 HTTPS 网站。

---

## 浏览器权限说明

- Web Bluetooth 需要 HTTPS 或 `localhost` 环境。
- GitHub Pages 是 HTTPS，可以正常使用 Web Bluetooth。
- Web Serial 也需要浏览器授权，推荐 Chrome / Edge。
- 云端网站不会帮你连接蓝牙，蓝牙和串口连接使用的是当前打开网页这台电脑的硬件。

---

## 单片机端示例

速度闭环调试时，单片机可以发送：

```c
printf("[plot,%d,%d,%d,%d]\\r\\n", current_speed, target_speed, pwm_output, error);
```

网页端速度闭环模板会把曲线命名为：

```text
CH1 = 当前速度
CH2 = 目标速度
CH3 = PWM输出
CH4 = 速度误差
```

---

## 建议的安全策略

网页端已经会尽量发送停车命令，但实际小车仍建议在单片机端增加超时保护：

```text
如果 300ms ~ 500ms 没收到新的摇杆或控制数据，就自动停车。
```

这样即使蓝牙断开、浏览器卡死或电脑死机，小车也不会一直保持最后一次速度。
