// ============================================================
// State
// ============================================================
const state = {
  conversations: [],
  activeConvId: null,
  activeConv: null,
  providers: [],
  params: {
    sizeMode: "preset",
    ratio: "1:1",
    resolution: "1k",
    customWidth: 1024,
    customHeight: 1024,
    quality: "medium",
    output_format: "png",
    n: 1,
  },
  rewriteMode: false,
  rewriteTurnIndex: -1,
  uploadedImages: [],
  // Context menu state
  ctxImg: null,
  ctxTurnIndex: -1,
  ctxImgIndex: -1,
  // Per-conversation state
  drafts: {},           // convId -> { text, uploadedImages, params }
  conversationStates: {}, // convId -> { sending }
  unread: {},           // convId -> { type: 'success'|'error', message }
};

// ============================================================
// DOM shortcuts
// ============================================================
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const dom = {};
function initDom() {
  const ids = [
    "emptyState", "chatView", "convList", "chatMessages",
    "textInput", "btnSend", "btnUpload", "btnNewConv",
    "btnToggleParams", "paramsPanel", "inputImages",
    "rewriteIndicator", "btnCancelRewrite",
    "convTitle", "providerSelect", "btnSettings",
    "lightbox", "lightboxImg", "btnSaveImage",
    "settingsModal", "settingsProviders", "settingsPrefs",
    "providerList", "btnAddProvider", "providerEditor",
    "providerEditorTitle", "peName", "peBaseURL", "peApiKey",
    "btnSaveProvider", "prefTimeout", "btnSavePrefs",
    "paramQuality", "paramFormat", "paramN",
    "paramRatio", "paramResolution", "sizePreview",
    "paramWidth", "paramHeight", "presetSizeGroup", "customSizeGroup",
    "btnToggleSizeMode", "btnToggleOrientation",
    "ctxMenu", "alertModal", "alertTitle", "alertMsg", "alertOk", "alertCancel",
    "lbPrev", "lbNext", "lbCounter", "lbSelectBtn",
  ];
  ids.forEach((id) => { dom[id] = document.getElementById(id); });
}

// ============================================================
// Helpers
// ============================================================
function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
  });
}

function autoResize(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, 150) + "px";
}

function uid() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}

function turnHasDownstreamDep(conv, turnIndex) {
  if (!conv) return false;
  for (let i = turnIndex + 1; i < conv.turns.length; i++) {
    const t = conv.turns[i];
    if (t.uploadedImages?.some(u => u.fromGenerated && u.sourceTurnIndex === turnIndex)) {
      return true;
    }
  }
  return false;
}

// ============================================================
// Size presets
// ============================================================
const PRESET_SIZES = {
  "1:1": { "1k": "1024x1024", "1.5k": "1536x1536", "2k": "2048x2048" },
  "4:3": { "1k": "1536x1152", "1.5k": "2304x1728", "2k": "3072x2304" },
  "3:4": { "1k": "1152x1536", "1.5k": "1728x2304", "2k": "2304x3072" },
  "3:2": { "1k": "1536x1024", "1.5k": "2304x1536", "2k": "3072x2048" },
  "2:3": { "1k": "1024x1536", "1.5k": "1536x2304", "2k": "2048x3072" },
  "16:9": { "1k": "1792x1024", "1.5k": "2560x1440", "2k": "3840x2160" },
  "9:16": { "1k": "1024x1792", "1.5k": "1440x2560", "2k": "2160x3840" },
};

// Landscape ratios and their portrait counterparts
const LANDSCAPE_RATIOS = ["1:1", "4:3", "3:2", "16:9"];
const PORTRAIT_RATIOS = ["1:1", "3:4", "2:3", "9:16"];
const RATIO_MAP = { "4:3": "3:4", "3:4": "4:3", "3:2": "2:3", "2:3": "3:2", "16:9": "9:16", "9:16": "16:9" };
let _orientLand = true; // tracks orientation display mode (for 1:1 toggling)

function computeSize(params) {
  if (params.sizeMode === "custom") {
    return `${params.customWidth}x${params.customHeight}`;
  }
  return PRESET_SIZES[params.ratio]?.[params.resolution] || "1024x1024";
}

function buildApiParams() {
  return {
    size: computeSize(state.params),
    quality: state.params.quality,
    output_format: state.params.output_format,
    n: state.params.n,
  };
}

function buildTurnParams() {
  return {
    ...state.params,
    size: computeSize(state.params),
  };
}

function updateSizePreview() {
  dom.sizePreview.textContent = computeSize(state.params);
}

function isLandscape(ratio) {
  if (ratio === "1:1") return _orientLand;
  return LANDSCAPE_RATIOS.includes(ratio);
}

function populateRatioOptions() {
  const land = isLandscape(state.params.ratio);
  dom.paramRatio.innerHTML = (land ? LANDSCAPE_RATIOS : PORTRAIT_RATIOS).map((r) =>
    `<option value="${r}"${r === state.params.ratio ? " selected" : ""}>${r}</option>`
  ).join("");
  dom.btnToggleOrientation.textContent = land ? "↔" : "↕";
  dom.btnToggleOrientation.title = land ? "切换到竖版" : "切换到横版";
}

function syncSizeModeUI() {
  const isPreset = state.params.sizeMode === "preset";
  dom.presetSizeGroup.classList.toggle("hidden", !isPreset);
  dom.customSizeGroup.classList.toggle("hidden", isPreset);
  dom.btnToggleSizeMode.textContent = isPreset ? "📐" : "✏";
  dom.btnToggleSizeMode.title = isPreset ? "切换到自定义" : "切换到预设";
}

function syncParamsUI() {
  populateRatioOptions();
  dom.paramRatio.value = state.params.ratio;
  dom.paramResolution.value = state.params.resolution;
  dom.paramWidth.value = state.params.customWidth;
  dom.paramHeight.value = state.params.customHeight;
  dom.paramQuality.value = state.params.quality;
  dom.paramFormat.value = state.params.output_format;
  dom.paramN.value = state.params.n;
  syncSizeModeUI();
  updateSizePreview();
}

function isSending() {
  return state.conversationStates[state.activeConvId]?.sending || false;
}

function setSending(v, convId) {
  const id = convId || state.activeConvId;
  if (!id) return;
  if (!state.conversationStates[id]) state.conversationStates[id] = {};
  state.conversationStates[id].sending = v;
}

function readParamsFromUI() {
  saveDraft(state.activeConvId);
  // sizeMode is toggled by btnToggleSizeMode, not read from UI controls
  state.params.ratio = dom.paramRatio.value;
  state.params.resolution = dom.paramResolution.value;
  state.params.customWidth = parseInt(dom.paramWidth.value, 10) || 1024;
  state.params.customHeight = parseInt(dom.paramHeight.value, 10) || 1024;
  state.params.quality = dom.paramQuality.value;
  state.params.output_format = dom.paramFormat.value;
  state.params.n = parseInt(dom.paramN.value, 10) || 1;
  syncSizeModeUI();
  updateSizePreview();
  sessionStorage.setItem("params", JSON.stringify(state.params));
}

// ============================================================
// Image helpers
// ============================================================
function imageUrl(img, convId) {
  if (img.b64_json) return `data:image/png;base64,${img.b64_json}`;
  if (img.fileName && convId) return `local-img://${convId}/${img.fileName}`;
  if (img.path) return `file://${img.path.replace(/\\/g, "/")}`;
  return "";
}

async function getImageTempPath(img, convId) {
  if (!img) return null;
  if (img.fileName && convId) {
    const result = await window.electronAPI.resolveImagePath(convId, img.fileName);
    if (result.success) return result.filePath;
  }
  if (img.b64_json) {
    const result = await window.electronAPI.saveTempImage(img.b64_json);
    if (result.success) return result.filePath;
  }
  return null;
}

