// ============================================================
// State — 全局状态、DOM 引用、常量
// ============================================================
window.App = window.App || {};

(function (ns) {
  // --- Constants ---
  ns.MAX_BRANCHES_PER_TURN = 50;
  ns.MAX_IMAGES = 5;

  ns.PRESET_SIZES = {
    "1:1": { "1k": "1024x1024", "1.5k": "1536x1536", "2k": "2048x2048" },
    "4:3": { "1k": "1536x1152", "1.5k": "2304x1728", "2k": "3072x2304" },
    "3:4": { "1k": "1152x1536", "1.5k": "1728x2304", "2k": "2304x3072" },
    "3:2": { "1k": "1536x1024", "1.5k": "2304x1536", "2k": "3072x2048" },
    "2:3": { "1k": "1024x1536", "1.5k": "1536x2304", "2k": "2048x3072" },
    "16:9": { "1k": "1792x1024", "1.5k": "2560x1440", "2k": "3840x2160" },
    "9:16": { "1k": "1024x1792", "1.5k": "1440x2560", "2k": "2160x3840" },
  };
  ns.LANDSCAPE_RATIOS = ["1:1", "4:3", "3:2", "16:9"];
  ns.PORTRAIT_RATIOS = ["1:1", "3:4", "2:3", "9:16"];
  ns.RATIO_MAP = { "4:3": "3:4", "3:4": "4:3", "3:2": "2:3", "2:3": "3:2", "16:9": "9:16", "9:16": "16:9" };
  ns._orientLand = true;

  // --- Unique ID ---
  ns.uid = function () {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  };

  // --- Main state ---
  ns.state = {
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
    drafts: {},
    conversationStates: {},
    unread: {},
    // In-flight request tracking (survives conversation switch)
    _activeRequestConvId: null,
  };

  // --- DOM references (populated by initDom) ---
  ns.dom = {};

  ns.initDom = function () {
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
      "paramWidth", "paramHeight", "sizeStatus", "presetSizeGroup", "customSizeGroup",
      "btnToggleSizeMode", "btnToggleOrientation",
      "ctxMenu", "alertModal", "alertTitle", "alertMsg", "alertOk", "alertCancel",
      "lbPrev", "lbNext", "lbCounter", "lbSelectBtn",
    ];
    ids.forEach(function (id) { ns.dom[id] = document.getElementById(id); });
  };
})(window.App);
