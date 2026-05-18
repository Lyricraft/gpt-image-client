# 🎨 GPT-Image-2 Node.js API 接入技术文档

> **文档版本**: v1.0
> **最后更新**: 2026-05-17
> **模型版本**: `gpt-image-2-2026-04-21` [6]
> **Node.js SDK 最低版本**: `openai >= 4.50.0` [2]

---

## 目录

1. [概述与背景](#1-概述与背景)
2. [环境准备](#2-环境准备)
3. [客户端初始化](#3-客户端初始化)
4. [文生图（Text-to-Image）](#4-文生图text-to-image)
5. [图片编辑（Image Edit）](#5-图片编辑image-edit)
6. [图片变体（Image Variation）](#6-图片变体image-variation)
7. [Responses API 多轮对话式生成](#7-responses-api-多轮对话式生成)
8. [参数详解](#8-参数详解)
9. [图片保存与处理](#9-图片保存与处理)
10. [错误处理与重试机制](#10-错误处理与重试机制)
11. [成本参考](#11-成本参考)
12. [生产环境最佳实践](#12-生产环境最佳实践)
13. [常见问题 FAQ](#13-常见问题-faq)

---

## 1. 概述与背景

**GPT-Image-2** 是 OpenAI 于 2026 年 4 月 21 日发布的旗舰图像生成模型 [8]，具备以下核心能力：

| 能力维度 | 说明 |
|---------|------|
| 🖋️ **文字渲染** | 99% 字符级准确率，原生支持中文/CJK [2] |
| 🎨 **输出质量** | 支持 4K 高清输出 |
| 📐 **宽高比** | 支持 `1:1`、`3:2`、`2:3`、`16:9`、`auto` 等 [1][12] |
| 🖼️ **输出格式** | PNG / JPEG / WebP [9] |
| ⚡ **生成速度** | 相比 GPT-Image-1.5 显著提升 |
| 🔄 **编辑能力** | 支持基于参考图的编辑和 Inpainting 局部重绘 [2] |
| 🧠 **推理整合** | 支持 O 系列推理能力整合，可处理复杂文字场景 [2] |

> 💡 **注意**：OpenAI 已于 2026 年 5 月 12 日关停 DALL-E 2/3，`gpt-image-2` 已全面取代其位置 [5][12]。

---

## 2. 环境准备

### 2.1 安装依赖

```bash
npm install openai@latest
```

确保版本不低于 `4.50.0`，旧版本可能不支持 `images.generate()` 的新参数 [2]。

### 2.2 获取 API Key

- **方式一**：访问 [OpenAI Platform](https://platform.openai.com) 创建 API Key（需海外支付方式）
- **方式二**：国内开发者可使用兼容中转服务（如 `api.apiyi.com`、`api.laozhang.ai` 等），支持支付宝/微信支付，接口与官方 100% 兼容 [2][5]

### 2.3 环境变量配置

```bash
# .env
OPENAI_API_KEY=sk-your-key-here
# 如使用中转服务：
# OPENAI_BASE_URL=https://api.apiyi.com/v1
```

---

## 3. 客户端初始化

### 3.1 标准方式（官方 API）

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 600 * 1000,    // 高清图需延长超时时间 [2]
  maxRetries: 2,           // 自动重试次数
});
```

### 3.2 通过中转服务（国内开发者推荐）

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.APIYI_KEY,        // 中转平台 API Key
  baseURL: 'https://api.apiyi.com/v1',  // 替换 baseURL [2]
  timeout: 600_000,                      // 毫秒
  maxRetries: 2,
});
```

---

## 4. 文生图（Text-to-Image）

### 4.1 基础调用（返回 URL）

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateImage() {
  const response = await openai.images.generate({
    model: 'gpt-image-2',
    prompt: '一只坐在沙发上的橘猫，戴着墨镜，数字艺术风格',
    n: 1,
    size: '1024x1024',
    quality: 'hd',
  });

  console.log('✅ 图片 URL:', response.data[0].url);
}
```

### 4.2 返回 Base64 并保存到本地

```javascript
import OpenAI from 'openai';
import fs from 'node:fs/promises';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateAndSave() {
  const response = await openai.images.generate({
    model: 'gpt-image-2',
    prompt: 'An e-commerce product photo of a leather backpack on a marble desk, studio lighting',
    size: '1024x1024',
    quality: 'high',
    output_format: 'png',      // 指定输出格式 [9]
    response_format: 'b64_json',
    n: 1,
  });

  const b64 = response.data[0].b64_json;
  await fs.writeFile('output.png', Buffer.from(b64, 'base64'));
  console.log('✅ 图片已保存为 output.png');
}
```

### 4.3 带输出压缩的高级调用

```javascript
const response = await openai.images.generate({
  model: 'gpt-image-2',
  prompt: 'A modern minimalist office desk with a vintage typewriter, soft morning light, photorealistic, 8K',
  size: '1536x1024',
  quality: 'high',
  output_format: 'jpeg',
  output_compression: 92,   // JPEG 压缩质量 [2]
  n: 1,
});
```

### 4.4 批量生成多张

```javascript
async function generateBatch(prompts) {
  const results = await Promise.all(
    prompts.map(prompt =>
      openai.images.generate({
        model: 'gpt-image-2',
        prompt,
        n: 1,
        size: '1024x1024',
      })
    )
  );

  results.forEach((res, i) => {
    console.log(`图片 ${i + 1}: ${res.data[0].url}`);
  });
}
```

---

## 5. 图片编辑（Image Edit）

基于已有图片进行修改 [6][2]：

```javascript
import OpenAI from 'openai';
import fs from 'node:fs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function editImage() {
  const response = await openai.images.edit({
    model: 'gpt-image-2',
    image: fs.createReadStream('./original.png'),   // 原图
    mask: fs.createReadStream('./mask.png'),         // 蒙版（可选，指定编辑区域）
    prompt: '将背景替换为樱花盛开的庭院，保留前景人物姿势和服装',
    n: 1,
    size: '1024x1024',
    quality: 'high',
  });

  console.log('✅ 编辑结果:', response.data[0].url);
}
```

---

## 6. 图片变体（Image Variation）

基于已有图片生成风格/内容变体 [6]：

```javascript
import OpenAI from 'openai';
import fs from 'node:fs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function createVariation() {
  const response = await openai.images.createVariation({
    model: 'gpt-image-2',
    image: fs.createReadStream('./source.png'),
    n: 3,                    // 生成 3 个变体
    size: '1024x1024',
  });

  response.data.forEach((img, i) => {
    console.log(`变体 ${i + 1}: ${img.url}`);
  });
}
```

---

## 7. Responses API 多轮对话式生成

OpenAI 推荐的多轮对话式图像编辑方案 [1][3]：

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function conversationalImage() {
  const response = await openai.responses.create({
    model: 'gpt-5.4',           // 用主模型，而非 gpt-image-2 [6]
    tools: [{
      type: 'image_generation',  // 挂载图像生成工具 [6]
    }],
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_text', text: '生成一张赛博朋克风格的城市夜景图，霓虹灯光' }
        ]
      }
    ],
  });

  console.log(response.output);
}
```

> ⚠️ **注意**：Responses API 应使用 `gpt-5.4` 等主模型并挂载 `image_generation` 工具，不要将 `gpt-image-2` 直接放进 Responses 的 `model` 字段 [6]。

---

## 8. 参数详解

### 8.1 核心参数

| 参数 | 类型 | 必填 | 说明 | 可选值 |
|------|------|------|------|--------|
| `model` | string | ✅ | 模型 ID | `"gpt-image-2"` |
| `prompt` | string | ✅ | 图像描述文本 | 任意字符串 |
| `n` | integer | ❌ | 生成图片数量 | 1-10（默认 1） |
| `size` | string | ❌ | 图片尺寸 | `256x256`, `512x512`, `1024x1024`, `1024x1792`, `1536x1024` 等 |
| `quality` | string | ❌ | 质量等级 | `"standard"`, `"hd"` / `"high"` [2] |
| `response_format` | string | ❌ | 返回格式 | `"url"`（默认）, `"b64_json"` |
| `output_format` | string | ❌ | 输出文件格式 | `"png"`, `"jpeg"`, `"webp"` [9] |
| `output_compression` | integer | ❌ | JPEG 压缩质量 | 0-100（仅 JPEG 有效）[2] |

### 8.2 Size 参数完整选项

| 宽高比 | 可用尺寸 |
|--------|---------|
| 1:1 | `1024x1024` |
| 3:2 | `1536x1024` |
| 2:3 | `1024x1536` |
| 16:9 | `1792x1024` [12] |
| 横图 | `1024x768`, `1280x720` |

### 8.3 Quality 与成本对照

| quality 值 | 说明 | 适用场景 |
|------------|------|---------|
| `standard` | 标准质量，速度更快 | 快速原型、批量测试 |
| `hd` / `high` | 高清质量，细节更丰富 | 产品图、商业交付 [2] |

> 💡 `high` 与 `hd` 在部分中转服务中通用，建议统一使用 `"high"`。

---

## 9. 图片保存与处理

### 9.1 URL 方式：下载到本地

```javascript
import fs from 'node:fs';
import https from 'node:https';

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const stream = fs.createWriteStream(filepath);
      res.pipe(stream);
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
  });
}

// 使用
const url = response.data[0].url;
await downloadImage(url, './image.png');
```

### 9.2 Base64 方式：直接保存

```javascript
const b64 = response.data[0].b64_json;
const buffer = Buffer.from(b64, 'base64');
await fs.writeFile('image.png', buffer);
```

### 9.3 转 Buffer 用于其他处理

```javascript
import sharp from 'sharp';  // 图片处理库

// 转成 Sharp 可操作对象
const b64 = response.data[0].b64_json;
const imageBuffer = Buffer.from(b64, 'base64');

// 调整大小并保存
await sharp(imageBuffer)
  .resize(800, 800)
  .jpeg({ quality: 90 })
  .toFile('resized.jpg');
```

---

## 10. 错误处理与重试机制

### 10.1 完整错误处理示例

```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 3,
  timeout: 600_000,
});

async function generateWithRetry(prompt, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await openai.images.generate({
        model: 'gpt-image-2',
        prompt,
        n: 1,
        size: '1024x1024',
        quality: 'high',
      });
      return { success: true, url: response.data[0].url };

    } catch (error) {
      console.error(`❌ 第 ${attempt} 次尝试失败:`, error.message);

      if (attempt === retries) {
        return {
          success: false,
          error: error.message,
          status: error.status,        // HTTP 状态码
          type: error.type,            // 错误类型
        };
      }

      // 指数退避：等待 1s, 2s, 4s...
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

// 使用
const result = await generateWithRetry('一片薰衣草花田，日落时分');
if (result.success) {
  console.log('✨ 图片:', result.url);
} else {
  console.error('💥 失败:', result.error);
}
```

### 10.2 常见错误码

| HTTP 状态码 | 错误类型 | 说明 | 处理方式 |
|-------------|---------|------|---------|
| 400 | `invalid_request_error` | 参数错误（如不支持的 size） | 检查参数 |
| 401 | `authentication_error` | API Key 无效 | 检查密钥 |
| 429 | `rate_limit_error` | 速率限制 | 重试 + 指数退避 |
| 500 | `api_error` | 服务器错误 | 重试 |
| 503 | `service_unavailable` | 服务暂不可用 | 重试 + 延迟 |

---

## 11. 成本参考

### 11.1 Token 计价标准 [6]

| 计费维度 | 价格（/1M tokens） |
|---------|------------------|
| 文本输入 | $5.00 |
| 缓存文本输入 | $1.25 |
| 图片输入 | $8.00 |
| 缓存图片输入 | $2.00 |
| 图片输出 | $30.00 |
| 文本输出 | $10.00 |

### 11.2 单张图片估算（1024x1024）[6][7]

| 质量等级 | 预估价格 |
|---------|---------|
| Low（低质量） | ~$0.006 |
| Medium（中质量） | ~$0.053 |
| High（高质量） | ~$0.211 |

> 💡 **省钱建议**：对于非商业快速测试，使用 `standard` 质量 + 较小尺寸；商业交付时再使用 `hd`/`high`。

---

## 12. 生产环境最佳实践

### ✅ 1. 使用环境变量管理密钥

```javascript
// .env
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1
```

### ✅ 2. 设置合理超时

高清图片生成可能耗时 30 秒以上，建议设置 600 秒超时 [2]：

```javascript
const openai = new OpenAI({
  timeout: 600_000,  // 600 秒
});
```

### ✅ 3. 实现请求队列和限流

部分中转平台对并发有限制，建议使用队列控制：

```javascript
import pLimit from 'p-limit';

const limit = pLimit(3);  // 同时最多 3 个请求

const results = await Promise.all(
  prompts.map(prompt =>
    limit(() => openai.images.generate({
      model: 'gpt-image-2',
      prompt,
      n: 1,
      size: '1024x1024',
    }))
  )
);
```

### ✅ 4. 日志与监控

```javascript
import fs from 'node:fs';

function logCall(prompt, result, duration) {
  const entry = {
    timestamp: new Date().toISOString(),
    prompt,
    success: result.success,
    duration: `${duration}ms`,
    url: result.url || null,
    error: result.error || null,
  };
  fs.appendFileSync('api.log', JSON.stringify(entry) + '\n');
}
```

### ✅ 5. 使用具体快照版本

为防止模型更新导致行为变化，建议指定具体快照：

```javascript
model: 'gpt-image-2-2026-04-21',  // 当前稳定快照 [6]
```

---

## 13. 常见问题 FAQ

### Q1: gpt-image-2 是否需要组织验证？

**A**: 部分账号可能需要组织验证和相应限额。上线前请用自己的 Key 测试权限 [6]。

### Q2: 国内开发者如何调用？

**A**: 可使用兼容中转服务（如 `api.apiyi.com`、`api.laozhang.ai` 等），仅需替换 `baseURL`，代码无需其他改动 [2][5]。

### Q3: 支持生成 PSD 分层文件吗？

**A**: 不支持。API 仅支持 `png`、`jpeg`、`webp` 三种输出格式。如需 PSD，可通过 ChatGPT 网页版 + Photoshop 集成实现 [9]。

### Q4: gpt-image-2 和 gpt-image-1.5 如何选择？

**A**: 追求最新能力和路线，选 `gpt-image-2`；追求生产稳定性，`gpt-image-1.5` 仍是稳妥选择 [7]。

### Q5: 免费用户每天能生成多少张？

**A**: ChatGPT 网页版免费用户约 2 张/天，Plus 订阅 ($20/月) 可解锁不限量 [5]。

### Q6: 一个 request 中 n 参数最大值是多少？

**A**: `n` 最大值为 10 [3]。

### Q7: Responses API 与 Image API 的区别？

| 维度 | Image API | Responses API |
|------|-----------|---------------|
| 适用场景 | 单次生成/编辑 [1] | 多轮对话式图像编辑 [1] |
| model 参数 | `gpt-image-2` | 主模型 + `image_generation` 工具 [6] |
| 复杂度 | 简单 | 较复杂，支持上下文管理 |

---

## 附录：完整可运行示例

```javascript
// app.js — GPT-Image-2 Node.js 完整示例
import OpenAI from 'openai';
import fs from 'node:fs/promises';
import 'dotenv/config';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 600_000,
});

async function main() {
  console.log('🚀 开始生成图片...');

  const start = Date.now();

  const response = await openai.images.generate({
    model: 'gpt-image-2',
    prompt: '一只戴着贝雷帽的柴犬画家，在画室里对着画板创作，油画风格，暖色调灯光',
    n: 1,
    size: '1024x1024',
    quality: 'hd',
    response_format: 'b64_json',
  });

  const duration = Date.now() - start;
  console.log(`⏱️ 生成耗时: ${duration}ms`);

  // 保存图片
  const b64 = response.data[0].b64_json;
  const filename = `output-${Date.now()}.png`;
  await fs.writeFile(filename, Buffer.from(b64, 'base64'));

  console.log(`✅ 图片已保存: ${filename}`);

  // 打印修订后的提示词（API 可能优化了你的提示词）
  if (response.data[0].revised_prompt) {
    console.log(`📝 优化后提示词: ${response.data[0].revised_prompt}`);
  }
}

main().catch(console.error);
```

---

> 📚 **参考资源**
> - [OpenAI 官方文档 - Image Generation](https://platform.openai.com/docs/guides/images)
> - [OpenAI 社区公告 - gpt-image-2 发布](https://community.openai.com) [8]
> - [GPT-Image-2 定价页](https://openai.com/pricing)
