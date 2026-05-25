# v12 曲线名称编辑优化

本版本只调整曲线页的通道名称编辑区域，不改 BLE / Web Serial / Orange Pi 本地桥等通信逻辑。

## 优化内容

- 将原来的单行紧凑布局改为卡片式布局，避免曲线名称输入框被压缩。
- 曲线名称输入框加大到触摸屏更容易点击和编辑的尺寸。
- 点击输入框时会自动选中原名称，方便直接覆盖输入。
- 每个通道增加“恢复”按钮，可恢复默认名称。
- “显示”开关和“最新值”区域重新排版，避免和名称输入框挤在一起。
- 小屏幕下通道编辑卡片会自动单列显示，适合 Orange Pi 触摸屏。

## 使用方式

上传 GitHub 后由 GitHub Actions 正常构建；本地 Orange Pi 部署仍然可以在 Windows 上执行：

```powershell
npm run build -- --base=./
Compress-Archive -Path .\dist\* -DestinationPath .\dist-orange-pi.zip -Force
scp .\dist-orange-pi.zip orangepi@<OrangePi-IP>:/home/orangepi/
```

Orange Pi 上解压到 `/home/orangepi/pid-web` 后，已有的 `pid-web.service` 会继续使用新页面。
