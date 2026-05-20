// ============================================================
// Providers — 提供方管理
// ============================================================
window.App = window.App || {};

(function (ns) {
  var state = ns.state;
  var dom = ns.dom;

  ns.loadProviders = async function () {
    state.providers = (await window.electronAPI.listProviders()) || [];
    ns.renderProviderSelect();
  };

  ns.renderProviderSelect = function () {
    dom.providerSelect.innerHTML = "";
    if (state.providers.length === 0) {
      dom.providerSelect.innerHTML = '<option value="">— 未配置提供方 —</option>';
      return;
    }
    state.providers.forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name + (p.isActive ? " ✓" : "");
      if (p.isActive) opt.selected = true;
      dom.providerSelect.appendChild(opt);
    });
  };
})(window.App);