// ============================================================
// Drafts
// ============================================================
function saveDraft(convId) {
  if (!convId) return;
  state.drafts[convId] = {
    text: dom.textInput.value,
    uploadedImages: state.uploadedImages.map((i) => ({ id: i.id, path: i.path })),
    params: { ...state.params },
  };
}

function loadDraft(convId) {
  const draft = state.drafts[convId];
  clearUploadedImages();
  cancelRewrite();

  if (draft) {
    dom.textInput.value = draft.text;
    autoResize(dom.textInput);
    draft.uploadedImages.forEach((i) => state.uploadedImages.push({ id: i.id, path: i.path }));
    renderInputImages();
    Object.assign(state.params, draft.params);
    syncParamsUI();
  } else {
    dom.textInput.value = "";
    autoResize(dom.textInput);
  }
}

// ============================================================
// Init
// ============================================================
async function init() {
  initDom();
  syncParamsUI();
  bindEvents();

  try {
    const saved = JSON.parse(sessionStorage.getItem("params"));
    if (saved) Object.assign(state.params, saved);
  } catch {}
  syncParamsUI();

  await loadProviders();
  await loadConversations();
  await loadActiveConversation();
}

// ============================================================
// Providers
// ============================================================
async function loadProviders() {
  state.providers = (await window.electronAPI.listProviders()) || [];
  renderProviderSelect();
}

function renderProviderSelect() {
  dom.providerSelect.innerHTML = "";
  if (state.providers.length === 0) {
    dom.providerSelect.innerHTML = '<option value="">— 未配置提供方 —</option>';
    return;
  }
  state.providers.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name + (p.isActive ? " ✓" : "");
    if (p.isActive) opt.selected = true;
    dom.providerSelect.appendChild(opt);
  });
}

// ============================================================
// Conversations
// ============================================================
async function loadConversations() {
  state.conversations = await window.electronAPI.listConversations();
  renderConvList();
}

function renderConvList() {
  dom.convList.innerHTML = "";
  if (state.conversations.length === 0) {
    dom.convList.innerHTML =
      '<div class="conv-item" style="cursor:default;color:var(--text-muted)">暂无对话</div>';
    return;
  }
  state.conversations.forEach((c) => {
    const div = document.createElement("div");
    div.className = "conv-item" + (c.id === state.activeConvId ? " active" : "");
    div.dataset.id = c.id;

    const title = document.createElement("span");
    title.className = "conv-item-title";
    title.textContent = c.title;
    div.appendChild(title);

    // Unread dot
    const unread = state.unread[c.id];
    if (unread) {
      const dot = document.createElement("span");
      dot.className = "unread-dot " + unread.type;
      dot.textContent = unread.type === "success" ? "✓" : "✗";
      div.appendChild(dot);
    }

    const del = document.createElement("button");
    del.className = "conv-item-del";
    del.textContent = "✕";
    del.title = "删除对话";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteConversation(c.id);
    });
    div.appendChild(del);

    div.addEventListener("click", () => switchConversation(c.id));
    dom.convList.appendChild(div);
  });
}

async function switchConversation(id) {
  if (id === state.activeConvId) return;

  // Save draft for current conversation before switching
  saveDraft(state.activeConvId);
  cancelRewrite();

  state.activeConvId = id;
  state.activeConv = await window.electronAPI.getConversation(id);
  state.rewriteMode = false;
  state.rewriteTurnIndex = -1;

  // Load draft for new conversation
  loadDraft(id);

  // Clear unread for this conversation
  if (state.unread[id]) {
    delete state.unread[id];
    renderConvList();
  }

  // Update send button based on this conversation's request state
  const convState = state.conversationStates[id];
  if (convState?.sending) {
    dom.btnSend.textContent = "■";
    dom.btnSend.classList.add("stop");
    // Reconstruct loading state for the in-flight branch
    const turns = state.activeConv?.turns;
    if (turns?.length) {
      const lastTurn = turns[turns.length - 1];
      const br = lastTurn.branches[lastTurn.activeBranchIndex];
      if (br && !br.error) br.loading = true;
    }
  } else {
    dom.btnSend.textContent = "➤";
    dom.btnSend.classList.remove("stop");
  }

  renderConvList();
  renderChat();
  showChatView();
}

async function newConversation() {
  // Save current draft before switching
  saveDraft(state.activeConvId);

  const conv = await window.electronAPI.createConversation();
  state.conversations.unshift({
    id: conv.id, title: conv.title, createdAt: conv.createdAt, updatedAt: conv.updatedAt,
  });
  state.activeConvId = conv.id;
  state.activeConv = conv;
  state.rewriteMode = false;
  state.rewriteTurnIndex = -1;
  loadDraft(conv.id);
  dom.btnSend.textContent = "➤";
  dom.btnSend.classList.remove("stop");
  renderConvList();
  renderChat();
  showChatView();
  dom.textInput.focus();
}

async function deleteConversation(id) {
  if (state.activeConvId === id) {
    state.activeConvId = null;
    state.activeConv = null;
    dom.chatView.classList.add("hidden");
    dom.emptyState.classList.remove("hidden");
  }
  await window.electronAPI.deleteConversation(id);
  state.conversations = state.conversations.filter((c) => c.id !== id);
  renderConvList();
}

async function renameConversation(id, title) {
  await window.electronAPI.renameConversation(id, title);
  const entry = state.conversations.find((c) => c.id === id);
  if (entry) entry.title = title;
  if (state.activeConv) state.activeConv.title = title;
  renderConvList();
  updateChatHeader();
}

// ============================================================
// Chat rendering
// ============================================================
function showChatView() {
  dom.emptyState.classList.add("hidden");
  dom.chatView.classList.remove("hidden");
}

function updateChatHeader() {
  if (state.activeConv) dom.convTitle.textContent = state.activeConv.title;
}

function renderChat() {
  const conv = state.activeConv;
  if (!conv) return;
  updateChatHeader();
  dom.chatMessages.innerHTML = "";
  const lastTurnIndex = conv.turns.length - 1;
  conv.turns.forEach((turn, ti) => {
    dom.chatMessages.appendChild(renderTurn(turn, ti, ti === lastTurnIndex));
  });
  scrollToBottom();
}

