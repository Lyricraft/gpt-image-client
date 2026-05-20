# GPT Image — Agent 引导

## 项目概览

Electron 桌面应用，基于 OpenAI GPT-Image-2 API 的图像生成客户端。

- 主语言：JavaScript (CommonJS)
- 框架：Electron 42 + 纯前端（无 React/Vue）
- 图像 API：OpenAI SDK v6（`openai` npm 包）
- 运行目录：`run/`（gitignored）

## 读文档顺序

1. **架构总览** → `docs/ARCHITECTURE.md`
2. **数据模型** → `docs/DATA-MODEL.md`
3. **IPC 通道** → `docs/IPC.md`
4. **核心工作流** → `docs/WORKFLOWS.md`
5. **传承计划** → `docs/SUCCESSION.md`
6. **GPT-Image-2 API** → `docs/gpt-image-2-api.md`

## 快速命令

```bash
npm start          # 启动应用
```

## 关键文件

| 文件 | 行数 | 说明 |
|------|------|------|
| `src/renderer/renderer.js` | ~1880 | 全部 UI 逻辑（最大文件） |
| `main.js` | ~315 | 主进程（窗口+IPC+协议） |
| `src/renderer/styles.css` | ~1050 | 深色主题样式 |
| `src/main/image-service.js` | ~128 | OpenAI API 封装 |
| `src/main/conversation-store.js` | ~130 | 对话持久化 |
| `preload.js` | ~56 | contextBridge 桥接 |
| `src/renderer/index.html` | ~209 | UI 框架 |

## 运行说明

1. 确保 API Key 有效
2. `npm start` 启动
3. 首次使用需在设置中添加 API 提供方
