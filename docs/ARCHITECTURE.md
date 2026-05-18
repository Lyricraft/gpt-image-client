# 架构概览

## 技术栈

- Electron 42 + Node.js
- 纯 HTML/CSS/JS（无前端框架）
- OpenAI SDK v6（图像生成）

## 进程模型

```
┌───────────── Renderer (安全沙箱) ─────────────┐
│  index.html  →  renderer.js (1878行)           │
│  styles.css (1054行)                           │
│       │ window.electronAPI.xxx()               │
│       ▼                                        │
│  preload.js (contextBridge 桥接)                │
└──────────────┬─────────────────────────────────┘
               │ IPC (invoke/handle)
┌──────────────▼───── Main (Node.js 全权限) ─────┐
│  main.js (315行) 窗口/IPC/AbortController       │
│  src/main/                                     │
│   ├─ image-service.js   OpenAI API 封装          │
│   ├─ store.js           .env + config.json      │
│   └─ conversation-store.js  对话文件 CRUD        │
└────────────────────────────────────────────────┘
```

## 文件职责

### main.js
- 窗口创建 (1280×860)
- 注册所有 IPC handlers
- AbortController 管理（请求中止）
- `local-img://` 自定义协议注册（图片服务）

### preload.js
- 通过 `contextBridge` 暴露 `window.electronAPI`
- 所有 IPC 通道的 type-safe 映射
- `webUtils.getPathForFile` 暴露（拖拽文件路径）

### src/main/image-service.js
- OpenAI 客户端管理（单例）
- `generateImage` / `editImage` / `createVariation`
- 支持 `AbortSignal`（通过 `requestOptions.signal`）
- 指数退避重试

### src/main/store.js
- 读写 `run/config.json`
- API Key / Base URL / 提供方 / 超时 等配置

### src/main/conversation-store.js
- 对话存为 `run/conversations/{id}.json`
- 索引 `run/conversations/index.json`
- `save()` 深拷贝去 `loading/n` 后写入
- `get()` 加载时清理旧数据残留

### src/renderer/renderer.js
- 全部 UI 逻辑（~1880 行）
- 状态管理、对话列表、消息渲染、输入控制、请求控制、设置

### src/renderer/styles.css
- 深色主题，~1050 行

## 关键路径

### 生成请求流程
```
用户输入 → handleSend()
  → setSending(true) → 按钮变 ■
  → 创建 turn + branch (loading=true)
  → saveConv() → renderChat()
  → resolveMainImage() → editImage or generateImage
  → storeImageBatch() → branch.images = [{fileName}]
  → saveConversation(conv) → 存盘
  → 若用户未切走: renderChat()
  → 若已切走: unread dot
  → setSending(false)
```

### 中止流程
```
用户点 ■ → stopRequest()
  → setSending(false) → 恢复按钮
  → 清除所有 loading
  → abortRequest() IPC → main 侧 AbortController.abort()
  → OpenAI SDK 抛出 AbortError
  → runWithAbort 返回 { aborted: true }
  → handleSend 收到 → 删空 loading branch
```
