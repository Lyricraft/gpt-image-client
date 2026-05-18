# GPT Image Client 实现文档

## 架构

Electron 桌面应用，基于 OpenAI GPT-Image-2 API，使用纯 HTML/CSS/JS 前端。

## 交互模型

### 对话流
- 纯文本输入 → 文生图（首轮）或编辑图片（续轮，自动引用上轮选中图）
- 传图+文本 → 编辑图片（上传的第一张为主图，其余参考）
- 续轮纯文本自动引用上轮选中图作为主图，上传的图片作为参考图

### 分支
- **改写**（✏️）：改变提示词/参数后发送 → 在当前 turn 新增分支
- **重试**（🔄）：不改变任何内容重新请求 → 新图片前置插入当前分支图片列表头部
- 分支导航：◀ X/Y ▶ 形式显示，左右箭头切换
- 最近 turn 的图片可点击选中（高亮边框+✓标记），下轮自动引用
- 历史 turn 只读浏览，可切分支但不能改选中

### 图片操作
- 左键：选中图片（最近 turn）
- 双击：放大查看（lightbox）
- 右键：弹出菜单 → 保存到本地 / 删除
- 删除选中图时自动切换到邻近图片
- 当前分支无图时，用户发请求弹窗提醒并拒绝

## 图片存储

```
run/conversations/{convId}/
├── index.json          # 对话数据 (不含 base64)
├── img_{sha256hash}.png  # 图片文件
├── img_{sha256hash}.png
└── ...
```

- 图片基于内容 SHA256 哈希命名，去重存储
- 对话 JSON 仅存储 `{ index, fileName }` 元数据
- 渲染时通过 `local-img://` 自定义协议加载

## 提供方

支持多个，存储在 `run/config.json`：
```
providers: [
  { id, name, baseURL, apiKey, isActive }
]
```

## IPC 通道

| 通道 | 方向 | 说明 |
|------|------|------|
| `image:generate` | → | 文生图 |
| `image:edit` | → | 编辑图片 |
| `image:store` | → | 保存单张图片到 conv 目录 |
| `image:store-batch` | → | 批量保存 |
| `image:delete-file` | → | 删除图片文件 |
| `image:resolve-path` | → | 获取图片绝对路径 |
| `image:load-base64` | → | 读取图片 base64 |
| `image:save-dialog` | → | 弹出保存对话框 |
| `file:save-temp` | → | 保存临时文件 |
| `dialog:selectImage` | → | 文件选择器 |
| `conv:*` | → | 对话 CRUD |
| `provider:*` | → | 提供方 CRUD |

## 参数

- 预设模式：比例（1:1, 3:2, 2:3, 16:9, 9:16）+ 分辨率（1K, 1.5K, 2K）
- 自定义模式：宽/高手动输入（256-4096，64 的倍数）
- 质量：low / medium / high / auto
- 格式：PNG / JPEG / WebP
- 数量：1-10

## 请求控制

- 请求中发送按钮变为红色 ■ 停止按钮
- 点击停止 → `abortRequest()` IPC → main process `AbortController.abort()`
- AbortError 被 `runWithAbort` 捕获，返回 `{ aborted: true }`
- 渲染层收到 aborted 响应 → 清理 loading 状态，恢复 UI
- 请求中锁定：禁止重试、禁止删除图片、禁止发送新请求
