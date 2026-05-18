# 核心工作流

## 文生图 / 编辑图

入口：`handleSend()` (renderer.js:1070)

```
1. 校验：provider → 空分支检查 → 确认框
2. 创建 turn（首轮新 turn，改写模式复用现有）
3. 构建 uploadedInTurn：
   - 用户上传图 → 复制到 conv/uploaded/
   - 自动引用上一轮选中图 → { fromGenerated, sourceTurnIndex }
4. 创建 branch → branch.loading = true
5. saveConv() + renderChat() → loading spinner
6. 确定 mainImagePath：
   - 优先：用户上传的第一张
   - 其次：上一轮选中图（getImageTempPath → temp file）
   - 无 → 调 generateImage
7. API 调用 → editImage / generateImage（含 AbortSignal）
8. 成功后 storeImageBatch() → branch.images = [{ fileName }]
9. saveConversation(conv) → 存盘
10. 用户未切走 → renderChat()；切走 → unread dot
```

## 重试

入口：`handleRetry()` (renderer.js:607)

```
1. 删除 branch.error（让 loading 显示）
2. setSending(true) → 按钮变 ■
3. resolveMainImage → 同 handleSend 逻辑
4. API 调用
5. 成功后新图片 unshift 到 branch.images 头部
   [旧1][旧2] → 重试 → [新1][新2][旧1][旧2]
6. 更新 branch.selectedImageIndex = 0
```

## 改写

入口：`handleRewrite()` (renderer.js:707)

```
1. 当前 turn 的 text/params 填入输入框
2. 进入 rewriteMode
3. 用户修改后发送 → handleSend 检查 isRewrite
4. 在当前 turn 新增 branch，不创建新 turn
```

## 分支切换

- 每个 turn 显示 `◀ X/Y ▶` 箭头
- 最近 turn 可选中图片（点击角标）
- 历史 turn 只读浏览

## 删除分支

入口：`handleDeleteBranch()` (renderer.js:854)

```
1. splice(activeBranchIndex, 1)
2. 若 turn 还有分支 → activeBranchIndex = 第一个可用
3. 若全删完 → splice(turnIndex, 1) 删整轮
4. saveConv + renderChat
```

## 发送到新对话

入口：`handleSendToNew()` (renderer.js:877)

```
1. 创建新对话
2. 收集：当前 text + params + 上传图副本 + 前轮选中图
3. setDraft(newConvId, { text, uploadedImages, params })
4. switchConversation(newConvId) → loadDraft() 自动填入
```

## 请求中止

入口：`stopRequest()` (renderer.js:843)

```
1. setSending(false) → 按钮恢复 ➤
2. 遍历所有 turn → branch.loading = false
3. saveConv() + renderChat()
4. abortRequest() IPC（后台清理 AbortController）
5. IPC 返回 { aborted: true } → handler 删除空 loading branch
```

## 请求独立

- `state.conversationStates[convId].sending` 独立管理
- 切换对话时：saveDraft + loadDraft + 更新按钮状态
- API 完成后：检查 `state.activeConvId === conv.id`
  - 用户未切走 → 正常渲染
  - 已切走 → IPC 保存 conv + convList 显示 unread dot

## 未读气泡

- API 完成/失败时，若用户在其他对话 → `state.unread[convId] = { type }`
- 对话列表右侧显示绿✓ / 红✗
- 切换过去时立即清除
