const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  Menu,
  protocol,
  net,
} = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const fs = require("node:fs");

const isPackaged = app.isPackaged;
const runDir = isPackaged
  ? path.dirname(app.getPath("exe"))
  : path.join(__dirname, "run");
if (!fs.existsSync(runDir)) {
  fs.mkdirSync(runDir, { recursive: true });
}
process.chdir(runDir);

// Init data files if missing
const convDir = path.join(runDir, "conversations");
if (!fs.existsSync(convDir)) {
  fs.mkdirSync(convDir, { recursive: true });
}
["config.json", "conversations/index.json"].forEach((f) => {
  const fp = path.join(runDir, f);
  if (!fs.existsSync(fp)) {
    fs.writeFileSync(fp, f.endsWith("index.json") ? "[]" : "{}", "utf-8");
  }
});

const store = require("./src/main/store");
const imageService = require("./src/main/image-service");
const convStore = require("./src/main/conversation-store");

const isDev = process.argv.includes("--dev");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, "src", "renderer", "index.html"));

  if (isDev) {
    win.webContents.openDevTools();
  }
}

// --- Helpers ---

function mergeApiParams(extraParams = {}) {
  const config = store.getAll();
  const providers = config.providers || [];
  const active = providers.find((p) => p.isActive);
  return {
    apiKey: active?.apiKey || config.apiKey,
    baseURL: active?.baseURL || config.baseURL,
    timeout: config.timeout || 600_000,
    maxRetries: config.maxRetries ?? 2,
    ...extraParams,
  };
}

function convImageDir(convId) {
  return path.join(runDir, "conversations", convId);
}

// --- AbortController registry ---
const activeRequests = new Map();
let nextReqId = 1;

function runWithAbort(fn, requestOptions = {}) {
  const controller = new AbortController();
  const requestId = nextReqId++;
  activeRequests.set(requestId, controller);

  const opts = { ...requestOptions, signal: controller.signal };

  return fn(opts)
    .then((result) => {
      activeRequests.delete(requestId);
      return { ...result, requestId };
    })
    .catch((error) => {
      activeRequests.delete(requestId);
      if (error.name === "AbortError") {
        return { success: false, aborted: true, requestId };
      }
      return { success: false, error: error.message, requestId };
    });
}

// --- IPC: Image Generation ---

ipcMain.handle("image:generate", async (_event, prompt, params) => {
  return runWithAbort(async (opts) => {
    const merged = mergeApiParams(params);
    const response = await imageService.generateImage(prompt, merged, opts);
    return { success: true, data: response.data };
  });
});

ipcMain.handle("image:edit", async (_event, imagePath, prompt, params) => {
  return runWithAbort(async (opts) => {
    const merged = mergeApiParams(params);
    const response = await imageService.editImage(imagePath, prompt, merged, opts);
    return { success: true, data: response.data };
  });
});

ipcMain.handle("image:variation", async (_event, imagePath, params) => {
  return runWithAbort(async (opts) => {
    const merged = mergeApiParams(params);
    const response = await imageService.createVariation(imagePath, merged, opts);
    return { success: true, data: response.data };
  });
});

ipcMain.handle("image:abort", () => {
  for (const [id, ctrl] of activeRequests) {
    ctrl.abort();
    activeRequests.delete(id);
  }
  return { success: true };
});

ipcMain.handle("image:save-dialog", async (_event, base64, defaultName) => {
  const { filePath, canceled } = await dialog.showSaveDialog({
    defaultPath: defaultName || "image.png",
    filters: [
      { name: "Images", extensions: ["png", "jpg", "jpeg", "webp"] },
    ],
  });
  if (canceled) return { success: false, canceled: true };
  fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
  return { success: true, filePath };
});

// --- IPC: Image File Storage ---

ipcMain.handle("image:store", async (_e, convId, base64) => {
  const dir = convImageDir(convId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const hash = require("node:crypto")
    .createHash("sha256")
    .update(base64)
    .digest("hex")
    .slice(0, 16);
  const fileName = `img_${hash}.png`;
  const filePath = path.join(dir, fileName);

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
  }
  return { success: true, hash, fileName };
});

