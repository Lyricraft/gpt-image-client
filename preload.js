const { contextBridge, ipcRenderer, webUtils } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Image generation
  generateImage: (prompt, params) =>
    ipcRenderer.invoke("image:generate", prompt, params),
  editImage: (imagePath, prompt, params) =>
    ipcRenderer.invoke("image:edit", imagePath, prompt, params),
  createVariation: (imagePath, params) =>
    ipcRenderer.invoke("image:variation", imagePath, params),

  // Image file storage
  storeImage: (convId, base64) =>
    ipcRenderer.invoke("image:store", convId, base64),
  storeImageBatch: (convId, images) =>
    ipcRenderer.invoke("image:store-batch", convId, images),
  deleteImageFile: (convId, fileName) =>
    ipcRenderer.invoke("image:delete-file", convId, fileName),

  // Save to user-chosen location
  saveImageDialog: (base64, defaultName) =>
    ipcRenderer.invoke("image:save-dialog", base64, defaultName),
  saveTempImage: (base64) =>
    ipcRenderer.invoke("file:save-temp", base64),
  readFileBase64: (filePath) =>
    ipcRenderer.invoke("file:read-base64", filePath),
  copyToConv: (sourcePath, convId) =>
    ipcRenderer.invoke("file:copy-to-conv", sourcePath, convId),
  resolveImagePath: (convId, fileName) =>
    ipcRenderer.invoke("image:resolve-path", convId, fileName),
  loadImageBase64: (convId, fileName) =>
    ipcRenderer.invoke("image:load-base64", convId, fileName),

  // Dialog
  selectImage: () => ipcRenderer.invoke("dialog:selectImage"),

  // Conversation
  listConversations: () => ipcRenderer.invoke("conv:list"),
  getConversation: (id) => ipcRenderer.invoke("conv:get", id),
  createConversation: () => ipcRenderer.invoke("conv:create"),
  deleteConversation: (id) => ipcRenderer.invoke("conv:delete", id),
  renameConversation: (id, title) => ipcRenderer.invoke("conv:rename", id, title),
  saveConversation: (conv) => ipcRenderer.invoke("conv:save", conv),

  // File
  getFilePath: (file) => webUtils.getPathForFile(file),

  // Config / Providers
  getConfig: () => ipcRenderer.invoke("config:get"),
  setConfig: (key, value) => ipcRenderer.invoke("config:set", key, value),
  listProviders: () => ipcRenderer.invoke("provider:list"),
  saveProviders: (providers) => ipcRenderer.invoke("provider:save", providers),

  // Abort
  abortRequest: (requestId) => ipcRenderer.invoke("image:abort", requestId),
});
