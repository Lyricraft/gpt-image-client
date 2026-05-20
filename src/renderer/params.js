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
    sessionStorage.setItem("params", JSON.stringify(state.params));
  };
})(window.App);
