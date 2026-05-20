// ============================================================
// Utils — 纯工具函数、图片辅助、草稿管理
// ============================================================
window.App = window.App || {};

(function (ns) {
  var state = ns.state;
  var dom = ns.dom;

  // --- Basic utilities ---
  ns.scrollToBottom = function () {
    requestAnimationFrame(function () {
      dom.chatMessages.scrollTop = dom.chatMessages.scrollHeight;
    });
  };

  ns.autoResize = function (textarea) {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + "px";
  };

  // --- Image helpers ---
  ns.imageUrl = function (img, convId) {
    if (img.b64_json) return "data:image/png;base64," + img.b64_json;
    if (img.fileName && convId) return "local-img://" + convId + "/" + img.fileName;
    if (img.path) return "file://" + img.path.replace(/\\/g, "/");
    return "";
  };

  ns.getImageTempPath = async function (img, convId) {
    if (!img) return null;
    if (img.fileName && convId) {
      var result = await window.electronAPI.resolveImagePath(convId, img.fileName);
      if (result.success) return result.filePath;
    }
    if (img.b64_json) {
      var result = await window.electronAPI.saveTempImage(img.b64_json);
      if (result.success) return result.filePath;
    }
    return null;
  };

  // --- Turn/branch navigation helpers ---
  ns.getLastTurn = function () {
    var conv = state.activeConv;
    if (!conv || conv.turns.length === 0) return null;
    return conv.turns[conv.turns.length - 1];
  };

  ns.getSelectedImage = function (turn) {
    if (!turn) return null;
    var branch = turn.branches[turn.activeBranchIndex];
    if (!branch || !branch.images || branch.images.length === 0) return null;
    return branch.images.find(function (img) { return img.isSelected; }) || branch.images[0];
  };

  ns.turnHasDownstreamDep = function (conv, turnIndex) {
    if (!conv) return false;
    for (var i = turnIndex + 1; i < conv.turns.length; i++) {
      var turn = conv.turns[i];
      for (var j = 0; j < turn.branches.length; j++) {
        var branch = turn.branches[j];
        if (branch.uploadedImages && branch.uploadedImages.some(function (u) {
          return u.fromGenerated && u.sourceTurnIndex === turnIndex;
        })) {
          return true;
        }
      }
    }
    return false;
  };

  // --- Drafts ---
  ns.saveDraft = function (convId) {
    if (!convId) return;
    state.drafts[convId] = {
      text: dom.textInput.value,
      uploadedImages: state.uploadedImages.map(function (i) { return { id: i.id, path: i.path }; }),
      params: Object.assign({}, state.params),
    };
  };

  ns.loadDraft = function (convId) {
    var draft = state.drafts[convId];
    ns.clearUploadedImages();
    ns.cancelRewrite();

    if (draft) {
      dom.textInput.value = draft.text;
      ns.autoResize(dom.textInput);
      draft.uploadedImages.forEach(function (i) { state.uploadedImages.push({ id: i.id, path: i.path }); });
      ns.renderInputImages();
      Object.assign(state.params, draft.params);
      ns.syncParamsUI();
    } else {
      dom.textInput.value = "";
      ns.autoResize(dom.textInput);
    }
  };

  ns.cancelRewrite = function () {
    state.rewriteMode = false;
    state.rewriteTurnIndex = -1;
    dom.rewriteIndicator.classList.add("hidden");
  };

  // --- View switching ---
  ns.showChatView = function () {
    dom.emptyState.classList.add("hidden");
    dom.chatView.classList.remove("hidden");
  };

  ns.updateChatHeader = function () {
    if (state.activeConv) dom.convTitle.textContent = state.activeConv.title;
  };

  // --- Persistence ---
  ns.saveConv = async function () {
    if (state.activeConv) {
      await window.electronAPI.saveConversation(state.activeConv);
    }
  };

  ns.saveProviders = async function () {
    await window.electronAPI.saveProviders(state.providers);
    ns.renderProviderSelect();
  };

  // --- Uploaded images rendering (needed by drafts) ---
  ns.renderInputImages = function () {
    dom.inputImages.innerHTML = "";
    state.uploadedImages.forEach(function (img, i) {
      var thumb = document.createElement("div");
      thumb.className = "input-image-thumb";
      var imgEl = document.createElement("img");
      imgEl.src = "file://" + img.path.replace(/\\/g, "/");
      thumb.appendChild(imgEl);
      var remove = document.createElement("button");
      remove.className = "img-remove";
      remove.textContent = "✕";
      remove.addEventListener("click", function () { ns.removeUploadedImage(i); });
      thumb.appendChild(remove);
      dom.inputImages.appendChild(thumb);
    });
  };

  ns.clearUploadedImages = function () {
    state.uploadedImages = [];
    ns.renderInputImages();
  };
})(window.App);
