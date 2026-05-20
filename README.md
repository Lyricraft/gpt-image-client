# GPT-Image

基于 OpenAI GPT-Image-2 API 的 Electron 桌面图像客户端，支持多 API 提供方，多轮对话式图像生成与编辑。

> 本项目的代码 99% 以上由 AI 生成，特别感谢 **DeepSeek** 的大力支持。

## 功能

- **文生图** — 文本提示词驱动，调用 GPT-Image-2 模型生成图像
- **图像编辑** — 上传参考图 + 提示词，AI 编辑/修改图像
- **多轮对话** — 自动引用上一轮图片，形成连续编辑工作流
- **对话分支** — 支持改写（修改提示词）、重试（重新生成），分支间自由切换
- **多 Provider** — 支持多个 OpenAI 兼容 API 提供方，界面一键切换

## 使用

```bash
# 1. 初始化运行目录（首次使用）
cp -r run-example run

# 2. 编辑 run/.env，填入 API Key

# 3. 启动
npm start
```

`run/` 目录已在 `.gitignore` 中，配置不会误提交。

## 架构

```
Renderer (沙箱)
  index.html → renderer.js → styles.css
       |
       | contextBridge IPC
       v
Main Process
  main.js → image-service.js → OpenAI SDK
          → store.js  ──→ run/config.json
          → conversation-store.js ──→ run/conversations/
```

## 数据

所有数据存储在 `run/` 目录：

- `run/config.json` — API 提供方配置
- `run/conversations/` — 对话数据与图片文件