function renderTurn(turn, turnIndex, isLastTurn) {
  const container = document.createElement("div");
  container.className = "turn";
  container.dataset.turnIndex = turnIndex;

  // Active branch (resolved early so user bubble can read its data)
  const activeBranch = turn.branches[turn.activeBranchIndex];

  // --- User bubble ---
  const bubble = document.createElement("div");
  bubble.className = "user-bubble";

  const branchUploaded = activeBranch?.uploadedImages || turn.uploadedImages;
  if (branchUploaded && branchUploaded.length > 0) {
    const imgRow = document.createElement("div");
    imgRow.className = "user-images";
    branchUploaded.forEach((img, ui) => {
      const src = img.path
        ? `file://${img.path.replace(/\\/g, "/")}`
        : "";
      const el = document.createElement("img");
      if (src) el.src = src;
      // Skip auto-referenced previous-turn images (no path = placeholder only)
      if (img.fromGenerated && !img.path) return;
      el.title = img.isMain ? "主图" : "参考图";
      el.style.cursor = "pointer";
      el.addEventListener("click", () => openUploadLightbox(turnIndex, ui));
      imgRow.appendChild(el);
    });
    bubble.appendChild(imgRow);
  }

  const textEl = document.createElement("div");
  textEl.className = "user-text";
  textEl.textContent = activeBranch?.text || turn.text || "";
  bubble.appendChild(textEl);

  const meta = document.createElement("div");
  meta.className = "user-meta";
  const bp = activeBranch?.params || turn.params;
  meta.textContent = `${bp?.size || ""} ${bp?.quality || ""} ${bp?.output_format || ""}`;
  bubble.appendChild(meta);

  // Right-click on prompt text
  bubble.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const branch = turn.branches[turn.activeBranchIndex];
    const hasSelected = branch?.images?.some((i) => i.isSelected);
    showPromptMenu(e.clientX, e.clientY, turnIndex, hasSelected);
  });

  container.appendChild(bubble);



  // --- Branch bar: "◀ X/Y ▶  [改写]" ---
  const branchBar = document.createElement("div");
  branchBar.className = "branch-bar";

  if (turn.branches.length > 0) {
    const nav = document.createElement("span");
    nav.className = "branch-nav";

    const left = document.createElement("span");
    left.className = "nav-arrow" + (turn.activeBranchIndex <= 0 ? " disabled" : "");
    left.textContent = "◀";
    left.addEventListener("click", () => {
      if (turn.activeBranchIndex > 0) switchBranch(turnIndex, turn.activeBranchIndex - 1);
    });
    nav.appendChild(left);

    const label = document.createElement("span");
    label.textContent = `${turn.activeBranchIndex + 1}/${turn.branches.length}`;
    nav.appendChild(label);

    const right = document.createElement("span");
    right.className = "nav-arrow" + (turn.activeBranchIndex >= turn.branches.length - 1 ? " disabled" : "");
    right.textContent = "▶";
    right.addEventListener("click", () => {
      if (turn.activeBranchIndex < turn.branches.length - 1) switchBranch(turnIndex, turn.activeBranchIndex + 1);
    });
    nav.appendChild(right);

    branchBar.appendChild(nav);
  }

  if (isLastTurn && activeBranch && !activeBranch.loading && !isSending()) {
    const retryBtn = document.createElement("span");
    retryBtn.className = "branch-pill retry";
    retryBtn.textContent = "🔄 重试";
    retryBtn.addEventListener("click", () => handleRetry(turnIndex));
    branchBar.appendChild(retryBtn);
  }

  if (isLastTurn) {
    const rewrite = document.createElement("span");
    rewrite.className = "branch-pill rewrite";
    rewrite.textContent = "✏ 改写";
    rewrite.addEventListener("click", () => handleRewrite(turnIndex));
    branchBar.appendChild(rewrite);
  }

  container.appendChild(branchBar);

  if (activeBranch) {
    // Always render images if they exist (loading/error can coexist)
    if (activeBranch.images && activeBranch.images.length > 0) {
      const grid = document.createElement("div");
      grid.className = "image-grid";
      activeBranch.images.forEach((img, idx) => {
        grid.appendChild(
          renderImageCard(img, idx === activeBranch.selectedImageIndex, isLastTurn, turnIndex, idx)
        );
      });
      container.appendChild(grid);
    }

    // Loading indicator below images (or standalone for fresh generations)
    if (activeBranch.loading) {
      const load = document.createElement("div");
      load.className = "turn-loading";
      load.innerHTML = '<div class="spinner"></div> 生成中...';
      container.appendChild(load);
    }

    // Error below images
    if (activeBranch.error) {
      const err = document.createElement("div");
      err.className = "turn-error";
      err.textContent = activeBranch.error;
      container.appendChild(err);
    }
  }

  return container;
}

function renderImageCard(img, isSelected, canSelect, turnIndex, imgIndex) {
  const card = document.createElement("div");
  card.className = "image-card" + (isSelected ? " selected" : "");
  card.dataset.turnIndex = turnIndex;
  card.dataset.imgIndex = imgIndex;

  const imgEl = document.createElement("img");
  imgEl.src = imageUrl(img, state.activeConvId);
  imgEl.alt = "generated";
  imgEl.draggable = false;
  card.appendChild(imgEl);

  const badge = document.createElement("div");
  badge.className = "img-badge";
  badge.textContent = isSelected ? "✓" : imgIndex + 1;
  card.appendChild(badge);

  // Click on image: open lightbox
  imgEl.addEventListener("click", (e) => {
    if (e.target.closest(".img-badge")) return;
    openLightbox(turnIndex, imgIndex);
  });

  // Click on badge: select (last turn only)
  badge.addEventListener("click", (e) => {
    e.stopPropagation();
    if (canSelect) {
      const turn = state.activeConv?.turns[turnIndex];
      const branch = turn?.branches[turn.activeBranchIndex];
      if (branch) selectImage(turnIndex, imgIndex, branch.images);
    }
  });

  // Right click: context menu
  card.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    state.ctxImg = img;
    state.ctxTurnIndex = turnIndex;
    state.ctxImgIndex = imgIndex;
    showCtxMenu(e.clientX, e.clientY);
  });

  return card;
}

// ============================================================
// Branch operations
// ============================================================
function switchBranch(turnIndex, branchIndex) {
  const turn = state.activeConv?.turns[turnIndex];
  if (!turn) return;
  turn.activeBranchIndex = branchIndex;
  saveConv();
  renderChat();
}

async function handleRetry(turnIndex) {
  const conv = state.activeConv;
  const turn = conv?.turns[turnIndex];
  if (!turn) return;

  const branch = turn.branches[turn.activeBranchIndex];
  if (!branch) return;

  // Clear previous error so loading can show
  delete branch.error;

  setSending(true);
  dom.btnSend.textContent = "■";
  dom.btnSend.classList.add("stop");

  // Show loading on the branch
  branch.loading = true;
  saveConv();
  renderChat();
  scrollToBottom();

  try {
    let result;
    // Resolve main image: uploaded → prev generated → none
    let mainPath = null;
    const brUploaded = branch.uploadedImages || turn.uploadedImages;
    const fileUpload = brUploaded?.find((u) => u.path && !u.fromGenerated);
    const prevRef = brUploaded?.find((u) => u.fromGenerated);

    if (fileUpload) {
      mainPath = fileUpload.path;
    } else if (prevRef) {
      const srcTurn = conv.turns[prevRef.sourceTurnIndex];
      if (srcTurn) {
        const sel = getSelectedImage(srcTurn);
        if (sel) mainPath = await getImageTempPath(sel, conv.id);
      }
    } else if (branch.images?.length > 0) {
      mainPath = await getImageTempPath(
        branch.images.find((i) => i.isSelected) || branch.images[0],
        conv.id
      );
    }

    const brText = branch.text || turn.text || "";
    const brParams = branch.params || turn.params;
    if (mainPath) {
      result = await window.electronAPI.editImage(mainPath, brText, {
        size: brParams.size,
        quality: brParams.quality,
        output_format: brParams.output_format,
        n: brParams.n,
      });
    } else {
      result = await window.electronAPI.generateImage(brText, {
        size: brParams.size,
        quality: brParams.quality,
        output_format: brParams.output_format,
        n: brParams.n,
      });
    }

    branch.loading = false;

    if (result.aborted) {
      return;
    }

    if (result.success) {
      // Store new images as files
      const stored = await window.electronAPI.storeImageBatch(conv.id, result.data);
      const newImages = stored.success
        ? stored.images.map((s, i) => ({
            index: i,
            id: uid(),
            fileName: s.fileName,
            isSelected: i === 0,
          }))
        : result.data.map((d, i) => ({
            index: i,
            id: uid(),
            b64_json: d.b64_json,
            isSelected: i === 0,
          }));

      // Prepend new images to the current branch
      branch.images.forEach((img) => { img.isSelected = false; });
      branch.images.unshift(...newImages);
      branch.selectedImageIndex = 0;
    } else {
      branch.error = result.error;
    }
  } catch (err) {
    branch.loading = false;
    branch.error = err.message;
  } finally {
    setSending(false, conv.id);
    dom.btnSend.textContent = "➤";
    dom.btnSend.classList.remove("stop");
  }
  // Save using captured conv reference (survives conversation switch during retry)
  await window.electronAPI.saveConversation(conv);
  if (state.activeConvId === conv.id) {
    state.activeConv = conv;
    renderChat();
    scrollToBottom();
  } else {
    const success = !branch.error;
    state.unread[conv.id] = { type: success ? "success" : "error" };
    renderConvList();
  }
}

