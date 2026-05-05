# 部署到 GitHub Pages

这个版本已经加入：

- `vite.config.js`：自动适配 GitHub Pages 的仓库路径。
- `.github/workflows/deploy.yml`：推送到 `main` 分支后自动构建并发布到 GitHub Pages。
- `public/.nojekyll`：避免 GitHub Pages 对静态文件做 Jekyll 处理。

## 本地测试

```bash
npm install
npm run dev
```

浏览器打开：

```text
http://localhost:5173/
```

构建测试：

```bash
npm run build
npm run preview
```

## GitHub Pages 设置

1. 在 GitHub 创建一个新仓库，例如 `bluetooth-tuning-web`。
2. 把本项目所有文件上传到仓库。
3. 进入仓库 `Settings` -> `Pages`。
4. 在 `Build and deployment` -> `Source` 中选择 `GitHub Actions`。
5. 回到仓库首页，等待 `Actions` 里的部署任务变绿。
6. 部署成功后访问：

```text
https://你的GitHub用户名.github.io/仓库名/
```

例如：

```text
https://Greyd0ve.github.io/bluetooth-tuning-web/
```

## 注意

Web Bluetooth 需要 Chrome 或 Edge，并且页面需要在 `https://` 或 `localhost` 下打开。GitHub Pages 提供的是 HTTPS 地址，可以用于网页蓝牙。
