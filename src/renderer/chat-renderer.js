// ============================================================
// Chat Renderer — 对话渲染引擎
// ============================================================
window.App = window.App || {};

(function (ns) {
  var state = ns.state;
  var dom = ns.dom;

  ns.renderChat = function () {
    var conv = state.activeConv;
    if (!conv) return;
    ns.updateChatHeader();
    dom.chatMessages.innerHTML = "";
    var lastTurnIndex = conv.turns.length - 1;
    conv.turns.forEach(function (turn, ti) {
      dom.chatMessages.appendChild(ns.renderTurn(turn, ti, ti === lastTurnIndex));
    });
    ns.scrollToBottom();
  };

  ns.renderTurn = function (turn, turnIndex, isLastTurn) {
    var container = document.createElement("div");
    container.className = "turn";
    container.dataset.turnIndex = turnIndex;

    var activeBranch = turn.branches[turn.activeBranchIndex];

    // --- User bubble ---
    container.appendChild(ns._renderUserBubble(activeBranch, turnIndex));

    // --- Branch bar ---
    container.appendChild(ns._renderBranchBar(turn, turnIndex, isLastTurn, activeBranch));

    // --- Images & loading & error ---
    if (activeBranch) {
      if (activeBranch.images && activeBranch.images.length > 0) {
        var grid = document.createElement("div");
        grid.className = "image-grid";
        activeBranch.images.forEach(function (img, idx) {
          grid.appendChild(
            ns.renderImageCard(img, idx === activeBranch.selectedImageIndex, isLastTurn, turnIndex, idx)
          );
        });
        container.appendChild(grid);
      }

      if (activeBranch.loading) {
        var load = document.createElement("div");
        load.className = "turn-loading";
        load.innerHTML = '<div class="spinner"></div> 生成中...';
        container.appendChild(load);
      }

      if (activeBranch.error) {
        var errEl = document.createElement("div");
        errEl.className = "turn-error";
        errEl.textContent = activeBranch.error;
        container.appendChild(errEl);
      }
    }

    return container;
  };

  ns._renderUserBubble = function (branch, turnIndex) {
    var bubble = document.createElement("div");
    bubble.className = "user-bubble";

    if (branch) {
      var branchUploaded = branch.uploadedImages;
      if (branchUploaded && branchUploaded.length > 0) {
        var imgRow = document.createElement("div");
        imgRow.className = "user-images";
        branchUploaded.forEach(function (img, ui) {
          if (img.fromGenerated && !img.path) return;
          var src = img.path ? "file://" + img.path.replace(/\\/g, "/") : "";
          var el = document.createElement("img");
          if (src) el.src = src;
          el.title = img.isMain ? "主图" : "参考图";
          el.style.cursor = "pointer";
          el.addEventListener("click", function () { ns.openUploadLightbox(turnIndex, ui); });
          imgRow.appendChild(el);
        });
        bubble.appendChild(imgRow);
      }

      var textEl = document.createElement("div");
      textEl.className = "user-text";
      textEl.textContent = branch.text || "";
      bubble.appendChild(textEl);

      var meta = document.createElement("div");
      meta.className = "user-meta";
      var bp = branch.params;
      meta.textContent = (bp ? bp.size || "" : "") + " " + (bp ? bp.quality || "" : "") + " " + (bp ? bp.output_format || "" : "");
      bubble.appendChild(meta);
    }

    bubble.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      e.stopPropagation();
      var t = state.activeConv && state.activeConv.turns[turnIndex];
      if (!t) return;
      var br = t.branches[t.activeBranchIndex];
      var hasSelected = br && br.images && br.images.some(function (i) { return i.isSelected; });
      ns.showPromptMenu(e.clientX, e.clientY, turnIndex, hasSelected);
    });

    return bubble;
  };

  ns._renderBranchBar = function (turn, turnIndex, isLastTurn, activeBranch) {
    var bar = document.createElement("div");
    bar.className = "branch-bar";

    if (turn.branches.length > 0) {
      var nav = document.createElement("span");
      nav.className = "branch-nav";

      var left = document.createElement("span");
      left.className = "nav-arrow" + (turn.activeBranchIndex <= 0 ? " disabled" : "");
      left.textContent = "◀";
      left.addEventListener("click", function () {
        if (turn.activeBranchIndex > 0) ns.switchBranch(turnIndex, turn.activeBranchIndex - 1);
      });
      nav.appendChild(left);

      var label = document.createElement("span");
      label.textContent = (turn.activeBranchIndex + 1) + "/" + turn.branches.length;
      nav.appendChild(label);

      var right = document.createElement("span");
      right.className = "nav-arrow" + (turn.activeBranchIndex >= turn.branches.length - 1 ? " disabled" : "");
      right.textContent = "▶";
      right.addEventListener("click", function () {
        if (turn.activeBranchIndex < turn.branches.length - 1) ns.switchBranch(turnIndex, turn.activeBranchIndex + 1);
      });
      nav.appendChild(right);

      bar.appendChild(nav);
    }

    if (isLastTurn && activeBranch && !activeBranch.loading && !ns.isSending()) {
      var retryBtn = document.createElement("span");
      retryBtn.className = "branch-pill retry";
      retryBtn.textContent = "🔄 重试";
      retryBtn.addEventListener("click", function () { ns.handleRetry(turnIndex); });
      bar.appendChild(retryBtn);
    }

    if (isLastTurn) {
      var rewriteBtn = document.createElement("span");
      rewriteBtn.className = "branch-pill rewrite";
      rewriteBtn.textContent = "✏ 改写";
      rewriteBtn.addEventListener("click", function () { ns.handleRewrite(turnIndex); });
      bar.appendChild(rewriteBtn);
    }

    return bar;
  };

  ns.renderImageCard = function (img, isSelected, canSelect, turnIndex, imgIndex) {
    var card = document.createElement("div");
    card.className = "image-card" + (isSelected ? " selected" : "");
    card.dataset.turnIndex = turnIndex;
    card.dataset.imgIndex = imgIndex;

    var imgEl = document.createElement("img");
    imgEl.src = ns.imageUrl(img, state.activeConvId);
    imgEl.alt = "generated";
    imgEl.draggable = false;
    card.appendChild(imgEl);

    var badge = document.createElement("div");
    badge.className = "img-badge";
    badge.textContent = isSelected ? "✓" : (imgIndex + 1);
    card.appendChild(badge);

    imgEl.addEventListener("click", function (e) {
      if (e.target.closest(".img-badge")) return;
      ns.openLightbox(turnIndex, imgIndex);
    });

    badge.addEventListener("click", function (e) {
      e.stopPropagation();
      if (canSelect) {
        var turn = state.activeConv && state.activeConv.turns[turnIndex];
        var branch = turn && turn.branches[turn.activeBranchIndex];
        if (branch) ns.selectImage(turnIndex, imgIndex, branch.images);
      }
    });

    card.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      e.stopPropagation();
      state.ctxImg = img;
      state.ctxTurnIndex = turnIndex;
      state.ctxImgIndex = imgIndex;
      ns.showCtxMenu(e.clientX, e.clientY);
    });

    return card;
  };
})(window.App);
