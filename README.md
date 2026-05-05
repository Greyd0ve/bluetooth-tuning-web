# 网页蓝牙远程调参助手 v4

## 启动

```bash
npm install
npm run dev
```

浏览器打开：

```text
http://localhost:5173/
```

## v4 更新

1. 自动保存配置：UUID、预设、发送间隔、短格式、按键、滑杆、摇杆配置、小车面板配置、曲线名称与显示/隐藏都会保存到浏览器 localStorage。
2. 绘图曲线名称 + 显示/隐藏：每个 CH 通道都可以自定义名称，并单独开关显示。
3. 摇杆死区 + 最大值 + 反向：支持死区、横向/纵向最大值、步距、横向/纵向反向、方形/圆形摇杆。
4. 小车专用联调面板：包含启动、停止、急停、目标速度、Kp、Ki、Kd、左右轮补偿，并与绘图和摇杆同屏显示。
5. CSV 数据导出：绘图数据可以导出为 CSV，便于用 Excel / Python 继续分析。
6. 环回测试模式：不连接蓝牙也可以测试发送、接收、绘图和显示屏解析。

## 单片机建议协议

网页发送：

```text
[joystick,lx,ly,rx,ry]
[slider,target,100]
[slider,Kp,120]
[key,start,down]
[key,stop,down]
[key,emergency,down]
```

单片机回传绘图：

```c
printf("[plot,%d,%d,%d]\\r\\n", current_speed, target_speed, pwm_output);
```