async function handleRewrite(turnIndex) {
  const turn = state.activeConv?.turns[turnIndex];
  if (!turn) return;
  const branch = turn.branches[turn.activeBranchIndex];

  state.rewriteMode = true;
  state.rewriteTurnIndex = turnIndex;

  dom.textInput.value = branch?.text || turn.text || "";
  autoResize(dom.textInput);

  const bp = branch?.params || turn.params;
  if (bp) {
    Object.assign(state.params, bp);
    syncParamsUI();
  }

  // Load branch's uploaded images into the input area
  clearUploadedImages();
  const brUploaded = branch?.uploadedImages || turn.uploadedImages || [];
  for (const u of brUploaded) {
    if (u.path) {
      state.uploadedImages.push({ id: uid(), path: u.path });
    } else if (u.fromGenerated) {
      // Resolve auto-referenced previous-turn image to a real file path
      const conv = state.activeConv;
      if (conv) {
        const srcTurn = conv.turns[u.sourceTurnIndex];
        if (srcTurn) {
          const sel = getSelectedImage(srcTurn);
          if (sel?.fileName) {
            const filePath = await getImageTempPath(sel, conv.id);
            if (filePath) state.uploadedImages.push({ id: uid(), path: filePath });
          }
        }
      }
    }
  }
  renderInputImages();

  dom.rewriteIndicator.classList.remove("hidden");
  dom.textInput.focus();
  scrollToBottom();
}

function cancelRewrite() {
  state.rewriteMode = false;
  state.rewriteTurnIndex = -1;
  dom.rewriteIndicator.classList.add("hidden");
}

// ============================================================
// Image selection
// ============================================================
function selectImage(turnIndex, imgIndex, images) {
  const conv = state.activeConv;
  const turn = conv?.turns[turnIndex];
  const branch = turn?.branches[turn.activeBranchIndex];
  if (!branch) return;

  const lastTurnIndex = conv.turns.length - 1;
  if (turnIndex !== lastTurnIndex) return;

  branch.selectedImageIndex = imgIndex;
  images.forEach((img, i) => { img.isSelected = i === imgIndex; });
  saveConv();
  renderChat();
}

// ============================================================
// Context menu
// ============================================================
function showCtxMenu(x, y) {
  const menu = dom.ctxMenu;
  // Restore default items (showPromptMenu may have replaced innerHTML)
  menu.innerHTML = `
    <div class="ctx-item" data-action="save">💾 保存到本地</div>
    <div class="ctx-item" data-action="delete">🗑 删除</div>
  `;
  menu.querySelectorAll(".ctx-item").forEach((item) => {
    item.addEventListener("click", () => handleCtxAction(item.dataset.action));
  });
  menu.style.left = x + "px";
  menu.style.top = y + "px";
  menu.classList.remove("hidden");
}

function hideCtxMenu() {
  dom.ctxMenu.classList.add("hidden");
  state.ctxImg = null;
  state.ctxTurnIndex = -1;
  state.ctxImgIndex = -1;
}

async function handleCtxAction(action) {
  const img = state.ctxImg;
  const turnIndex = state.ctxTurnIndex;
  const imgIndex = state.ctxImgIndex;
  hideCtxMenu();
  if (!img || turnIndex < 0 || imgIndex < 0) return;

  if (action === "delete" && isSending()) {
    showToast("请求中，不能删除图片", "error");
    return;
  }

  if (action === "save") {
    let b64 = img.b64_json;
    if (!b64 && img.fileName) {
      const res = await window.electronAPI.loadImageBase64(state.activeConvId, img.fileName);
      if (res.success) b64 = res.base64;
    }
    if (b64) {
      await window.electronAPI.saveImageDialog(b64, `gpt-image-${Date.now()}.png`);
    }
  } else if (action === "delete") {
    await deleteImage(turnIndex, imgIndex);
  }
}

async function deleteImage(turnIndex, imgIndex) {
  const conv = state.activeConv;
  const turn = conv?.turns[turnIndex];
  const branch = turn?.branches[turn.activeBranchIndex];
  if (!branch) return;

  const img = branch.images[imgIndex];
  if (!img) return;

  // Cannot delete the selected image if a subsequent turn depends on this turn
  if (img.isSelected && turnHasDownstreamDep(conv, turnIndex)) {
    return showToast("该图片被后续轮次用作主图，无法删除", "error");
  }

  // Delete the file if it exists
  if (img.fileName) {
    await window.electronAPI.deleteImageFile(conv.id, img.fileName);
  }

  // Remove from array
  branch.images.splice(imgIndex, 1);

  // Adjust selectedImageIndex
  if (branch.images.length === 0) {
    branch.selectedImageIndex = -1;
  } else if (imgIndex === branch.selectedImageIndex) {
    // The selected image was deleted - select nearest
    branch.selectedImageIndex = Math.min(imgIndex, branch.images.length - 1);
    branch.images[branch.selectedImageIndex].isSelected = true;
  } else if (imgIndex < branch.selectedImageIndex) {
    branch.selectedImageIndex--;
  }

  saveConv();
  renderChat();
}

// ============================================================
// Prompt right-click menu
// ============================================================
function showPromptMenu(x, y, turnIndex, hasSelected) {
  const menu = dom.ctxMenu;
  menu.innerHTML = "";

  if (!hasSelected) {
      const conv = state.activeConv;
      const canDelete = !conv || turnIndex === conv.turns.length - 1 || !turnHasDownstreamDep(conv, turnIndex);
      if (canDelete) {
        const del = document.createElement("div");
        del.className = "ctx-item";
        del.textContent = "🗑 删除本分支";
        del.addEventListener("click", () => {
          hideCtxMenu();
          handleDeleteBranch(turnIndex);
        });
        menu.appendChild(del);
      }
    }

  const send = document.createElement("div");
  send.className = "ctx-item";
  send.textContent = "✉ 发送到新对话";
  send.addEventListener("click", () => {
    hideCtxMenu();
    handleSendToNew(turnIndex);
  });
  menu.appendChild(send);

  menu.style.left = x + "px";
  menu.style.top = y + "px";
  menu.classList.remove("hidden");
}

function handleDeleteBranch(turnIndex) {
  const conv = state.activeConv;
  const turn = conv?.turns[turnIndex];
  if (!turn) return;

  // Cannot delete branch if its images are used by a later turn
  if (turnIndex < conv.turns.length - 1 && turnHasDownstreamDep(conv, turnIndex)) {
    return showToast("该分支的图片被后续轮次用作主图，无法删除", "error");
  }

  // Remove the active branch
  const bi = turn.activeBranchIndex;
  turn.branches.splice(bi, 1);

  if (turn.branches.length === 0) {
    // No branches left — delete the entire turn
    conv.turns.splice(turnIndex, 1);
  } else {
    // Switch to first available branch
    turn.activeBranchIndex = Math.min(bi, turn.branches.length - 1);
  }

  saveConv();
  renderChat();
  showToast("已删除", "success");
}

