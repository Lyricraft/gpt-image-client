# 传承计划（Context Succession）

## 动机

在用户要求启动传承计划时，说明上下文已经极长，需要更换 agent 对话窗口从头开始，为了保存、提炼相关信息，实施此计划。
传承计划让新 agent 能快速接手，无需从零理解。

## 实施方法

### 1. 文档化

每次传承前，更新以下文档：

| 文档 | 内容 | 受众 |
|------|------|------|
| `AGENTS.md` | 入口引导，告诉新 agent 读哪些文档 | 新 agent |
| `docs/ARCHITECTURE.md` | 整体架构 + 核心工作流（发送/重试/改写/删除/中止） | 开发者 |
| `docs/DATA-MODEL.md` | 数据结构、持久化规则 | 开发者 |
| `docs/IPC.md` | IPC 通道参考 | 开发者 |
| `docs/SUCCESSION.md` | 传承计划本身的方法论 | 维护者 |

### 2. 文档原则

- **准确**：反映当前实现，非理想设计
- **具体**：函数名、模块名、文件大小（如 events.js ~285 行）
- **完整**：覆盖所有 IPC、所有状态、所有关键路径
- **简洁**：能用表格不用段落

### 3. 新 agent 接手步骤

1. 读 `AGENTS.md` → 了解项目全貌
2. 读 `docs/ARCHITECTURE.md` → 了解架构
3. 按需读 `docs/DATA-MODEL.md` / `docs/IPC.md`（工作流已合并到 `docs/ARCHITECTURE.md`）
4. 读关键源文件（按复杂度排序）：
   - `src/renderer/events.js`（入口，~285 行）
   - `main.js`（~315 行）
   - `src/main/conversation-store.js`（~130 行）
5. 需要改图片存储协议 → 读 `main.js` 中 `protocol.handle("local-img")`
6. 需要改 API 调用 → 读 `src/main/image-service.js`

### 4. 最近变更记录（2026-05-19 传承批次）

以下变更在本批次完成，新 agent 需特别注意：

**数据模型重构**：
- `text`/`params`/`uploadedImages` 从 turn 级别移到 branch 级别
- 每个 branch 拥有独立的提示词、参数、上传图片列表
- 切换分支时用户气泡内容（提示词/参数/图片）随之切换
- 旧格式无兼容代码，需一次性迁移或重建对话

**改写机制变更**：
- 改写时不再覆盖 turn 的 text/params，改为在当前 turn 创建新分支
- `handleRewrite()` 读取 activeBranch 的 text/params/uploadedImages 填入输入区

**删除保护**：
- 被后轮引用（`fromGenerated`）的选中图片不能删除
- 有下游依赖的非末轮分支不能删除

**重试 UI 修复**：
- loading 动画显示在已有图片**下方**，不遮挡图片
- 重试中切对话再回来保持 loading 状态
- 重试完成且用户已切走 → 存盘 + 未读气泡

**其他修复**：
- 横竖比例切换箭头方向修正
- Ctrl/Alt+Enter 插入换行而非发送
- IME 输入法中 Enter 不触发发送
- 右键菜单不被 prompt 菜单污染

### 5. 重构记录（2026-05-20）

**renderer.js 模块拆分**：
- `renderer.js`（1986 行单体）拆分为 13 个模块，总计 ~2037 行
- 模块按职责划分：`state.js` / `utils.js` / `params.js` / `ui.js` / `providers.js` / `upload.js` / `lightbox.js` / `conversations.js` / `chat-renderer.js` / `settings.js` / `send.js` / `branches.js` / `events.js`
- 保持 `<script>` 标签加载 + `App.*` 命名空间模式

**修复的问题**：
- 切换对话加锁（`_switching` 标志）
- 跨对话请求追踪（`_activeRequestConvId`），stopRequest 停正确对话
- `deleteConversation` 清理 drafts/conversationStates/unread
- 分支上限 `MAX_BRANCHES_PER_TURN = 50`
- `autoSaveDraft()` 函数缺失修复（原代码调用未定义函数）
- `preload.js` 移除无用的 `abortRequest` requestId 参数

**文档调整**：
- `docs/WORKFLOWS.md` 合并到 `docs/ARCHITECTURE.md`
- 所有文档中的 renderer.js 引用更新为模块名
- 移除死代码：`$`/`$$`/`escapeHtml`/`getLastTurnActiveBranch`/`showAlert`

### 6. Bug 修复批次（2026-05-20 后续）

**删除保护修复**：
- `turnHasDownstreamDep` 原检查 `turn.uploadedImages`，但该字段在 `turn.branches[].uploadedImages` 中，导致删除保护从未生效 → 改为遍历所有分支
- `showPromptMenu` 的 `hasSelected` 守卫导致末轮所有有选中图的分支不可删 → 移除
- `showCtxMenu` 缺少菜单侧删除权限检查，永远显示"删除" → 加上 `!isSending && (!isSelected || !turnHasDownstreamDep)` 判定
- 两入口均实现双层保障：菜单侧（是否显示选项）+ 执行侧（是否弹框阻止）

**交互体验修复**：
- `renderChat` 无条件 `scrollToBottom`，历史中切分支被拽回底部 → 改为调用方按需决定
- 历史轮选中图检查标记 `selectedBranchIndex`，引用发生时的 `activeBranchIndex` 被记录到源轮的 `selectedBranchIndex`；缺失此字段视为 -1，所有分支无勾；仅匹配分支显示勾

**数据模型新增**：
- `turn.selectedBranchIndex`：记录引用发生时的 activeBranchIndex，历史轮选中图仅在该分支上显示勾

### 7. 下一次传承触发条件

- agent 自行感知上下文紧张
- 用户提示"上下文忒长了"
- 项目代码超过 ~5000 行