ipcMain.handle("image:store-batch", async (_e, convId, images) => {
  const dir = convImageDir(convId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const results = [];
  for (const img of images) {
    const hash = require("node:crypto")
      .createHash("sha256")
      .update(img.b64_json)
      .digest("hex")
      .slice(0, 16);
    const fileName = `img_${hash}.png`;
    const filePath = path.join(dir, fileName);

    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, Buffer.from(img.b64_json, "base64"));
    }
    results.push({
      index: img.index,
      hash,
      fileName,
      revised_prompt: img.revised_prompt,
    });
  }
  return { success: true, images: results };
});

ipcMain.handle("image:delete-file", async (_e, convId, fileName) => {
  const filePath = path.join(convImageDir(convId), fileName);
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("file:read-base64", async (_e, filePath) => {
  try {
    const data = fs.readFileSync(filePath);
    return { success: true, base64: data.toString("base64") };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("file:save-temp", async (_e, base64) => {
  const tmpDir = path.join(runDir, "tmp");
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(
    tmpDir,
    `${Date.now()}-${Math.random().toString(36).slice(2)}.png`
  );
  fs.writeFileSync(filePath, Buffer.from(base64, "base64"));
  return { success: true, filePath };
});

ipcMain.handle("file:copy-to-conv", async (_e, sourcePath, convId) => {
  const dir = path.join(convImageDir(convId), "uploaded");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const ext = path.extname(sourcePath) || ".png";
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}${ext}`;
  const destPath = path.join(dir, fileName);
  fs.copyFileSync(sourcePath, destPath);
  return { success: true, filePath: destPath };
});

ipcMain.handle("image:resolve-path", (_e, convId, fileName) => {
  const filePath = path.join(convImageDir(convId), fileName);
  if (!fs.existsSync(filePath)) return { success: false, error: "not found" };
  return { success: true, filePath };
});

ipcMain.handle("image:load-base64", (_e, convId, fileName) => {
  const filePath = path.join(convImageDir(convId), fileName);
  if (!fs.existsSync(filePath)) return { success: false, error: "not found" };
  const data = fs.readFileSync(filePath);
  return { success: true, base64: data.toString("base64") };
});

// --- IPC: Dialog ---

ipcMain.handle("dialog:selectImage", async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"],
    filters: [
      { name: "Images", extensions: ["png", "jpg", "jpeg", "webp", "gif"] },
    ],
  });
  if (canceled) return { success: false, canceled: true };
  return { success: true, filePaths };
});

// --- IPC: Conversation ---

ipcMain.handle("conv:list", () => convStore.list());
ipcMain.handle("conv:get", (_e, id) => convStore.get(id));
ipcMain.handle("conv:create", () => convStore.create());
ipcMain.handle("conv:delete", (_e, id) => {
  convStore.remove(id);
  return { success: true };
});
ipcMain.handle("conv:rename", (_e, id, title) => {
  convStore.rename(id, title);
  return { success: true };
});
ipcMain.handle("conv:save", (_e, conv) => {
  convStore.save(conv);
  return { success: true };
});

// --- IPC: Config / Provider ---

ipcMain.handle("config:get", () => store.getAll());

ipcMain.handle("config:set", (_e, key, value) => {
  store.set(key, value);
  if (key === "apiKey" || key === "baseURL" || key === "providers") {
    imageService.resetClient();
  }
  return { success: true };
});

ipcMain.handle("provider:list", () => {
  return store.get("providers") || [];
});

ipcMain.handle("provider:save", (_e, providers) => {
  store.set("providers", providers);
  imageService.resetClient();
  return { success: true };
});

// --- App Lifecycle ---

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  // Register custom protocol for serving conversation images
  protocol.handle("local-img", (request) => {
    const u = new URL(request.url);
    const filePath = path.join(runDir, "conversations", u.hostname, u.pathname);
    return net.fetch(pathToFileURL(filePath).href);
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