async function handleSendToNew(turnIndex) {
  const conv = state.activeConv;
  const turn = conv?.turns[turnIndex];
  if (!turn) return;
  const branch = turn.branches[turn.activeBranchIndex];

  // Create new conversation
  const newConv = await window.electronAPI.createConversation();

  // Build draft: prompt + params + uploaded images + prev turn selected image
  const draft = {
    text: branch?.text || turn.text || "",
    uploadedImages: [],
    params: { ...(branch?.params || turn.params) },
  };

  // Copy uploaded images
  const srcUploaded = (branch?.uploadedImages || turn.uploadedImages);
  if (srcUploaded?.length) {
    for (const u of srcUploaded) {
      if (u.path) {
        const copied = await window.electronAPI.copyToConv(u.path, newConv.id);
        if (copied.success) {
          draft.uploadedImages.push({ id: uid(), path: copied.filePath });
        }
      } else if (u.fromGenerated) {
        // Reference to a generated image from a previous turn
        const srcTurn = conv.turns[u.sourceTurnIndex];
        if (srcTurn) {
          const sel = getSelectedImage(srcTurn);
          if (sel?.fileName) {
            // Copy generated image to new conv
            const srcPath = await getImageTempPath(sel, conv.id);
            if (srcPath) {
              const copied = await window.electronAPI.copyToConv(srcPath, newConv.id);
              if (copied.success) {
                draft.uploadedImages.push({ id: uid(), path: copied.filePath });
              }
            }
          }
        }
      }
    }
  } else {
    // If no uploaded images, try to include the previous turn's selected image
    const prevTurnIdx = turnIndex - 1;
    if (prevTurnIdx >= 0) {
      const prevTurn = conv.turns[prevTurnIdx];
      const sel = getSelectedImage(prevTurn);
      if (sel?.fileName) {
        const srcPath = await getImageTempPath(sel, conv.id);
        if (srcPath) {
          const copied = await window.electronAPI.copyToConv(srcPath, newConv.id);
          if (copied.success) {
            draft.uploadedImages.push({ id: uid(), path: copied.filePath });
          }
        }
      }
    }
  }

  // Switch to new conversation with draft
  saveDraft(state.activeConvId);
  state.conversations.unshift({
    id: newConv.id, title: newConv.title,
    createdAt: newConv.createdAt, updatedAt: newConv.updatedAt,
  });
  state.activeConvId = newConv.id;
  state.activeConv = newConv;
  state.rewriteMode = false;
  state.rewriteTurnIndex = -1;

  // Set draft
  state.drafts[newConv.id] = draft;
  loadDraft(newConv.id);

  renderConvList();
  renderChat();
  showChatView();
  dom.textInput.focus();
}

// ============================================================
// Input helpers
// ============================================================
function getLastTurn() {
  const conv = state.activeConv;
  if (!conv || conv.turns.length === 0) return null;
  return conv.turns[conv.turns.length - 1];
}

function getSelectedImage(turn) {
  if (!turn) return null;
  const branch = turn.branches[turn.activeBranchIndex];
  if (!branch || !branch.images || branch.images.length === 0) return null;
  const sel = branch.images.find((img) => img.isSelected);
  return sel || branch.images[0];
}

function clearUploadedImages() {
  state.uploadedImages = [];
  renderInputImages();
}

function getLastTurnActiveBranch() {
  const lastTurn = getLastTurn();
  return lastTurn?.branches[lastTurn.activeBranchIndex] || null;
}

// ============================================================
// Stop / Abort
// ============================================================
function stopRequest() {
  setSending(false);
  dom.btnSend.textContent = "➤";
  dom.btnSend.classList.remove("stop");

  // Clear all loading states in the active conversation
  const conv = state.activeConv;
  if (conv) {
    for (const turn of conv.turns) {
      const branch = turn.branches[turn.activeBranchIndex];
      if (branch?.loading) {
        branch.loading = false;
      }
    }
    saveConv();
    renderChat();
  }

  // Abort backend request
  window.electronAPI.abortRequest();
}

// ============================================================
// Send
// ============================================================
async function handleSend() {
  const text = dom.textInput.value.trim();
  if (!text || isSending()) return;

  // Validate provider
  if (state.providers.length > 0 && !state.providers.some((p) => p.isActive)) {
    state.providers[0].isActive = true;
    await saveProviders();
  }
  if (state.providers.length === 0 || !state.providers.some((p) => p.isActive)) {
    return showToast("请先在设置中配置 API 提供方", "error");
  }

  // If not first turn, no uploaded images, and last branch is empty → prompt
  const lastTurn = getLastTurn();
  const hasUploads = state.uploadedImages.length > 0;
  if (lastTurn && !hasUploads && state.activeConv?.turns.length > 1) {
    const lastBranch = lastTurn.branches[lastTurn.activeBranchIndex];
    if ((!lastBranch || !lastBranch.images || lastBranch.images.length === 0)) {
      const ok = await showConfirm("图片已清空", "上一轮没有可用图片，是否重新生成新图片？");
      if (!ok) return;
      // User chose to generate fresh — fall through to generateImage
    }
  }

  let _reqConvId; // hoisted for finally block

  setSending(true);
  dom.btnSend.textContent = "■";
  dom.btnSend.classList.add("stop");

  try {
    const isRewrite = state.rewriteMode;
    const rewriteIdx = state.rewriteTurnIndex;

    if (isRewrite) {
      state.rewriteMode = false;
      state.rewriteTurnIndex = -1;
      dom.rewriteIndicator.classList.add("hidden");
    }

    if (!state.activeConv) await newConversation();
    const conv = state.activeConv;
    _reqConvId = conv.id;

    // --- Build uploaded images (before branch creation) ---
    const uploadedInTurn = [];
    if (state.uploadedImages.length > 0) {
      uploadedInTurn.push(
        ...state.uploadedImages.map((img, i) => ({
          id: img.id,
          path: img.path,
          isMain: i === 0,
        }))
      );
    } else if (!isRewrite && state.activeConv) {
      const prevTurnIdx = state.activeConv.turns.length - 1;
      if (prevTurnIdx >= 0) {
        const prevTurn = state.activeConv.turns[prevTurnIdx];
        const sel = getSelectedImage(prevTurn);
        if (sel) {
          uploadedInTurn.push({
            id: "prev",
            path: null,
            isMain: true,
            fromGenerated: true,
            sourceTurnIndex: prevTurnIdx,
          });
        }
      }
    }
    // Copy uploaded files to conv directory
    for (const u of uploadedInTurn) {
      if (u.path && !u.fromGenerated) {
        const res = await window.electronAPI.copyToConv(u.path, conv.id);
        if (res.success) u.path = res.filePath;
      }
    }

    // --- Create turn (non-rewrite) or new branch (rewrite) ---
    let turn, branch, turnIndex;
    if (isRewrite) {
      turnIndex = rewriteIdx;
      turn = conv.turns[turnIndex];
      branch = {
        id: uid(),
        text,
        params: buildTurnParams(),
        uploadedImages: uploadedInTurn,
        images: [],
        selectedImageIndex: -1,
        loading: true,
      };
      turn.branches.push(branch);
      turn.activeBranchIndex = turn.branches.length - 1;
    } else {
      branch = {
        id: uid(),
        text,
        params: buildTurnParams(),
        uploadedImages: uploadedInTurn,
        images: [],
        selectedImageIndex: -1,
        loading: true,
      };
      turn = {
        id: uid(),
        branches: [branch],
        activeBranchIndex: 0,
      };
      conv.turns.push(turn);
      turnIndex = conv.turns.length - 1;
    }

    dom.textInput.value = "";
    autoResize(dom.textInput);
    clearUploadedImages();
    saveConv();
    renderChat();
    scrollToBottom();

    // Determine main image for edit vs generate
    let mainImagePath = null;
    const fileUploads = uploadedInTurn.filter((u) => u.path && !u.fromGenerated);
    const prevRef = uploadedInTurn.find((u) => u.fromGenerated);

    if (prevRef) {
      const srcTurn = conv.turns[prevRef.sourceTurnIndex];
      if (srcTurn) {
        const sel = getSelectedImage(srcTurn);
        if (sel) mainImagePath = await getImageTempPath(sel, conv.id);
      }
    } else if (fileUploads.length > 0) {
      mainImagePath = fileUploads[0].path;
    }

    // API call
    let result;
    if (mainImagePath) {
      result = await window.electronAPI.editImage(mainImagePath, text, buildApiParams());
    } else {
      result = await window.electronAPI.generateImage(text, buildApiParams());
    }

    branch.loading = false;

    // Handle abort
    if (result.aborted) {
      const idx = turn.branches.indexOf(branch);
      if (idx >= 0) turn.branches.splice(idx, 1);
      if (state.activeConvId === conv.id) {
        saveConv();
        renderChat();
      }
      return;
    }

    if (result.success) {
      // Store images as files
      const stored = await window.electronAPI.storeImageBatch(conv.id, result.data);
      if (stored.success) {
        branch.images = stored.images.map((s, i) => ({
          index: i,
          id: uid(),
          fileName: s.fileName,
          isSelected: i === 0,
        }));
      } else {
        // Fallback to base64
        branch.images = result.data.map((d, i) => ({
          index: i,
          id: uid(),
          b64_json: d.b64_json,
          isSelected: i === 0,
        }));
      }
      branch.selectedImageIndex = 0;

      if (conv.title === "新对话" && text.length > 0) {
        const t = text.length > 30 ? text.slice(0, 30) + "…" : text;
        await renameConversation(conv.id, t);
      }
    } else {
      branch.error = result.error;
    }

    await window.electronAPI.saveConversation(conv);
    if (state.activeConvId === conv.id) {
      state.activeConv = conv;
      renderChat();
      scrollToBottom();
    } else {
      state.unread[conv.id] = { type: result.success ? "success" : "error" };
      renderConvList();
    }
  } catch (err) {
    showToast("出错了: " + err.message, "error");
  } finally {
    setSending(false, _reqConvId);
    dom.btnSend.textContent = "➤";
    dom.btnSend.classList.remove("stop");
  }
}

