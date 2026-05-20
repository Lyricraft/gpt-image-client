# 核心工作流

## 文生图 / 编辑图

入口：`handleSend()` (renderer.js:1090)

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

## 重试

入口：`handleRetry()` (renderer.js:651)

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

## 改写

入口：`handleRewrite()` (renderer.js:761)

```
1. 读取当前 branch 的 text/params/uploadedImages 填入输入区
2. 进入 rewriteMode
3. 用户修改后发送 → handleSend 检测到 isRewrite
4. 在当前 turn 创建新 branch（含新 text/params/uploadedImages），不覆盖原 branch
```

## 分支切换

- 每个 turn 显示 `◀ X/Y ▶` 箭头
- 切换分支时渲染完整分支数据：提示词、参数、上传图、生成图
- 最近 turn 可选中图片（点击角标）

## 删除保护

入口：`handleDeleteBranch()` / `deleteImage()`

- **删除图片**：若该图片是选中图且被后轮引用（`fromGenerated`），则禁止删除
- **删除分支**：若非末轮且有后轮引用该轮，则禁止删除
- 右键菜单在不可删除时自动隐藏"删除本分支"选项

## 发送到新对话

入口：`handleSendToNew()` (renderer.js:950)

```
1. 创建新对话
2. 收集：当前 branch 的 text + params + 上传图副本 + 前轮选中图
3. setDraft(newConvId, { text, uploadedImages, params })
4. switchConversation(newConvId) → loadDraft() 自动填入
```

## 请求中止

入口：`stopRequest()` (renderer.js:1060)

```
1. setSending(false) → 按钮恢复 ➤
2. 遍历所有 turn → branch.loading = false
3. saveConv() + renderChat()
4. abortRequest() IPC（后台清理 AbortController）
5. IPC 返回 { aborted: true } → handler 删除空 loading branch
```

## 请求独立管理

- `state.conversationStates[convId].sending` 独立管理
- 切换对话时：saveDraft + loadDraft + 更新按钮状态
- API 完成后：检查 `state.activeConvId === conv.id`
  - 用户未切走 → 正常渲染
  - 已切走 → IPC 保存 conv + convList 显示 unread dot

## 未读气泡

- API 完成/失败时，若用户在其他对话 → `state.unread[convId] = { type }`
- 对话列表右侧显示绿✓ / 红✗
- 切换过去时立即清除
