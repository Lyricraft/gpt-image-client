// ============================================================
// Send — 发送请求、中止请求
// ============================================================
window.App = window.App || {};

(function (ns) {
  var state = ns.state;
  var dom = ns.dom;

  // --- Sending state ---
  ns.isSending = function () {
    return state.conversationStates[state.activeConvId] && state.conversationStates[state.activeConvId].sending || false;
  };

  ns.setSending = function (v, convId) {
    var id = convId || state.activeConvId;
    if (!id) return;
    if (!state.conversationStates[id]) state.conversationStates[id] = {};
    state.conversationStates[id].sending = v;
    if (v) {
      state._activeRequestConvId = id;
    } else if (state._activeRequestConvId === id) {
      state._activeRequestConvId = null;
    }
    ns.renderConvList();
  };

  // --- Stop ---
  ns.stopRequest = function () {
    var targetConvId = state._activeRequestConvId || state.activeConvId;
    ns.setSending(false, targetConvId);
    dom.btnSend.textContent = "➤";
    dom.btnSend.classList.remove("stop");

    // Clear loading in whichever conversation has the active request
    if (targetConvId === state.activeConvId && state.activeConv) {
      ns._clearLoading(state.activeConv);
      ns.saveConv();
      ns.renderChat();
    } else {
      // Request belongs to another conversation — fetch it and clear loading
      // This handles the edge case where user switched conv during a request
      state.conversationStates[targetConvId] = { sending: false };
    }

    window.electronAPI.abortRequest();
  };

  ns._clearLoading = function (conv) {
    if (!conv) return;
    for (var i = 0; i < conv.turns.length; i++) {
      var turn = conv.turns[i];
      var branch = turn.branches[turn.activeBranchIndex];
      if (branch && branch.loading) {
        branch.loading = false;
      }
    }
  };

  // --- Send ---
  ns.handleSend = async function () {
    var text = dom.textInput.value.trim();
    if (!text || ns.isSending()) return;

    // Validate provider
    if (state.providers.length > 0 && !state.providers.some(function (p) { return p.isActive; })) {
      state.providers[0].isActive = true;
      await ns.saveProviders();
    }
    if (state.providers.length === 0 || !state.providers.some(function (p) { return p.isActive; })) {
      ns.showToast("请先在设置中配置 API 提供方", "error");
      return;
    }

    // If not first turn, no uploaded images, and last branch is empty → prompt
    var lastTurn = ns.getLastTurn();
    var hasUploads = state.uploadedImages.length > 0;
    if (lastTurn && !hasUploads && state.activeConv && state.activeConv.turns.length > 1) {
      var lastBranch = lastTurn.branches[lastTurn.activeBranchIndex];
      if (!lastBranch || !lastBranch.images || lastBranch.images.length === 0) {
        var ok = await ns.showConfirm("图片已清空", "上一轮没有可用图片，是否重新生成新图片？");
        if (!ok) return;
      }
    }

    var _reqConvId;

    ns.setSending(true);
    dom.btnSend.textContent = "■";
    dom.btnSend.classList.add("stop");

    try {
      var isRewrite = state.rewriteMode;
      var rewriteIdx = state.rewriteTurnIndex;

      if (isRewrite) {
        state.rewriteMode = false;
        state.rewriteTurnIndex = -1;
        dom.rewriteIndicator.classList.add("hidden");
      }

      if (!state.activeConv) await ns.newConversation();
      var conv = state.activeConv;
      _reqConvId = conv.id;

      // --- Build uploaded images ---
      var uploadedInTurn = [];
      if (state.uploadedImages.length > 0) {
        uploadedInTurn.push.apply(uploadedInTurn,
          state.uploadedImages.map(function (img, i) {
            return { id: img.id, path: img.path, isMain: i === 0 };
          })
        );
      } else if (!isRewrite && state.activeConv) {
        var prevTurnIdx = state.activeConv.turns.length - 1;
        if (prevTurnIdx >= 0) {
          var prevTurn = state.activeConv.turns[prevTurnIdx];
          var sel = ns.getSelectedImage(prevTurn);
          if (sel) {
            uploadedInTurn.push({
              id: "prev",
              path: null,
              isMain: true,
              fromGenerated: true,
              sourceTurnIndex: prevTurnIdx,
            });
            // Record which branch was active on the source turn
            state.activeConv.turns[prevTurnIdx].selectedBranchIndex = state.activeConv.turns[prevTurnIdx].activeBranchIndex;
          }
        }
      }

      // Copy uploaded files to conv directory
      for (var ui = 0; ui < uploadedInTurn.length; ui++) {
        var u = uploadedInTurn[ui];
        if (u.path && !u.fromGenerated) {
          var res = await window.electronAPI.copyToConv(u.path, conv.id);
          if (res.success) u.path = res.filePath;
        }
      }

      // --- Create turn or branch ---
      var turn, branch, turnIndex;
      if (isRewrite) {
        turnIndex = rewriteIdx;
        turn = conv.turns[turnIndex];

        if (turn.branches.length >= ns.MAX_BRANCHES_PER_TURN) {
          ns.showToast("该轮分支数已达上限 (" + ns.MAX_BRANCHES_PER_TURN + ")", "error");
          ns.setSending(false, _reqConvId);
          dom.btnSend.textContent = "➤";
          dom.btnSend.classList.remove("stop");
          return;
        }

        branch = {
          id: ns.uid(),
          text: text,
          params: ns.buildTurnParams(),
          uploadedImages: uploadedInTurn,
          images: [],
          selectedImageIndex: -1,
          loading: true,
        };
        turn.branches.push(branch);
        turn.activeBranchIndex = turn.branches.length - 1;
      } else {
        branch = {
          id: ns.uid(),
          text: text,
          params: ns.buildTurnParams(),
          uploadedImages: uploadedInTurn,
          images: [],
          selectedImageIndex: -1,
          loading: true,
        };
        turn = {
          id: ns.uid(),
          branches: [branch],
          activeBranchIndex: 0,
        };
        conv.turns.push(turn);
        turnIndex = conv.turns.length - 1;
      }

      dom.textInput.value = "";
      ns.autoResize(dom.textInput);
      ns.clearUploadedImages();
      ns.saveConv();
      ns.renderChat();
      ns.scrollToBottom();

      // --- Determine main image ---
      var mainImagePath = null;
      var fileUploads = uploadedInTurn.filter(function (u) { return u.path && !u.fromGenerated; });
      var prevRef = uploadedInTurn.find(function (u) { return u.fromGenerated; });

      if (prevRef) {
        var srcTurn = conv.turns[prevRef.sourceTurnIndex];
        if (srcTurn) {
          var sel = ns.getSelectedImage(srcTurn);
          if (sel) mainImagePath = await ns.getImageTempPath(sel, conv.id);
        }
      } else if (fileUploads.length > 0) {
        mainImagePath = fileUploads[0].path;
      }

      // --- API call ---
      var result;
      if (mainImagePath) {
        result = await window.electronAPI.editImage(mainImagePath, text, ns.buildApiParams());
      } else {
        result = await window.electronAPI.generateImage(text, ns.buildApiParams());
      }

      branch.loading = false;

      // --- Handle abort — keep branch (no images), user can retry ---
      if (result.aborted) {
        if (state.activeConvId === conv.id) {
          ns.saveConv();
          ns.renderChat();
        }
        return;
      }

      if (result.success) {
        var stored = await window.electronAPI.storeImageBatch(conv.id, result.data);
        if (stored.success) {
          branch.images = stored.images.map(function (s, i) {
            return { index: i, id: ns.uid(), fileName: s.fileName, isSelected: i === 0 };
          });
        } else {
          branch.images = result.data.map(function (d, i) {
            return { index: i, id: ns.uid(), b64_json: d.b64_json, isSelected: i === 0 };
          });
        }
        branch.selectedImageIndex = 0;

        if (conv.title === "新对话" && text.length > 0) {
          var t = text.length > 30 ? text.slice(0, 30) + "…" : text;
          await ns.renameConversation(conv.id, t);
        }
      } else {
        branch.error = result.error;
      }

      await window.electronAPI.saveConversation(conv);
      if (state.activeConvId === conv.id) {
        state.activeConv = conv;
        ns.renderChat();
        ns.scrollToBottom();
      } else {
        state.unread[conv.id] = { type: result.success ? "success" : "error" };
        ns.renderConvList();
      }
    } catch (err) {
      ns.showToast("出错了: " + err.message, "error");
    } finally {
      ns.setSending(false, _reqConvId);
      dom.btnSend.textContent = "➤";
      dom.btnSend.classList.remove("stop");
    }
  };
})(window.App);