// ============================================================
// Image upload
// ============================================================
const MAX_IMAGES = 5;

function getMaxUploads() {
  const lastTurn = getLastTurn();
  const sel = lastTurn ? getSelectedImage(lastTurn) : null;
  return sel ? MAX_IMAGES - 1 : MAX_IMAGES;
}

async function addUploadedFiles(filePaths) {
  const max = getMaxUploads();
  const remaining = max - state.uploadedImages.length;
  if (remaining <= 0) {
    showToast(`最多上传 ${max} 张图片`, "error");
    return;
  }
  filePaths.slice(0, remaining).forEach((path) => {
    state.uploadedImages.push({ id: uid(), path });
  });
  renderInputImages();
  autoSaveDraft();
}

async function addUploadedFileData(dataUrl) {
  // dataUrl: "data:image/png;base64,..."
  const tmpRes = await window.electronAPI.saveTempImage(dataUrl.split(",")[1]);
  if (!tmpRes.success) return;
  await addUploadedFiles([tmpRes.filePath]);
}

async function uploadImages() {
  const result = await window.electronAPI.selectImage();
  if (!result.success) return;
  await addUploadedFiles(result.filePaths);
}

function removeUploadedImage(index) {
  state.uploadedImages.splice(index, 1);
  renderInputImages();
}

function renderInputImages() {
  dom.inputImages.innerHTML = "";
  state.uploadedImages.forEach((img, i) => {
    const thumb = document.createElement("div");
    thumb.className = "input-image-thumb";
    const imgEl = document.createElement("img");
    imgEl.src = `file://${img.path.replace(/\\/g, "/")}`;
    thumb.appendChild(imgEl);
    const remove = document.createElement("button");
    remove.className = "img-remove";
    remove.textContent = "✕";
    remove.addEventListener("click", () => removeUploadedImage(i));
    thumb.appendChild(remove);
    dom.inputImages.appendChild(thumb);
  });
}

// ============================================================
// Save & Persist
// ============================================================
async function saveConv() {
  if (state.activeConv) {
    await window.electronAPI.saveConversation(state.activeConv);
  }
}

async function saveProviders() {
  await window.electronAPI.saveProviders(state.providers);
  renderProviderSelect();
}

// ============================================================
// Lightbox
// ============================================================
let lbState = { images: [], index: 0, canSelect: false, turnIndex: -1 };

function openLightbox(turnIndex, imgIndex) {
  const conv = state.activeConv;
  const turn = conv?.turns[turnIndex];
  const branch = turn?.branches[turn.activeBranchIndex];
  if (!branch?.images?.length) return;

  const isLastTurn = turnIndex === conv.turns.length - 1;
  lbState = {
    images: branch.images.map((img) => ({ img, type: "generated" })),
    index: imgIndex,
    canSelect: isLastTurn,
    turnIndex,
  };
  renderLightbox();
}

function openUploadLightbox(turnIndex, uploadIndex) {
  const conv = state.activeConv;
  const turn = conv?.turns[turnIndex];
  if (!turn) return;
  const branch = turn.branches[turn.activeBranchIndex];
  const src = (branch?.uploadedImages || turn.uploadedImages);
  if (!src?.length) return;

  lbState = {
    images: src.map((u) => ({ img: u, type: "uploaded" })),
    index: uploadIndex,
    canSelect: false,
    turnIndex,
  };
  renderLightbox();
}

function renderLightbox() {
  const { images, index } = lbState;
  if (!images?.length) return;

  const entry = images[index];
  dom.lightboxImg.src = imageUrl(entry.img, state.activeConvId);

  // Counter
  dom.lbCounter.textContent = `${index + 1}/${images.length}`;

  // Prev/next visibility
  dom.lbPrev.style.display = images.length > 1 ? "" : "none";
  dom.lbNext.style.display = images.length > 1 ? "" : "none";

  // Select button
  if (lbState.canSelect && entry.type === "generated") {
    dom.lbSelectBtn.classList.remove("hidden");
    const turn = state.activeConv?.turns[lbState.turnIndex];
    const branch = turn?.branches[turn.activeBranchIndex];
    const img = branch?.images[index];
    const selected = img?.isSelected || false;
    dom.lbSelectBtn.textContent = selected ? "已选中" : "选中";
    dom.lbSelectBtn.className = "lb-sel-btn" + (selected ? " active" : " inactive");
  } else {
    dom.lbSelectBtn.classList.add("hidden");
  }

  dom.lightbox.classList.remove("hidden");
}

function closeLightbox() {
  dom.lightbox.classList.add("hidden");
  lbState = { images: [], index: 0, canSelect: false, turnIndex: -1 };
}

function lbNavigate(dir) {
  const { images, index } = lbState;
  if (!images?.length) return;
  const newIdx = index + dir;
  if (newIdx < 0 || newIdx >= images.length) return;
  lbState.index = newIdx;
  renderLightbox();
}

function lbSelectImage() {
  if (!lbState.canSelect) return;
  const turn = state.activeConv?.turns[lbState.turnIndex];
  const branch = turn?.branches[turn.activeBranchIndex];
  const img = branch?.images[lbState.index];
  if (!img || img.isSelected) return;
  branch.images.forEach((im, i) => {
    im.isSelected = i === lbState.index;
  });
  branch.selectedImageIndex = lbState.index;
  saveConv();
  renderLightbox();
}

