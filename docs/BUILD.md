# 构建工作流

## 技术栈

- **打包工具**：electron-builder ^26.8.1
- **产出格式**：Windows unpacked 目录 + zip 压缩包
- **无需 bundler**：纯 JS + `file://` 加载，无 transpile/bundle 环节

## 命令参考

| 命令 | 功能 |
|------|------|
| `npm start` | 生产模式启动 |
| `npm run dev` | 开发模式启动（自动打开 DevTools） |
| `npm run build` | 构建 unpacked 应用并打包为 zip 到 `out/` |
| `npm run dist` | 同 `build` |

## 配置文件

### `electron-builder.yml`

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `appId` | `cn.lyricraft.gpt-image-client` | 应用唯一标识 |
| `productName` | `GPT-Image Client` | 显示名、产出文件名 |
| `directories.output` | `out` | 产出目录（已 gitignored） |
| `asar` | `true` | 源码打包为 ASAR 归档 |
| `win.target` | `dir` + `x64` | 仅 Windows unpacked 目录 |

### 构建流水线

`npm run build` 依次执行：
1. `node -e "require('fs').readdirSync('out').forEach(f=>require('fs').rmSync('out/'+f,{recursive:true,force:true}))"` — 清理上次产出
2. `electron-builder --win dir` — 生成 `out/win-unpacked/`
3. `node scripts/zip-dist.js` — 压缩为 `out/GPT-Image-Client-{version}-win-x64.zip`

### 资源打包规则

- **打包进 ASAR**：`main.js`、`preload.js`、`src/**/*`、`package.json`
- **不参与打包**：`run/`（运行时数据，用户机器上创建）、`node_modules/`（electron-builder 自动处理）

## 产出物

构建成功后，`out/` 目录下产出：

```
out/
├── win-unpacked/                        # unpacked 完整应用目录
└── GPT-Image-Client-1.0.0-win-x64.zip   # 分发 zip
```

用户解压 zip 后直接运行 `GPT-Image Client.exe` 即可，无需安装。

## 版本管理

版本号从 `package.json` 的 `version` 字段读取。发布新版本时先更新 `version`，然后执行 `npm run build`。

## 开发注意事项

- `--dev` flag 在 `main.js` 第 26 行检测，打开 DevTools 便于调试
- 构建前确保所有 IPC handler 和 preload 的通道名称一致（参见 `docs/IPC.md`）
- 新增文件需在 `electron-builder.yml` 的 `files` 规则中覆盖，否则不会打包进 ASAR
