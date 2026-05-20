# GPT Image — Agent 引导

## 项目概览

Electron 桌面应用，基于 OpenAI GPT-Image-2 API 的图像生成客户端。

- 主语言：JavaScript (CommonJS)
- 框架：Electron 42 + 纯前端（无 React/Vue）
- 图像 API：OpenAI SDK v6（`openai` npm 包）
- 运行目录：`run/`（gitignored）

## 读文档顺序

1. **架构总览（含核心工作流）** → `docs/ARCHITECTURE.md`
2. **数据模型** → `docs/DATA-MODEL.md`
3. **IPC 通道** → `docs/IPC.md`
4. **传承计划** → `docs/SUCCESSION.md`
5. **GPT-Image-2 API** → `docs/gpt-image-2-api.md`

## 快速命令

```bash
npm start          # 启动应用
```

## 关键文件

| 文件 | 行数 | 说明 |
|------|------|------|
| `src/renderer/events.js` | ~285 | 事件绑定+初始化（入口） |
| `src/renderer/state.js` | ~90 | 全局状态、DOM 引用、常量 |
| `src/renderer/utils.js` | ~145 | 工具函数、草稿管理、持久化 |
| `src/renderer/chat-renderer.js` | ~195 | 对话渲染引擎 |
| `src/renderer/send.js` | ~235 | 发送/中止请求管理 |
| `src/renderer/branches.js` | ~230 | 分支操作（重试/改写/删除） |
| `src/renderer/conversations.js` | ~185 | 对话 CRUD、切换、图片删除 |
| `src/renderer/settings.js` | ~165 | 设置模态框、提供方编辑器 |
| `src/renderer/lightbox.js` | ~130 | 灯箱、图片选择/保存 |
| `src/renderer/ui.js` | ~135 | Toast、Alert、Context Menu |
| `src/renderer/params.js` | ~95 | 尺寸预设、参数 UI 同步 |
| `src/renderer/providers.js` | ~35 | 提供方列表渲染 |
| `src/renderer/upload.js` | ~55 | 图片上传、粘贴、拖拽 |
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
