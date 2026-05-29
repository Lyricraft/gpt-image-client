// ============================================================
// Params — 尺寸预设、参数计算、UI 同步
// ============================================================
window.App = window.App || {};

(function (ns) {
  var state = ns.state;
  var dom = ns.dom;

  ns.computeSize = function (params) {
    if (params.sizeMode === "custom") {
      return params.customWidth + "x" + params.customHeight;
    }
    var byRatio = ns.PRESET_SIZES[params.ratio];
    return (byRatio && byRatio[params.resolution]) || "1024x1024";
  };

  ns.buildApiParams = function () {
    return {
      size: ns.computeSize(state.params),
      quality: state.params.quality,
      output_format: state.params.output_format,
      n: state.params.n,
    };
  };

  ns.buildTurnParams = function () {
    var p = Object.assign({}, state.params);
    p.size = ns.computeSize(state.params);
    return p;
  };

  ns.updateSizePreview = function () {
    dom.sizePreview.textContent = ns.computeSize(state.params);
  };

  ns.isLandscape = function (ratio) {
    if (ratio === "1:1") return ns._orientLand;
    return ns.LANDSCAPE_RATIOS.indexOf(ratio) >= 0;
  };

  ns.populateRatioOptions = function () {
    var land = ns.isLandscape(state.params.ratio);
    var ratios = land ? ns.LANDSCAPE_RATIOS : ns.PORTRAIT_RATIOS;
    dom.paramRatio.innerHTML = ratios.map(function (r) {
      return '<option value="' + r + '"' + (r === state.params.ratio ? ' selected' : '') + '>' + r + '</option>';
    }).join("");
    dom.btnToggleOrientation.textContent = land ? "↔" : "↕";
    dom.btnToggleOrientation.title = land ? "切换到竖版" : "切换到横版";
  };

  ns.syncSizeModeUI = function () {
    var isPreset = state.params.sizeMode === "preset";
    dom.presetSizeGroup.classList.toggle("hidden", !isPreset);
    dom.customSizeGroup.classList.toggle("hidden", isPreset);
    dom.btnToggleSizeMode.textContent = isPreset ? "📐" : "✏";
    dom.btnToggleSizeMode.title = isPreset ? "切换到自定义" : "切换到预设";
    dom.btnToggleOrientation.textContent = isPreset ? (ns.isLandscape(state.params.ratio) ? "↔" : "↕") : "⤢";
    dom.btnToggleOrientation.title = isPreset ? (ns.isLandscape(state.params.ratio) ? "切换到竖版" : "切换到横版") : "互换宽高";
  };

  ns.syncParamsUI = function () {
    ns.populateRatioOptions();
    dom.paramRatio.value = state.params.ratio;
    dom.paramResolution.value = state.params.resolution;
    dom.paramWidth.value = state.params.customWidth;
    dom.paramHeight.value = state.params.customHeight;
    dom.paramQuality.value = state.params.quality;
    dom.paramFormat.value = state.params.output_format;
    dom.paramN.value = state.params.n;
    ns.syncSizeModeUI();
    ns.updateSizePreview();
    ns.updateSizeStatus();
  };

  ns.readParamsFromUI = function () {
    ns.saveDraft(state.activeConvId);
    state.params.ratio = dom.paramRatio.value;
    state.params.resolution = dom.paramResolution.value;
    state.params.customWidth = parseInt(dom.paramWidth.value, 10) || 1024;
    state.params.customHeight = parseInt(dom.paramHeight.value, 10) || 1024;
    state.params.quality = dom.paramQuality.value;
    state.params.output_format = dom.paramFormat.value;
    state.params.n = parseInt(dom.paramN.value, 10) || 1;
    ns.syncSizeModeUI();
    ns.updateSizePreview();
    ns.updateSizeStatus();
    sessionStorage.setItem("params", JSON.stringify(state.params));
  };

  // --- Custom size validation ---
  var SIZE_MIN = 64, SIZE_MAX = 8192;

  ns.validateCustomSize = function (w, h) {
    if (w < SIZE_MIN || w > SIZE_MAX || h < SIZE_MIN || h > SIZE_MAX) {
      return { ok: false, reason: "out-of-range" };
    }
    if (w % 64 !== 0 || h % 64 !== 0) {
      return { ok: false, reason: "not-multiple" };
    }
    return { ok: true };
  };

  ns.updateSizeStatus = function () {
    var el = dom.sizeStatus;
    if (!el || state.params.sizeMode !== "custom") { if (el) el.className = "size-status"; return; }
    var w = parseInt(dom.paramWidth.value, 10);
    var h = parseInt(dom.paramHeight.value, 10);
    if (isNaN(w) || isNaN(h) || w < SIZE_MIN || w > SIZE_MAX || h < SIZE_MIN || h > SIZE_MAX) {
      el.className = "size-status invalid";
      el.textContent = "✗";
      el.title = "尺寸超出 64-8192 范围";
      return;
    }
    if (w % 64 !== 0 || h % 64 !== 0) {
      el.className = "size-status warn";
      el.textContent = "➤";
      el.title = "不符合 64 的倍数，点击修正";
      return;
    }
    el.className = "size-status valid";
    el.textContent = "✓";
    el.title = "";
  };

  ns.fixCustomSize = function () {
    var w = parseInt(dom.paramWidth.value, 10) || 1024;
    var h = parseInt(dom.paramHeight.value, 10) || 1024;
    dom.paramWidth.value = Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(w / 64) * 64));
    dom.paramHeight.value = Math.min(SIZE_MAX, Math.max(SIZE_MIN, Math.round(h / 64) * 64));
    ns.readParamsFromUI();
    ns.updateSizeStatus();
  };
})(window.App);
