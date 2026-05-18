# IPC 通道参考

## 图像生成

| Channel | 参数 | 返回 | 说明 |
|---------|------|------|------|
| `image:generate` | prompt, params | `{ success, data, requestId }` | 文生图 |
| `image:edit` | imagePath, prompt, params | `{ success, data, requestId }` | 编辑图 |
| `image:variation` | imagePath, params | `{ success, data, requestId }` | 图变体 |
| `image:save-dialog` | base64, defaultName | `{ success, filePath }` | 弹出保存框 |
| `image:abort` | — | `{ success }` | 中止所有活跃请求 |

三个图像通道都经过 `runWithAbort(fn)` 包装，支持 `AbortController`。

## 图片文件

| Channel | 参数 | 返回 | 说明 |
|---------|------|------|------|
| `image:store-batch` | convId, images[] | `{ success, images: [{hash,fileName}] }` | 批量存图，返回文件名 |
| `image:delete-file` | convId, fileName | `{ success }` | 删除图片文件 |
| `image:resolve-path` | convId, fileName | `{ success, filePath }` | 获取图片绝对路径 |
| `image:load-base64` | convId, fileName | `{ success, base64 }` | 读取图片 base64 |
| `file:save-temp` | base64 | `{ success, filePath }` | 存临时文件到 run/tmp/ |
| `file:copy-to-conv` | sourcePath, convId | `{ success, filePath }` | 复制图片到 conv uploaded/ |
| `file:read-base64` | filePath | `{ success, base64 }` | 读取任意文件为 base64 |

## 对话

| Channel | 参数 | 返回 | 说明 |
|---------|------|------|------|
| `conv:list` | — | 对话索引数组 | |
| `conv:get` | id | 完整对话对象 | 加载时清理 loading/n |
| `conv:create` | — | `{ id, title, ... }` | 新建对话 |
| `conv:delete` | id | `{ success }` | 删 JSON + 图片文件夹 |
| `conv:rename` | id, title | `{ success }` | 改显示名 |
| `conv:save` | conversation | `{ success }` | 深拷贝去脏后写入 |

## 配置与提供方

| Channel | 参数 | 返回 | 说明 |
|---------|------|------|------|
| `config:get` | — | 完整 config | |
| `config:set` | key, value | `{ success }` | |
| `provider:list` | — | providers[] | |
| `provider:save` | providers[] | `{ success }` | 全量替换 |

## 对话框

| Channel | 参数 | 返回 | 说明 |
|---------|------|------|------|
| `dialog:selectImage` | — | `{ success, filePaths }` | 多选图片文件 |
