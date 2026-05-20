// ============================================================
// Branches — 分支操作：切换、重试、改写、删除、发送到新对话、选中
// ============================================================
window.App = window.App || {};

(function (ns) {
  var state = ns.state;
  var dom = ns.dom;

  // --- Switch branch ---
  ns.switchBranch = function (turnIndex, branchIndex) {
    var turn = state.activeConv && state.activeConv.turns[turnIndex];
    if (!turn) return;
    turn.activeBranchIndex = branchIndex;
    ns.saveConv();
    ns.renderChat();
  };

  // --- Select image ---
  ns.selectImage = function (turnIndex, imgIndex, images) {
    var conv = state.activeConv;
    var turn = conv && conv.turns[turnIndex];
    var branch = turn && turn.branches[turn.activeBranchIndex];
    if (!branch) return;

    var lastTurnIndex = conv.turns.length - 1;
    if (turnIndex !== lastTurnIndex) return;

    branch.selectedImageIndex = imgIndex;
    images.forEach(function (img, i) { img.isSelected = i === imgIndex; });
    ns.saveConv();
    ns.renderChat();
  };

  // --- Retry ---
  ns.handleRetry = async function (turnIndex) {
    var conv = state.activeConv;
    var turn = conv && conv.turns[turnIndex];
    if (!turn) return;

    var branch = turn.branches[turn.activeBranchIndex];
    if (!branch) return;

    delete branch.error;

    ns.setSending(true);
    dom.btnSend.textContent = "■";
    dom.btnSend.classList.add("stop");

    branch.loading = true;
    ns.saveConv();
    ns.renderChat();
    ns.scrollToBottom();

    try {
      var mainPath = null;
      var brUploaded = branch.uploadedImages;
      var fileUpload = brUploaded && brUploaded.find(function (u) { return u.path && !u.fromGenerated; });
      var prevRef = brUploaded && brUploaded.find(function (u) { return u.fromGenerated; });

      if (fileUpload) {
        mainPath = fileUpload.path;
      } else if (prevRef) {
        var srcTurn = conv.turns[prevRef.sourceTurnIndex];
        if (srcTurn) {
          var sel = ns.getSelectedImage(srcTurn);
          if (sel) mainPath = await ns.getImageTempPath(sel, conv.id);
        }
      } else if (branch.images && branch.images.length > 0) {
        mainPath = await ns.getImageTempPath(
          branch.images.find(function (i) { return i.isSelected; }) || branch.images[0],
          conv.id
        );
      }

      var brText = branch.text || "";
      var brParams = branch.params;
      var result;
      if (mainPath) {
        result = await window.electronAPI.editImage(mainPath, brText, {
          size: brParams.size,
          quality: brParams.quality,
          output_format: brParams.output_format,
          n: brParams.n,
        });
      } else {
        result = await window.electronAPI.generateImage(brText, {
          size: brParams.size,
          quality: brParams.quality,
          output_format: brParams.output_format,
          n: brParams.n,
        });
      }

      branch.loading = false;

      if (result.aborted) return;

      if (result.success) {
        var stored = await window.electronAPI.storeImageBatch(conv.id, result.data);
        var newImages = stored.success
          ? stored.images.map(function (s, i) {
              return { index: i, id: ns.uid(), fileName: s.fileName, isSelected: i === 0 };
            })
          : result.data.map(function (d, i) {
              return { index: i, id: ns.uid(), b64_json: d.b64_json, isSelected: i === 0 };
            });

        branch.images.forEach(function (img) { img.isSelected = false; });
        branch.images.unshift.apply(branch.images, newImages);
        branch.selectedImageIndex = 0;
      } else {
        branch.error = result.error;
      }
    } catch (err) {
      branch.loading = false;
      branch.error = err.message;
    } finally {
      ns.setSending(false, conv.id);
      dom.btnSend.textContent = "➤";
      dom.btnSend.classList.remove("stop");
    }

    await window.electronAPI.saveConversation(conv);
    if (state.activeConvId === conv.id) {
      state.activeConv = conv;
      ns.renderChat();
      ns.scrollToBottom();
    } else {
      var success = !branch.error;
      state.unread[conv.id] = { type: success ? "success" : "error" };
      ns.renderConvList();
    }
  };

  // --- Rewrite ---
  ns.handleRewrite = async function (turnIndex) {
    var turn = state.activeConv && state.activeConv.turns[turnIndex];
    if (!turn) return;
    var branch = turn.branches[turn.activeBranchIndex];

    state.rewriteMode = true;
    state.rewriteTurnIndex = turnIndex;

    dom.textInput.value = branch ? branch.text || "" : "";
    ns.autoResize(dom.textInput);

    var bp = branch && branch.params;
    if (bp) {
      Object.assign(state.params, bp);
      ns.syncParamsUI();
    }

    ns.clearUploadedImages();
    var brUploaded = branch ? branch.uploadedImages || [] : [];
    for (var i = 0; i < brUploaded.length; i++) {
      var u = brUploaded[i];
      if (u.path) {
        state.uploadedImages.push({ id: ns.uid(), path: u.path });
      } else if (u.fromGenerated) {
        var conv = state.activeConv;
        if (conv) {
          var srcTurn = conv.turns[u.sourceTurnIndex];
          if (srcTurn) {
            var sel = ns.getSelectedImage(srcTurn);
            if (sel && sel.fileName) {
              var filePath = await ns.getImageTempPath(sel, conv.id);
              if (filePath) state.uploadedImages.push({ id: ns.uid(), path: filePath });
            }
          }
        }
      }
    }
    ns.renderInputImages();

    dom.rewriteIndicator.classList.remove("hidden");
    dom.textInput.focus();
    ns.scrollToBottom();
  };

  // --- Delete branch ---
  ns.handleDeleteBranch = function (turnIndex) {
    var conv = state.activeConv;
    var turn = conv && conv.turns[turnIndex];
    if (!turn) return;

    if (turnIndex < conv.turns.length - 1 && ns.turnHasDownstreamDep(conv, turnIndex)) {
      ns.showToast("该分支的图片被后续轮次用作主图，无法删除", "error");
      return;
    }

    var bi = turn.activeBranchIndex;
    turn.branches.splice(bi, 1);

    if (turn.branches.length === 0) {
      conv.turns.splice(turnIndex, 1);
    } else {
      turn.activeBranchIndex = Math.min(bi, turn.branches.length - 1);
    }

    ns.saveConv();
    ns.renderChat();
    ns.showToast("已删除", "success");
  };

  // --- Send to new conversation ---
  ns.handleSendToNew = async function (turnIndex) {
    var conv = state.activeConv;
    var turn = conv && conv.turns[turnIndex];
    if (!turn) return;
    var branch = turn.branches[turn.activeBranchIndex];

    var newConv = await window.electronAPI.createConversation();

    var draft = {
      text: branch ? branch.text || "" : "",
      uploadedImages: [],
      params: branch ? Object.assign({}, branch.params) : {},
    };

    var srcUploaded = branch ? branch.uploadedImages : null;
    if (srcUploaded && srcUploaded.length > 0) {
      for (var i = 0; i < srcUploaded.length; i++) {
        var u = srcUploaded[i];
        if (u.path) {
          var copied = await window.electronAPI.copyToConv(u.path, newConv.id);
          if (copied.success) {
            draft.uploadedImages.push({ id: ns.uid(), path: copied.filePath });
          }
        } else if (u.fromGenerated) {
          var srcTurn = conv.turns[u.sourceTurnIndex];
          if (srcTurn) {
            var sel = ns.getSelectedImage(srcTurn);
            if (sel && sel.fileName) {
              var srcPath = await ns.getImageTempPath(sel, conv.id);
              if (srcPath) {
                var copied2 = await window.electronAPI.copyToConv(srcPath, newConv.id);
                if (copied2.success) {
                  draft.uploadedImages.push({ id: ns.uid(), path: copied2.filePath });
                }
              }
            }
          }
        }
      }
    } else {
      var prevTurnIdx = turnIndex - 1;
      if (prevTurnIdx >= 0) {
        var prevTurn = conv.turns[prevTurnIdx];
        var sel2 = ns.getSelectedImage(prevTurn);
        if (sel2 && sel2.fileName) {
          var srcPath2 = await ns.getImageTempPath(sel2, conv.id);
          if (srcPath2) {
            var copied3 = await window.electronAPI.copyToConv(srcPath2, newConv.id);
            if (copied3.success) {
              draft.uploadedImages.push({ id: ns.uid(), path: copied3.filePath });
            }
          }
        }
      }
    }

    ns.saveDraft(state.activeConvId);
    state.conversations.unshift({
      id: newConv.id, title: newConv.title,
      createdAt: newConv.createdAt, updatedAt: newConv.updatedAt,
    });
    state.activeConvId = newConv.id;
    state.activeConv = newConv;
    state.rewriteMode = false;
    state.rewriteTurnIndex = -1;

    state.drafts[newConv.id] = draft;
    ns.loadDraft(newConv.id);

    ns.renderConvList();
    ns.renderChat();
    ns.showChatView();
    dom.textInput.focus();
  };
})(window.App);
