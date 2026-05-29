# 架构概览

## 技术栈

- Electron 42 + Node.js
- 纯 HTML/CSS/JS（无前端框架）
- OpenAI SDK v6（图像生成）

## 进程模型

```
┌───────────── Renderer (安全沙箱) ────────────────────────────┐
│  index.html → state.js + utils.js + params.js + ui.js       │
│           + providers.js + upload.js + lightbox.js           │
│           + conversations.js + chat-renderer.js              │
│           + settings.js + send.js + branches.js              │
│           + events.js (13 模块, 共 ~1985 行)                  │
│  styles.css (1054行)                                         │
│       │ window.electronAPI.xxx()                              │
│       ▼                                                       │
│  preload.js (contextBridge 桥接)                               │
└──────────────┬────────────────────────────────────────────────┘
               │ IPC (invoke/handle)
┌──────────────▼───── Main (Node.js 全权限) ─────┐
│  main.js (315行) 窗口/IPC/AbortController       │
│  src/main/                                     │
│   ├─ image-service.js   OpenAI API 封装          │
│   ├─ store.js           config.json              │
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
- `save()` 深拷贝去 `branch.loading` / `branch.params.n` 后写入
- `get()` 加载时清理 transient 字段

### src/renderer/ (13 模块，共 ~1985 行)

| 模块 | 职责 |
|------|------|
| `events.js` | 事件绑定、`init()` 初始化入口 |
| `state.js` | 全局状态对象、DOM 引用、常量 |
| `utils.js` | 工具函数、图片辅助、草稿管理、持久化、剪贴板 |
| `params.js` | 尺寸预设、参数计算、UI 同步、自定义尺寸校验与修正 |
| `ui.js` | Toast、Alert、Context Menu（保存/复制/发到新对话/删除） |
| `providers.js` | 提供方列表渲染 |
| `upload.js` | 图片上传、粘贴、拖拽 |
| `lightbox.js` | 灯箱、图片选择/保存/右键复制 |
| `conversations.js` | 对话 CRUD、切换、图片删除 |
| `chat-renderer.js` | 对话/消息/图片渲染 |
| `settings.js` | 设置模态框、提供方编辑器 |
| `send.js` | 发送/中止请求管理 |
| `branches.js` | 分支操作（重试/改写/删除/发到新对话） |

### src/renderer/styles.css
- 深色主题，~1050 行

## 关键路径

### 生成请求流程
```
用户输入 → handleSend()
  → setSending(true) → 按钮变 ■
  → 创建 branch（含 text/params/uploadedImages，改写路径不同）
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

## 核心工作流

### 文生图 / 编辑图

入口：`handleSend()`（send.js 模块）

```
1. 校验：provider → 空分支检查 → 确认框
2. 构建 uploadedInTurn：
   - 用户上传图 → 复制到 conv/uploaded/
   - 自动引用上一轮选中图 → { fromGenerated, sourceTurnIndex }
3. 创建 branch（含 text/params/uploadedImages）：
   ├─ 非改写: 创建新 turn + 首条 branch
   └─ 改写:   往现有 turn 追加新 branch（不覆盖原 branch 数据）
4. branch.loading = true → saveConv() + renderChat()
5. 确定 mainImagePath：
   - 优先：用户上传的第一张
   - 其次：上一轮选中图（getImageTempPath → temp file）
   - 无 → 调 generateImage
6. API 调用 → editImage / generateImage（含 AbortSignal）
7. 成功后 storeImageBatch() → branch.images = [{ fileName }]
8. saveConversation(conv) → 存盘
9. 用户未切走 → renderChat()；切走 → unread dot
```

### 重试

入口：`handleRetry()`（branches.js 模块）

```
1. 删除 branch.error（让 loading 显示）
2. setSending(true) → 按钮变 ■
3. branch.loading = true → renderChat（已有图片保留，loading 显示在下方）
4. resolveMainImage → 同 handleSend 逻辑，使用 branch 自身的 text/params
5. API 调用
6. 成功后新图片 unshift 到 branch.images 头部
   [旧1][旧2] → 重试 → [新1][新2][旧1][旧2]
7. 更新 branch.selectedImageIndex = 0
```

注意：重试中切走对话再回来后仍保持 loading 状态；请求完成且已切走时存盘 + 未读气泡。

### 改写

入口：`handleRewrite()`（branches.js 模块）

```
1. 读取当前 branch 的 text/params/uploadedImages 填入输入区
2. 进入 rewriteMode
3. 用户修改后发送 → handleSend 检测到 isRewrite
4. 在当前 turn 创建新 branch（含新 text/params/uploadedImages），不覆盖原 branch
```

### 分支切换

- 每个 turn 显示 `◀ X/Y ▶` 箭头
- 切换分支时渲染完整分支数据：提示词、参数、上传图、生成图
- 最近 turn 可选中图片（点击角标）

### 删除保护

入口：`handleDeleteBranch()` / `deleteImage()`

- **删除图片**：若该图片是选中图且被后轮引用（`fromGenerated`），则禁止删除
- **删除分支**：若非末轮且有后轮引用该轮，则禁止删除
- 右键菜单在不可删除时自动隐藏"删除"选项（双层保障：菜单侧 + 执行侧）

### 历史轮选中标记

- 历史轮选中勾由 `turn.selectedBranchIndex` 控制，仅当 **引用发生时的 activeBranchIndex** 匹配当前分支时才显示
- 缺失该字段视为 -1，历史轮无勾
- 末轮不受此限制，始终显示选中勾

### 发送到新对话

入口：`handleSendToNew()`（branches.js 模块）

```
1. 创建新对话
2. 收集：当前 branch 的 text + params + 上传图副本 + 前轮选中图
3. setDraft(newConvId, { text, uploadedImages, params })
4. switchConversation(newConvId) → loadDraft() 自动填入
```

### 对话切换与内存缓存

入口：`switchConversation()`（conversations.js 模块）

切换对话时：
1. 当前对话缓存到 `state._convCache[convId]`（含 `loading` 等瞬态字段）
2. 目标对话优先从缓存读取，缓存未命中则从磁盘加载
3. 磁盘加载的数据不包含 `loading`（`get()` 会剥除）

```
切换前 → saveDraft() → _convCache[oldId] = activeConv
     → activeConvId = newId
     → activeConv = _convCache[newId] || getConversation(newId)
     → renderChat()
```

缓存在以下情况清理：
- 对话被删除（`deleteConversation`）
- 应用重启（内存重置）

这样就避免 loading 等动态字段触碰到磁盘 IO。

### 请求独立管理

- `state.conversationStates[convId].sending` 独立管理
- 切换对话时：saveDraft + _convCache → loadDraft + 恢复按钮
- API 完成后：检查 `state.activeConvId === conv.id`
  - 用户未切走 → 正常渲染
  - 已切走 → IPC 保存 conv + convList 显示 unread dot

### 状态指示器

对话列表右侧（与删除键同一槽位，通过绝对定位叠放）显示：

| 状态 | 图标 | 条件 |
|------|------|------|
| 生成中 | 暗黄空心圆 | `conversationStates[convId].sending === true` |
| 成功 | 绿 ✓ | `unread[convId].type === "success"` |
| 失败 | 红 ✗ | `unread[convId].type === "error"` |

hover 时状态指示器隐藏（`opacity: 0` + `pointer-events: none`），删除键显示。
由于 sending 和 unread 不会同时为 true（生成结束后才设 unread），二者互斥。

切换对话时：
- sending 指示器 → 保留（缓存中有 loading 状态）
- unread dot → 清除 `state.unread[convId]` 并重渲染列表