// ============================================================
// Alert
// ============================================================
function showAlert(title, msg) {
  dom.alertTitle.textContent = title;
  dom.alertMsg.textContent = msg;
  dom.alertCancel.style.display = "none";
  dom.alertModal.classList.remove("hidden");
}

function showConfirm(title, msg) {
  dom.alertTitle.textContent = title;
  dom.alertMsg.textContent = msg;
  dom.alertCancel.style.display = "";
  dom.alertModal.classList.remove("hidden");
  return new Promise((resolve) => {
    dom.alertOk._confirmResolve = resolve;
    dom.alertCancel._confirmResolve = resolve;
  });
}

function closeAlert() {
  dom.alertModal.classList.add("hidden");
  dom.alertOk._confirmResolve = null;
  dom.alertCancel._confirmResolve = null;
}

// ============================================================
// Settings
// ============================================================
function openSettings() {
  dom.settingsModal.classList.remove("hidden");
  renderProvidersInSettings();
}

function closeSettings() {
  dom.settingsModal.classList.add("hidden");
}

function renderProvidersInSettings() {
  dom.providerList.innerHTML = "";
  if (state.providers.length === 0) {
    dom.providerList.innerHTML =
      '<div style="color:var(--text-muted);font-size:13px;padding:8px 0;">暂无提供方，请添加</div>';
    return;
  }
  state.providers.forEach((p, i) => {
    const item = document.createElement("div");
    item.className = "provider-item";
    const info = document.createElement("div");
    info.className = "provider-info";
    const name = document.createElement("div");
    name.className = "provider-name";
    name.innerHTML = p.name + (p.isActive ? ' <span class="active-badge">当前</span>' : "");
    info.appendChild(name);
    const url = document.createElement("div");
    url.className = "provider-url";
    url.textContent = p.baseURL || "https://api.openai.com/v1";
    info.appendChild(url);
    item.appendChild(info);

    const actions = document.createElement("div");
    actions.className = "provider-actions";

    const setActive = document.createElement("button");
    setActive.className = "text-btn";
    setActive.textContent = p.isActive ? "✓" : "使用";
    if (!p.isActive) {
      setActive.addEventListener("click", () => setActiveProvider(i));
    } else {
      setActive.style.color = "var(--green)";
    }
    actions.appendChild(setActive);

    const edit = document.createElement("button");
    edit.className = "text-btn";
    edit.textContent = "编辑";
    edit.addEventListener("click", () => openProviderEditor(i));
    actions.appendChild(edit);

    const del = document.createElement("button");
    del.className = "text-btn";
    del.textContent = "删除";
    del.style.color = "var(--red)";
    del.addEventListener("click", () => deleteProvider(i));
    actions.appendChild(del);

    item.appendChild(actions);
    dom.providerList.appendChild(item);
  });
}

let editingProviderIndex = -1;

function openProviderEditor(index) {
  editingProviderIndex = index;
  if (index >= 0 && state.providers[index]) {
    const p = state.providers[index];
    dom.peName.value = p.name;
    dom.peBaseURL.value = p.baseURL || "";
    dom.peApiKey.value = p.apiKey || "";
    dom.providerEditorTitle.textContent = "编辑提供方";
  } else {
    dom.peName.value = "";
    dom.peBaseURL.value = "";
    dom.peApiKey.value = "";
    dom.providerEditorTitle.textContent = "添加提供方";
  }
  dom.providerEditor.classList.remove("hidden");
}

function closeProviderEditor() {
  dom.providerEditor.classList.add("hidden");
  editingProviderIndex = -1;
}

function saveProviderFromEditor() {
  const name = dom.peName.value.trim();
  const baseURL = dom.peBaseURL.value.trim();
  const apiKey = dom.peApiKey.value.trim();
  if (!name || !apiKey) return showToast("展示名和 API Key 不能为空", "error");
  const provider = {
    id: editingProviderIndex >= 0 ? state.providers[editingProviderIndex].id : uid(),
    name,
    baseURL,
    apiKey,
    isActive: editingProviderIndex >= 0
      ? state.providers[editingProviderIndex].isActive
      : state.providers.length === 0,
  };
  if (editingProviderIndex >= 0) {
    state.providers[editingProviderIndex] = provider;
  } else {
    state.providers.push(provider);
  }
  saveProviders();
  renderProvidersInSettings();
  closeProviderEditor();
  showToast("提供方已保存", "success");
}

async function deleteProvider(index) {
  state.providers.splice(index, 1);
  if (state.providers.length > 0 && !state.providers.some((p) => p.isActive)) {
    state.providers[0].isActive = true;
  }
  await saveProviders();
  renderProvidersInSettings();
}

async function setActiveProvider(index) {
  state.providers.forEach((p, i) => (p.isActive = i === index));
  await saveProviders();
  renderProvidersInSettings();
}

// ============================================================
// Toast
// ============================================================
let toastTimer;

