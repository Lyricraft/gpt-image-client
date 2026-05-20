# 数据模型

## 运行时状态 (renderer.js)

```js
state = {
  conversations: [],            // 对话索引列表 [{ id, title, createdAt, updatedAt }]
  activeConvId: null,           // 当前对话 ID
  activeConv: null,             // 当前完整对话对象
  providers: [],                // [{ id, name, baseURL, apiKey, isActive }]
  params: {                     // 当前生成参数
    sizeMode: 'preset'|'custom',
    ratio: '1:1', resolution: '1k',
    customWidth: 1024, customHeight: 1024,
    quality: 'medium', output_format: 'png', n: 1,
  },
  rewriteMode: false,
  rewriteTurnIndex: -1,
  uploadedImages: [],           // [{ id, path }] — 输入框中待发送的图片
  sending: false,               // 已废弃，改用 conversationStates
  conversationStates: {},       // { [convId]: { sending: bool } }
  drafts: {},                   // { [convId]: { text, uploadedImages, params } }
  unread: {},                   // { [convId]: { type: 'success'|'error' } }
}
```

## 对话数据结构 (持久化 JSON)

```js
// run/conversations/{id}.json
// 注意: text/params/uploadedImages 在 branch 级别，不在 turn 级别
{
  id: "uuid",
  title: "新对话",
  createdAt: 1234567890,
  updatedAt: 1234567890,
  turns: [
    {
      id: "t_xxx",
      branches: [
        {
          id: "b_xxx",
          text: "一只橘猫",            // 提示词（branch 级别）
          params: {                   // 生成参数（branch 级别）
            size: "1024x1024",
            quality: "high",
            output_format: "png",
          },                          // branch.params.n 存盘时被剥离
          uploadedImages: [           // 上传的参考图（branch 级别）
            // 自动引用的上一轮选中图
            { id: "prev", path: null, isMain: true, fromGenerated: true, sourceTurnIndex: 0 },
            // 用户手动上传的图片（复制到 conv 目录后的路径）
            { id: "xxx",  path: "E:/.../uploaded/xxx.png", isMain: false },
          ],
          images: [                   // 生成的结果图片
            {
              index: 0,
              id: "img_xxx",
              fileName: "img_sha256hash.png",  // 无 b64_json，文件存 conv 目录
              isSelected: true,
            },
          ],
          selectedImageIndex: 0,
          error: null,    // 错误信息（非持久化，加载时清理）
          loading: false, // 存盘时剥离
        },
      ],
      activeBranchIndex: 0,
    },
  ],
}
```

## 持久化规则

| 数据 | 路径 | 读写时机 |
|------|------|---------|
| 对话内容 | `run/conversations/{id}.json` | 每次生成/编辑/删除后 |
| 对话索引 | `run/conversations/index.json` | 增删对话时 |
| 生成图片 | `run/conversations/{id}/img_{sha256}.png` | 生成后写入，内容哈希去重 |
| 上传副本 | `run/conversations/{id}/uploaded/{ts}.png` | 发送时从原始路径复制 |
| 临时文件 | `run/tmp/{ts}.png` | edit 操作中转 |
| 用户配置 | `run/config.json` | 保存设置时 |
| 环境变量 | `run/.env` | 启动时读取 |

## 存盘清理

`conversation-store.js` 的 `save()` 和 `get()` 自动清理：
- `branch.loading` — 删除（transient UI state）
- `branch.params.n` — 删除（历史不记录 n）
- `branch.error` — 不清理（保留错误信息供重试）
