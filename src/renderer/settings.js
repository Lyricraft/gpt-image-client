// ============================================================
// Settings — 设置模态框、提供方编辑器
// ============================================================
window.App = window.App || {};

(function (ns) {
  var state = ns.state;
  var dom = ns.dom;

  // --- Settings modal ---
  ns.openSettings = function () {
    dom.settingsModal.classList.remove("hidden");
    ns.renderProvidersInSettings();
  };

  ns.closeSettings = function () {
    dom.settingsModal.classList.add("hidden");
  };

  ns.renderProvidersInSettings = function () {
    dom.providerList.innerHTML = "";
    if (state.providers.length === 0) {
      dom.providerList.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px 0;">暂无提供方，请添加</div>';
      return;
    }
    state.providers.forEach(function (p, i) {
      var item = document.createElement("div");
      item.className = "provider-item";

      var info = document.createElement("div");
      info.className = "provider-info";
      var name = document.createElement("div");
      name.className = "provider-name";
      name.innerHTML = p.name + (p.isActive ? ' <span class="active-badge">当前</span>' : "");
      info.appendChild(name);
      var url = document.createElement("div");
      url.className = "provider-url";
      url.textContent = p.baseURL || "https://api.openai.com/v1";
      info.appendChild(url);
      item.appendChild(info);

      var actions = document.createElement("div");
      actions.className = "provider-actions";

      var setActive = document.createElement("button");
      setActive.className = "text-btn";
      setActive.textContent = p.isActive ? "✓" : "使用";
      if (!p.isActive) {
        setActive.addEventListener("click", function () { ns.setActiveProvider(i); });
      } else {
        setActive.style.color = "var(--green)";
      }
      actions.appendChild(setActive);

      var edit = document.createElement("button");
      edit.className = "text-btn";
      edit.textContent = "编辑";
      edit.addEventListener("click", function () { ns.openProviderEditor(i); });
      actions.appendChild(edit);

      var del = document.createElement("button");
      del.className = "text-btn";
      del.textContent = "删除";
      del.style.color = "var(--red)";
      del.addEventListener("click", function () { ns.deleteProvider(i); });
      actions.appendChild(del);

      item.appendChild(actions);
      dom.providerList.appendChild(item);
    });
  };

  // --- Provider editor ---
  var _editingProviderIndex = -1;

  ns.openProviderEditor = function (index) {
    _editingProviderIndex = index;
    if (index >= 0 && state.providers[index]) {
      var p = state.providers[index];
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
  };

  ns.closeProviderEditor = function () {
    dom.providerEditor.classList.add("hidden");
    _editingProviderIndex = -1;
  };

  ns.saveProviderFromEditor = function () {
    var name = dom.peName.value.trim();
    var baseURL = dom.peBaseURL.value.trim();
    var apiKey = dom.peApiKey.value.trim();
    if (!name || !apiKey) return ns.showToast("展示名和 API Key 不能为空", "error");

    var provider = {
      id: _editingProviderIndex >= 0 ? state.providers[_editingProviderIndex].id : ns.uid(),
      name: name,
      baseURL: baseURL,
      apiKey: apiKey,
      isActive: _editingProviderIndex >= 0
        ? state.providers[_editingProviderIndex].isActive
        : state.providers.length === 0,
    };
    if (_editingProviderIndex >= 0) {
      state.providers[_editingProviderIndex] = provider;
    } else {
      state.providers.push(provider);
    }
    ns.saveProviders();
    ns.renderProvidersInSettings();
    ns.closeProviderEditor();
    ns.showToast("提供方已保存", "success");
  };

  ns.deleteProvider = async function (index) {
    state.providers.splice(index, 1);
    if (state.providers.length > 0 && !state.providers.some(function (p) { return p.isActive; })) {
      state.providers[0].isActive = true;
    }
    await ns.saveProviders();
    ns.renderProvidersInSettings();
  };

  ns.setActiveProvider = async function (index) {
    state.providers.forEach(function (p, i) { p.isActive = i === index; });
    await ns.saveProviders();
    ns.renderProvidersInSettings();
  };
})(window.App);
