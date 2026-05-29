// ============================================================
// UI — Toast、Alert、Context Menu
// ============================================================
window.App = window.App || {};

(function (ns) {
  var state = ns.state;
  var dom = ns.dom;

  // --- Toast ---
  var toastTimer = null;

  ns.showToast = function (msg, type) {
    var el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      el.style.cssText = [
        "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);",
        "padding:10px 24px;border-radius:8px;font-size:14px;z-index:2000;",
        "background:var(--bg-card);border:1px solid var(--border);",
        "color:var(--text);box-shadow:0 4px 12px rgba(0,0,0,0.3);",
        "transition:opacity 0.2s;",
      ].join("");
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.borderColor = type === "error" ? "var(--red)" : type === "success" ? "var(--green)" : "var(--border)";
    el.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.style.opacity = "0"; }, 3000);
  };

  // --- Alert / Confirm ---
  ns.showConfirm = function (title, msg) {
    dom.alertTitle.textContent = title;
    dom.alertMsg.textContent = msg;
    dom.alertCancel.style.display = "";
    dom.alertModal.classList.remove("hidden");
    return new Promise(function (resolve) {
      dom.alertOk._confirmResolve = resolve;
      dom.alertCancel._confirmResolve = resolve;
    });
  };

  ns.closeAlert = function () {
    dom.alertModal.classList.add("hidden");
    dom.alertOk._confirmResolve = null;
    dom.alertCancel._confirmResolve = null;
  };

  // --- Context menu ---
  ns.showCtxMenu = function (x, y) {
    var menu = dom.ctxMenu;
    menu.innerHTML = "";

    // Save — always shown
    var saveItem = document.createElement("div");
    saveItem.className = "ctx-item";
    saveItem.textContent = "💾 保存到本地";
    saveItem.addEventListener("click", function () { ns.handleCtxAction("save"); });
    menu.appendChild(saveItem);

    // Copy
    var copyItem = document.createElement("div");
    copyItem.className = "ctx-item";
    copyItem.textContent = "📋 复制";
    copyItem.addEventListener("click", function () { ns.handleCtxAction("copy"); });
    menu.appendChild(copyItem);

    // Send to new
    var sendItem = document.createElement("div");
    sendItem.className = "ctx-item";
    sendItem.textContent = "✉ 发送到新对话";
    sendItem.addEventListener("click", function () { ns.handleCtxAction("sendtonew"); });
    menu.appendChild(sendItem);

    // Delete — only show when allowed
    if (!ns.isSending()) {
      var img = state.ctxImg;
      var turnIndex = state.ctxTurnIndex;
      var conv = state.activeConv;
      var turn = conv && conv.turns[turnIndex];
      var branch = turn && turn.branches[turn.activeBranchIndex];
      var canDelete = !img || !img.isSelected || !ns.turnHasDownstreamDep(conv, turnIndex);
      if (canDelete) {
        var delItem = document.createElement("div");
        delItem.className = "ctx-item";
        delItem.textContent = "🗑 删除";
        delItem.addEventListener("click", function () { ns.handleCtxAction("delete"); });
        menu.appendChild(delItem);
      }
    }

    menu.style.left = x + "px";
    menu.style.top = y + "px";
    menu.classList.remove("hidden");
  };

  ns.hideCtxMenu = function () {
    dom.ctxMenu.classList.add("hidden");
    state.ctxImg = null;
    state.ctxTurnIndex = -1;
    state.ctxImgIndex = -1;
  };

  ns.handleCtxAction = async function (action) {
    var img = state.ctxImg;
    var turnIndex = state.ctxTurnIndex;
    var imgIndex = state.ctxImgIndex;
    ns.hideCtxMenu();
    if (!img || turnIndex < 0 || imgIndex < 0) return;

    if (action === "delete" && ns.isSending()) {
      ns.showToast("请求中，不能删除图片", "error");
      return;
    }

    if (action === "save") {
      var b64 = img.b64_json;
      if (!b64 && img.fileName) {
        var res = await window.electronAPI.loadImageBase64(state.activeConvId, img.fileName);
        if (res.success) b64 = res.base64;
      }
      if (b64) {
        await window.electronAPI.saveImageDialog(b64, "gpt-image-" + Date.now() + ".png");
      }
    } else if (action === "copy") {
      var b64 = await ns.getImgBase64(img);
      if (b64) {
        await ns.copyBase64ToClipboard(b64);
      } else {
        ns.showToast("复制失败: 无法读取图片数据", "error");
      }
    } else if (action === "sendtonew") {
      var tempPath = await ns.getImageTempPath(img, state.activeConvId);
      if (!tempPath) { ns.showToast("无法读取图片", "error"); return; }

      var newConv = await window.electronAPI.createConversation();
      ns.saveDraft(state.activeConvId);
      state.conversations.unshift({
        id: newConv.id, title: newConv.title,
        createdAt: newConv.createdAt, updatedAt: newConv.updatedAt,
      });
      state.activeConvId = newConv.id;
      state.activeConv = newConv;
      state.rewriteMode = false;
      state.rewriteTurnIndex = -1;
      delete state._convCache[newConv.id];
      state.drafts[newConv.id] = {
        text: "",
        uploadedImages: [{ id: ns.uid(), path: tempPath }],
        params: {},
      };
      ns.loadDraft(newConv.id);
      ns.renderConvList();
      ns.renderChat();
      ns.showChatView();
      dom.textInput.focus();
    } else if (action === "delete") {
      await ns.deleteImage(turnIndex, imgIndex);
    }
  };

  // --- Prompt right-click menu ---
  ns.showPromptMenu = function (x, y, turnIndex) {
    var menu = dom.ctxMenu;
    menu.innerHTML = "";

    var conv = state.activeConv;
    var canDelete = !conv || turnIndex === conv.turns.length - 1 || !ns.turnHasDownstreamDep(conv, turnIndex);
    if (canDelete) {
      var del = document.createElement("div");
      del.className = "ctx-item";
      del.textContent = "🗑 删除本分支";
      del.addEventListener("click", function () {
        ns.hideCtxMenu();
        ns.handleDeleteBranch(turnIndex);
      });
      menu.appendChild(del);
    }

    var send = document.createElement("div");
    send.className = "ctx-item";
    send.textContent = "✉ 发送到新对话";
    send.addEventListener("click", function () {
      ns.hideCtxMenu();
      ns.handleSendToNew(turnIndex);
    });
    menu.appendChild(send);

    menu.style.left = x + "px";
    menu.style.top = y + "px";
    menu.classList.remove("hidden");
  };
})(window.App);
