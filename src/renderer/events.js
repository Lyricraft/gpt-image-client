// ============================================================
// Events — 事件绑定和初始化
// ============================================================
window.App = window.App || {};

(function (ns) {
  var state = ns.state;
  var dom = ns.dom;

  ns.bindEvents = function () {
    // Send / Stop
    dom.btnSend.addEventListener("click", function () {
      if (ns.isSending()) {
        ns.stopRequest();
      } else {
        ns.handleSend();
      }
    });

    // Text input: Enter to send, Shift/Ctrl/Alt+Enter for newline
    dom.textInput.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.isComposing) {
        e.preventDefault();
        ns.handleSend();
        return;
      }
      if (e.key === "Enter" && (e.shiftKey || e.ctrlKey || e.altKey)) {
        e.preventDefault();
        var ta = dom.textInput;
        var start = ta.selectionStart;
        var end = ta.selectionEnd;
        ta.value = ta.value.substring(0, start) + "\n" + ta.value.substring(end);
        ta.selectionStart = ta.selectionEnd = start + 1;
        ns.autoResize(ta);
      }
    });

    dom.textInput.addEventListener("input", function () {
      ns.autoResize(dom.textInput);
    });

    // Upload
    dom.btnUpload.addEventListener("click", ns.uploadImages);

    // Drag & drop onto input area
    var inputArea = dom.textInput.closest(".input-area");
    if (inputArea) {
      inputArea.addEventListener("dragover", function (e) {
        if (e.dataTransfer && e.dataTransfer.types.indexOf("Files") >= 0) {
          e.preventDefault();
          inputArea.classList.add("drag-over");
        }
      });
      inputArea.addEventListener("dragleave", function () {
        inputArea.classList.remove("drag-over");
      });
      inputArea.addEventListener("drop", async function (e) {
        e.preventDefault();
        inputArea.classList.remove("drag-over");
        var paths = [];
        for (var fi = 0; fi < (e.dataTransfer && e.dataTransfer.files.length || 0); fi++) {
          var file = e.dataTransfer.files[fi];
          if (file.type.startsWith("image/")) {
            var fp = window.electronAPI.getFilePath(file);
            if (fp) paths.push(fp);
          }
        }
        if (paths.length) await ns.addUploadedFiles(paths);
      });
    }

    // Paste image
    dom.textInput.addEventListener("paste", async function (e) {
      var items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (var pi = 0; pi < items.length; pi++) {
        var item = items[pi];
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          if (item.kind === "file") {
            var file = item.getAsFile();
            var fpath = file && window.electronAPI.getFilePath(file);
            if (fpath) {
              await ns.addUploadedFiles([fpath]);
            } else if (file) {
              var b64 = await new Promise(function (r) {
                var fr = new FileReader();
                fr.onload = function () { r(fr.result.split(",")[1]); };
                fr.readAsDataURL(file);
              });
              var tmp = await window.electronAPI.saveTempImage(b64);
              if (tmp.success) await ns.addUploadedFiles([tmp.filePath]);
            }
          } else {
            var dataUrl = await new Promise(function (r) { item.getAsString(r); });
            await ns.addUploadedFileData(dataUrl);
          }
          return;
        }
      }
    });

    // Params panel
    dom.btnToggleParams.addEventListener("click", function () {
      dom.paramsPanel.classList.toggle("hidden");
    });
    dom.btnToggleSizeMode.addEventListener("click", function () {
      state.params.sizeMode = state.params.sizeMode === "preset" ? "custom" : "preset";
      ns.syncSizeModeUI();
      ns.readParamsFromUI();
    });
    dom.btnToggleOrientation.addEventListener("click", function () {
      var next = ns.RATIO_MAP[state.params.ratio];
      if (next) {
        state.params.ratio = next;
      } else {
        ns._orientLand = !ns._orientLand;
      }
      ns.syncParamsUI();
      ns.readParamsFromUI();
    });
    dom.paramRatio.addEventListener("change", ns.readParamsFromUI);
    dom.paramResolution.addEventListener("change", ns.readParamsFromUI);
    dom.paramWidth.addEventListener("change", ns.readParamsFromUI);
    dom.paramHeight.addEventListener("change", ns.readParamsFromUI);
    dom.paramQuality.addEventListener("change", ns.readParamsFromUI);
    dom.paramFormat.addEventListener("change", ns.readParamsFromUI);
    dom.paramN.addEventListener("change", ns.readParamsFromUI);

    // New conversation
    dom.btnNewConv.addEventListener("click", ns.newConversation);

    // Cancel rewrite
    dom.btnCancelRewrite.addEventListener("click", function () {
      ns.cancelRewrite();
      dom.textInput.value = "";
      ns.autoResize(dom.textInput);
      ns.clearUploadedImages();
    });

    // Provider select in header
    dom.providerSelect.addEventListener("change", function (e) {
      var id = e.target.value;
      state.providers.forEach(function (p) { p.isActive = p.id === id; });
      ns.saveProviders();
      ns.renderProviderSelect();
    });

    // Settings
    dom.btnSettings.addEventListener("click", ns.openSettings);
    dom.settingsModal.querySelectorAll(".modal-close").forEach(function (btn) {
      btn.addEventListener("click", ns.closeSettings);
    });
    dom.settingsModal.addEventListener("click", function (e) {
      if (e.target === dom.settingsModal) ns.closeSettings();
    });

    // Settings tabs
    dom.settingsModal.querySelectorAll(".modal-tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        dom.settingsModal.querySelectorAll(".modal-tab").forEach(function (t) { t.classList.remove("active"); });
        dom.settingsModal.querySelectorAll(".modal-tab-content").forEach(function (c) { c.classList.remove("active"); });
        tab.classList.add("active");
        var targetId = "settings" + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1);
        document.getElementById(targetId).classList.add("active");
      });
    });

    // Provider editor
    dom.btnAddProvider.addEventListener("click", function () { ns.openProviderEditor(-1); });
    dom.btnSaveProvider.addEventListener("click", ns.saveProviderFromEditor);
    dom.providerEditor.querySelectorAll(".modal-close").forEach(function (btn) {
      btn.addEventListener("click", ns.closeProviderEditor);
    });
    dom.providerEditor.addEventListener("click", function (e) {
      if (e.target === dom.providerEditor) ns.closeProviderEditor();
    });

    // Prefs
    dom.btnSavePrefs.addEventListener("click", async function () {
      await window.electronAPI.setConfig("timeout", (parseInt(dom.prefTimeout.value, 10) || 600) * 1000);
      ns.showToast("偏好已保存", "success");
    });

    // Lightbox
    dom.lightbox.addEventListener("click", function (e) {
      if (e.target === dom.lightbox || e.target.classList.contains("lightbox-close")) {
        ns.closeLightbox();
      }
    });
    dom.lbPrev.addEventListener("click", function () { ns.lbNavigate(-1); });
    dom.lbNext.addEventListener("click", function () { ns.lbNavigate(1); });
    dom.lbSelectBtn.addEventListener("click", ns.lbSelectImage);
    dom.btnSaveImage.addEventListener("click", ns.saveLightboxImage);
    document.addEventListener("keydown", function (e) {
      if (dom.lightbox.classList.contains("hidden")) return;
      if (e.key === "ArrowLeft") ns.lbNavigate(-1);
      if (e.key === "ArrowRight") ns.lbNavigate(1);
    });

    // Context menu
    document.addEventListener("click", function (e) {
      if (!dom.ctxMenu.contains(e.target)) ns.hideCtxMenu();
    });
    document.addEventListener("contextmenu", function (e) {
      if (!e.target.closest(".image-card") && !e.target.closest(".user-bubble")) {
        ns.hideCtxMenu();
      }
    });

    // Alert / Confirm
    dom.alertOk.addEventListener("click", function () {
      if (dom.alertOk._confirmResolve) dom.alertOk._confirmResolve(true);
      ns.closeAlert();
    });
    dom.alertCancel.addEventListener("click", function () {
      if (dom.alertCancel._confirmResolve) dom.alertCancel._confirmResolve(false);
      ns.closeAlert();
    });
    dom.alertModal.addEventListener("click", function (e) {
      if (e.target === dom.alertModal) {
        if (dom.alertOk._confirmResolve) dom.alertOk._confirmResolve(false);
        ns.closeAlert();
      }
    });

    // Conv title inline rename
    dom.convTitle.addEventListener("dblclick", function () {
      var input = document.createElement("input");
      input.type = "text";
      input.value = state.activeConv ? state.activeConv.title : "";
      input.className = "text-input";
      input.style.padding = "2px 8px";
      input.style.fontSize = "15px";
      input.style.width = "200px";
      dom.convTitle.replaceWith(input);
      input.focus();
      input.select();

      function done() {
        var val = input.value.trim() || (state.activeConv ? state.activeConv.title : "") || "新对话";
        input.replaceWith(dom.convTitle);
        if (state.activeConv) ns.renameConversation(state.activeConv.id, val);
      }
      input.addEventListener("blur", done);
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") { e.preventDefault(); input.blur(); }
        if (e.key === "Escape") { input.value = state.activeConv ? state.activeConv.title : ""; input.blur(); }
      });
    });

    // Global Escape
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        ns.closeLightbox();
        ns.closeSettings();
        ns.closeProviderEditor();
        ns.closeAlert();
        ns.hideCtxMenu();
      }
    });
  };

  // --- Init ---
  ns.init = async function () {
    ns.initDom();
    ns.syncParamsUI();
    ns.bindEvents();

    try {
      var saved = JSON.parse(sessionStorage.getItem("params"));
      if (saved) Object.assign(state.params, saved);
    } catch (e) { /* ignore */ }
    ns.syncParamsUI();

    await ns.loadProviders();
    await ns.loadConversations();
    await ns.loadActiveConversation();
  };
})(window.App);

document.addEventListener("DOMContentLoaded", App.init);
