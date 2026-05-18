const OpenAI = require("openai");
const fs = require("node:fs");
const https = require("node:https");

let client = null;

function getClient(config) {
  if (client) return client;
  client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL || undefined,
    timeout: config.timeout || 600_000,
    maxRetries: config.maxRetries ?? 2,
  });
  return client;
}

function resetClient() {
  client = null;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry(fn, retries = 3, signal) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      return await fn();
    } catch (error) {
      if (error.name === "AbortError") throw error;
      if (attempt === retries) throw error;
      await sleep(Math.pow(2, attempt - 1) * 1000);
    }
  }
}

function buildPayload(params) {
  return {
    model: "gpt-image-2",
    n: params.n ?? 1,
    size: params.size ?? "1024x1024",
    quality: params.quality ?? "standard",
    response_format: params.response_format ?? "b64_json",
    ...(params.output_format && { output_format: params.output_format }),
    ...(params.output_compression != null && {
      output_compression: params.output_compression,
    }),
  };
}

async function generateImage(prompt, params = {}, requestOptions = {}) {
  const { signal } = requestOptions;
  return withRetry(
    () =>
      getClient(params).images.generate(
        { ...buildPayload(params), prompt },
        { signal }
      ),
    3,
    signal
  );
}

async function editImage(imagePath, prompt, params = {}, requestOptions = {}) {
  const { signal } = requestOptions;
  return withRetry(
    () =>
      getClient(params).images.edit(
        {
          model: "gpt-image-2",
          image: fs.createReadStream(imagePath),
          ...(params.maskPath && { mask: fs.createReadStream(params.maskPath) }),
          prompt,
          n: params.n ?? 1,
          size: params.size ?? "1024x1024",
          quality: params.quality ?? "standard",
          response_format: "b64_json",
        },
        { signal }
      ),
    3,
    signal
  );
}

async function createVariation(imagePath, params = {}, requestOptions = {}) {
  const { signal } = requestOptions;
  return withRetry(
    () =>
      getClient(params).images.createVariation(
        {
          model: "gpt-image-2",
          image: fs.createReadStream(imagePath),
          n: params.n ?? 1,
          size: params.size ?? "1024x1024",
          response_format: "b64_json",
        },
        { signal }
      ),
    3,
    signal
  );
}

async function downloadImage(url, filePath) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${res.statusCode}`));
        return;
      }
      const stream = fs.createWriteStream(filePath);
      res.pipe(stream);
      stream.on("finish", resolve);
      stream.on("error", reject);
    });
  });
}

module.exports = {
  generateImage,
  editImage,
  createVariation,
  downloadImage,
  resetClient,
};