function showToast(msg, type) {
  let el = document.getElementById("toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "toast";
    el.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      padding:10px 24px;border-radius:8px;font-size:14px;z-index:2000;
      background:var(--bg-card);border:1px solid var(--border);
      color:var(--text);box-shadow:0 4px 12px rgba(0,0,0,0.3);
      transition:opacity 0.2s;
    `;
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.borderColor =
    type === "error" ? "var(--red)" : type === "success" ? "var(--green)" : "var(--border)";
  el.style.opacity = "1";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.opacity = "0"; }, 3000);
}

// ============================================================
// Events
// ============================================================
function bindEvents() {
  // Send
  dom.btnSend.addEventListener("click", () => {
    if (isSending()) {
      stopRequest();
    } else {
      handleSend();
    }
  });
  dom.textInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.isComposing) {
      e.preventDefault();
      handleSend();
      return;
    }
    // Shift/Ctrl/Alt + Enter → insert newline
    if (e.key === "Enter" && (e.shiftKey || e.ctrlKey || e.altKey)) {
      e.preventDefault();
      const ta = dom.textInput;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      ta.value = ta.value.substring(0, start) + "\n" + ta.value.substring(end);
      ta.selectionStart = ta.selectionEnd = start + 1;
      autoResize(ta);
      autoSaveDraft();
    }
  });
  dom.textInput.addEventListener("input", () => {
    autoResize(dom.textInput);
    autoSaveDraft();
  });

  // Upload
  dom.btnUpload.addEventListener("click", uploadImages);

  // Drag & drop images onto input area
  const inputArea = dom.textInput.closest(".input-area");
  if (inputArea) {
    inputArea.addEventListener("dragover", (e) => {
      if (e.dataTransfer?.types.includes("Files")) {
        e.preventDefault();
        inputArea.classList.add("drag-over");
      }
    });
    inputArea.addEventListener("dragleave", () => {
      inputArea.classList.remove("drag-over");
    });
    inputArea.addEventListener("drop", async (e) => {
      e.preventDefault();
      inputArea.classList.remove("drag-over");
      const paths = [];
      for (const file of e.dataTransfer?.files || []) {
        if (file.type.startsWith("image/")) {
          const fp = window.electronAPI.getFilePath(file);
          if (fp) paths.push(fp);
        }
      }
      if (paths.length) await addUploadedFiles(paths);
    });
  }

  // Paste image into text input
  dom.textInput.addEventListener("paste", async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        if (item.kind === "file") {
          const file = item.getAsFile();
          const fpath = window.electronAPI.getFilePath(file);
          if (fpath) {
            await addUploadedFiles([fpath]);
          } else if (file) {
            // Clipboard image without file path (e.g. screenshot) — read as base64
            const b64 = await new Promise((r) => {
              const fr = new FileReader();
              fr.onload = () => r(fr.result.split(",")[1]);
              fr.readAsDataURL(file);
            });
            const tmp = await window.electronAPI.saveTempImage(b64);
            if (tmp.success) await addUploadedFiles([tmp.filePath]);
          }
        } else {
          const dataUrl = await new Promise((r) => item.getAsString(r));
          await addUploadedFileData(dataUrl);
        }
        return;
      }
    }
  });

  // Params
  dom.btnToggleParams.addEventListener("click", () => {
    dom.paramsPanel.classList.toggle("hidden");
  });
  dom.btnToggleSizeMode.addEventListener("click", () => {
    state.params.sizeMode = state.params.sizeMode === "preset" ? "custom" : "preset";
    syncSizeModeUI();
    readParamsFromUI();
  });
  dom.btnToggleOrientation.addEventListener("click", () => {
    const next = RATIO_MAP[state.params.ratio];
    if (next) {
      state.params.ratio = next;
    } else {
      _orientLand = !_orientLand;
    }
    syncParamsUI();
    readParamsFromUI();
  });
  dom.paramRatio.addEventListener("change", readParamsFromUI);
  dom.paramResolution.addEventListener("change", readParamsFromUI);
  dom.paramWidth.addEventListener("change", readParamsFromUI);
  dom.paramHeight.addEventListener("change", readParamsFromUI);
  dom.paramQuality.addEventListener("change", readParamsFromUI);
  dom.paramFormat.addEventListener("change", readParamsFromUI);
  dom.paramN.addEventListener("change", readParamsFromUI);

  // New conversation
  dom.btnNewConv.addEventListener("click", newConversation);

  // Rewrite
  dom.btnCancelRewrite.addEventListener("click", () => {
    cancelRewrite();
    dom.textInput.value = "";
    autoResize(dom.textInput);
    clearUploadedImages();
  });

  // Provider select
  dom.providerSelect.addEventListener("change", (e) => {
    const id = e.target.value;
    state.providers.forEach((p) => (p.isActive = p.id === id));
    saveProviders();
    renderProviderSelect();
  });

  // Settings
  dom.btnSettings.addEventListener("click", openSettings);
  dom.settingsModal.querySelectorAll(".modal-close").forEach((btn) => {
    btn.addEventListener("click", closeSettings);
  });
  dom.settingsModal.addEventListener("click", (e) => {
    if (e.target === dom.settingsModal) closeSettings();
  });

  // Settings tabs
  dom.settingsModal.querySelectorAll(".modal-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      dom.settingsModal
        .querySelectorAll(".modal-tab")
        .forEach((t) => t.classList.remove("active"));
      dom.settingsModal
        .querySelectorAll(".modal-tab-content")
        .forEach((c) => c.classList.remove("active"));
      tab.classList.add("active");
      const targetId =
        "settings" + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1);
      document.getElementById(targetId).classList.add("active");
    });
  });

  // Provider editor
  dom.btnAddProvider.addEventListener("click", () => openProviderEditor(-1));
  dom.btnSaveProvider.addEventListener("click", saveProviderFromEditor);
  dom.providerEditor.querySelectorAll(".modal-close").forEach((btn) => {
    btn.addEventListener("click", closeProviderEditor);
  });
  dom.providerEditor.addEventListener("click", (e) => {
    if (e.target === dom.providerEditor) closeProviderEditor();
  });

  // Prefs
  dom.btnSavePrefs.addEventListener("click", async () => {
    await window.electronAPI.setConfig(
      "timeout",
      parseInt(dom.prefTimeout.value, 10) * 1000 || 600000
    );
    showToast("偏好已保存", "success");
  });

  // Lightbox
  dom.lightbox.addEventListener("click", (e) => {
    if (
      e.target === dom.lightbox ||
      e.target.classList.contains("lightbox-close")
    ) {
      closeLightbox();
    }
  });
  dom.lbPrev.addEventListener("click", () => lbNavigate(-1));
  dom.lbNext.addEventListener("click", () => lbNavigate(1));
  dom.lbSelectBtn.addEventListener("click", lbSelectImage);
  document.addEventListener("keydown", (e) => {
    if (dom.lightbox.classList.contains("hidden")) return;
    if (e.key === "ArrowLeft") lbNavigate(-1);
    if (e.key === "ArrowRight") lbNavigate(1);
  });
  dom.btnSaveImage.addEventListener("click", async () => {
    const entry = lbState.images[lbState.index];
    if (!entry) { showToast("没有可保存的图片", "error"); return; }
    const img = entry.img;
    if (!img.fileName && !img.b64_json && !img.path) {
      return showToast("图片数据不完整，无法保存", "error");
    }
    let b64 = img.b64_json;
    if (!b64 && img.fileName) {
      if (!state.activeConvId) return showToast("未选择对话", "error");
      const res = await window.electronAPI.loadImageBase64(
        state.activeConvId,
        img.fileName
      );
      if (res.success) { b64 = res.base64; }
      else { showToast("读取图片文件失败: " + (res.error || "未知错误"), "error"); }
    }
    if (!b64 && img.path) {
      const res = await window.electronAPI.readFileBase64(img.path);
      if (res.success) { b64 = res.base64; }
      else { showToast("读取图片路径失败: " + (res.error || "未知错误"), "error"); }
    }
    if (b64) {
      await window.electronAPI.saveImageDialog(b64, `gpt-image-${Date.now()}.png`);
    }
  });

  // Context menu
  dom.ctxMenu.querySelectorAll(".ctx-item").forEach((item) => {
    item.addEventListener("click", () => handleCtxAction(item.dataset.action));
  });
  document.addEventListener("click", (e) => {
    if (!dom.ctxMenu.contains(e.target)) hideCtxMenu();
  });
  document.addEventListener("contextmenu", (e) => {
    if (!e.target.closest(".image-card") && !e.target.closest(".user-bubble")) {
      hideCtxMenu();
    }
  });

  // Alert / Confirm
  dom.alertOk.addEventListener("click", () => {
    if (dom.alertOk._confirmResolve) dom.alertOk._confirmResolve(true);
    closeAlert();
  });
  dom.alertCancel.addEventListener("click", () => {
    if (dom.alertCancel._confirmResolve) dom.alertCancel._confirmResolve(false);
    closeAlert();
  });
  dom.alertModal.addEventListener("click", (e) => {
    if (e.target === dom.alertModal) {
      if (dom.alertOk._confirmResolve) dom.alertOk._confirmResolve(false);
      closeAlert();
    }
  });

  // Conv title inline rename
  dom.convTitle.addEventListener("dblclick", () => {
    const input = document.createElement("input");
    input.type = "text";
    input.value = state.activeConv?.title || "";
    input.className = "text-input";
    input.style.padding = "2px 8px";
    input.style.fontSize = "15px";
    input.style.width = "200px";
    dom.convTitle.replaceWith(input);
    input.focus();
    input.select();

    function done() {
      const val = input.value.trim() || state.activeConv?.title || "新对话";
      input.replaceWith(dom.convTitle);
      if (state.activeConv) renameConversation(state.activeConv.id, val);
    }
    input.addEventListener("blur", done);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); input.blur(); }
      if (e.key === "Escape") { input.value = state.activeConv?.title || ""; input.blur(); }
    });
  });

  // Global keyboard
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeLightbox();
      closeSettings();
      closeProviderEditor();
      closeAlert();
      hideCtxMenu();
    }
  });
}

// ============================================================
// Load active conversation
// ============================================================
async function loadActiveConversation() {
  if (state.conversations.length > 0) {
    await switchConversation(state.conversations[0].id);
  }
}

// ============================================================
// Start
// ============================================================
document.addEventListener("DOMContentLoaded", init);
