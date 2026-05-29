// ============================================================
// Conversations — 对话 CRUD、切换、图片删除
// ============================================================
window.App = window.App || {};

(function (ns) {
  var state = ns.state;
  var dom = ns.dom;

  // --- Index ---
  ns.loadConversations = async function () {
    state.conversations = await window.electronAPI.listConversations();
    ns.renderConvList();
  };

  ns.renderConvList = function () {
    dom.convList.innerHTML = "";
    if (state.conversations.length === 0) {
      dom.convList.innerHTML = '<div class="conv-item" style="cursor:default;color:var(--text-muted)">暂无对话</div>';
      return;
    }
    state.conversations.forEach(function (c) {
      var div = document.createElement("div");
      div.className = "conv-item" + (c.id === state.activeConvId ? " active" : "");
      div.dataset.id = c.id;

      var title = document.createElement("span");
      title.className = "conv-item-title";
      title.textContent = c.title;
      div.appendChild(title);

      var unread = state.unread[c.id];
      if (unread) {
        var dot = document.createElement("span");
        dot.className = "unread-dot " + unread.type;
        dot.textContent = unread.type === "success" ? "✓" : "✗";
        div.appendChild(dot);
      }

      var del = document.createElement("button");
      del.className = "conv-item-del";
      del.textContent = "✕";
      del.title = "删除对话";
      del.addEventListener("click", function (e) {
        e.stopPropagation();
        ns.deleteConversation(c.id);
      });
      div.appendChild(del);

      div.addEventListener("click", function () { ns.switchConversation(c.id); });
      dom.convList.appendChild(div);
    });
  };

  // --- Switch ---
  var _switching = false;

  ns.switchConversation = async function (id) {
    if (id === state.activeConvId || _switching) return;
    _switching = true;

    try {
      ns.saveDraft(state.activeConvId);
      ns.cancelRewrite();

      // Cache current conv to preserve transient state (loading, etc.)
      if (state.activeConvId && state.activeConv) {
        if (!state._convCache) state._convCache = {};
        state._convCache[state.activeConvId] = state.activeConv;
      }

      state.activeConvId = id;
      state.activeConv = state._convCache && state._convCache[id]
        || await window.electronAPI.getConversation(id);
      state.rewriteMode = false;
      state.rewriteTurnIndex = -1;

      ns.loadDraft(id);

      if (state.unread[id]) {
        delete state.unread[id];
        ns.renderConvList();
      }

      // Update send button based on this conversation's request state
      var convState = state.conversationStates[id];
      if (convState && convState.sending && state._activeRequestConvId === id) {
        dom.btnSend.textContent = "■";
        dom.btnSend.classList.add("stop");
        var turns = state.activeConv && state.activeConv.turns;
        if (turns && turns.length) {
          var lastTurn = turns[turns.length - 1];
          var br = lastTurn.branches[lastTurn.activeBranchIndex];
          if (br && !br.error) br.loading = true;
        }
      } else {
        dom.btnSend.textContent = "➤";
        dom.btnSend.classList.remove("stop");
        // Clean stale sending flag
        if (convState) {
          convState.sending = false;
        }
      }

      ns.renderConvList();
      ns.renderChat();
      ns.scrollToBottom();
      ns.showChatView();
    } finally {
      _switching = false;
    }
  };

  // --- CRUD ---
  ns.newConversation = async function () {
    ns.saveDraft(state.activeConvId);

    var conv = await window.electronAPI.createConversation();
    state.conversations.unshift({
      id: conv.id, title: conv.title, createdAt: conv.createdAt, updatedAt: conv.updatedAt,
    });
    state.activeConvId = conv.id;
    state.activeConv = conv;
    state.rewriteMode = false;
    state.rewriteTurnIndex = -1;
    ns.loadDraft(conv.id);
    dom.btnSend.textContent = "➤";
    dom.btnSend.classList.remove("stop");
    ns.renderConvList();
    ns.renderChat();
    ns.showChatView();
    dom.textInput.focus();
  };

  ns.deleteConversation = async function (id) {
    if (state.activeConvId === id) {
      state.activeConvId = null;
      state.activeConv = null;
      dom.chatView.classList.add("hidden");
      dom.emptyState.classList.remove("hidden");
    }
    await window.electronAPI.deleteConversation(id);
    state.conversations = state.conversations.filter(function (c) { return c.id !== id; });
    // Clean up associated state
    delete state.drafts[id];
    delete state.conversationStates[id];
    delete state.unread[id];
    if (state._convCache) delete state._convCache[id];
    if (state._activeRequestConvId === id) {
      state._activeRequestConvId = null;
    }
    ns.renderConvList();
  };

  ns.renameConversation = async function (id, title) {
    await window.electronAPI.renameConversation(id, title);
    var entry = state.conversations.find(function (c) { return c.id === id; });
    if (entry) entry.title = title;
    if (state.activeConv) state.activeConv.title = title;
    ns.renderConvList();
    ns.updateChatHeader();
  };

  ns.loadActiveConversation = async function () {
    if (state.conversations.length > 0) {
      await ns.switchConversation(state.conversations[0].id);
    }
  };

  // --- Delete image (within conversation) ---
  ns.deleteImage = async function (turnIndex, imgIndex) {
    var conv = state.activeConv;
    var turn = conv && conv.turns[turnIndex];
    var branch = turn && turn.branches[turn.activeBranchIndex];
    if (!branch) return;

    var img = branch.images[imgIndex];
    if (!img) return;

    if (img.isSelected && ns.turnHasDownstreamDep(conv, turnIndex)) {
      ns.showToast("该图片被后续轮次用作主图，无法删除", "error");
      return;
    }

    if (img.fileName) {
      await window.electronAPI.deleteImageFile(conv.id, img.fileName);
    }

    branch.images.splice(imgIndex, 1);

    if (branch.images.length === 0) {
      branch.selectedImageIndex = -1;
    } else if (imgIndex === branch.selectedImageIndex) {
      branch.selectedImageIndex = Math.min(imgIndex, branch.images.length - 1);
      branch.images[branch.selectedImageIndex].isSelected = true;
    } else if (imgIndex < branch.selectedImageIndex) {
      branch.selectedImageIndex--;
    }

    ns.saveConv();
    ns.renderChat();
  };
})(window.App);
