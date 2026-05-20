// ============================================================
// Lightbox — 灯箱、图片选择、保存
// ============================================================
window.App = window.App || {};

(function (ns) {
  var state = ns.state;
  var dom = ns.dom;

  var lbState = { images: [], index: 0, canSelect: false, turnIndex: -1 };

  ns.openLightbox = function (turnIndex, imgIndex) {
    var conv = state.activeConv;
    var turn = conv && conv.turns[turnIndex];
    var branch = turn && turn.branches[turn.activeBranchIndex];
    if (!branch || !branch.images || !branch.images.length) return;

    var isLastTurn = turnIndex === conv.turns.length - 1;
    lbState = {
      images: branch.images.map(function (img) { return { img: img, type: "generated" }; }),
      index: imgIndex,
      canSelect: isLastTurn,
      turnIndex: turnIndex,
    };
    ns.renderLightbox();
  };

  ns.openUploadLightbox = function (turnIndex, uploadIndex) {
    var conv = state.activeConv;
    var turn = conv && conv.turns[turnIndex];
    if (!turn) return;
    var branch = turn.branches[turn.activeBranchIndex];
    var src = branch && branch.uploadedImages;
    if (!src || !src.length) return;

    lbState = {
      images: src.map(function (u) { return { img: u, type: "uploaded" }; }),
      index: uploadIndex,
      canSelect: false,
      turnIndex: turnIndex,
    };
    ns.renderLightbox();
  };

  ns.renderLightbox = function () {
    var images = lbState.images;
    var index = lbState.index;
    if (!images || !images.length) return;

    var entry = images[index];
    dom.lightboxImg.src = ns.imageUrl(entry.img, state.activeConvId);

    dom.lbCounter.textContent = (index + 1) + "/" + images.length;
    dom.lbPrev.style.display = images.length > 1 ? "" : "none";
    dom.lbNext.style.display = images.length > 1 ? "" : "none";

    if (lbState.canSelect && entry.type === "generated") {
      dom.lbSelectBtn.classList.remove("hidden");
      var turn = state.activeConv && state.activeConv.turns[lbState.turnIndex];
      var branch = turn && turn.branches[turn.activeBranchIndex];
      var img = branch && branch.images[index];
      var selected = img && img.isSelected;
      dom.lbSelectBtn.textContent = selected ? "已选中" : "选中";
      dom.lbSelectBtn.className = "lb-sel-btn" + (selected ? " active" : " inactive");
    } else {
      dom.lbSelectBtn.classList.add("hidden");
    }

    dom.lightbox.classList.remove("hidden");
  };

  ns.closeLightbox = function () {
    dom.lightbox.classList.add("hidden");
    lbState = { images: [], index: 0, canSelect: false, turnIndex: -1 };
  };

  ns.lbNavigate = function (dir) {
    var images = lbState.images;
    var index = lbState.index;
    if (!images || !images.length) return;
    var newIdx = index + dir;
    if (newIdx < 0 || newIdx >= images.length) return;
    lbState.index = newIdx;
    ns.renderLightbox();
  };

  ns.lbSelectImage = function () {
    if (!lbState.canSelect) return;
    var turn = state.activeConv && state.activeConv.turns[lbState.turnIndex];
    var branch = turn && turn.branches[turn.activeBranchIndex];
    var img = branch && branch.images[lbState.index];
    if (!img || img.isSelected) return;
    branch.images.forEach(function (im, i) { im.isSelected = i === lbState.index; });
    branch.selectedImageIndex = lbState.index;
    ns.saveConv();

    // Re-render lightbox select button state instead of full renderLightbox to avoid flash
    dom.lbSelectBtn.textContent = "已选中";
    dom.lbSelectBtn.className = "lb-sel-btn active";
  };

  ns.saveLightboxImage = async function () {
    var entry = lbState.images[lbState.index];
    if (!entry) { ns.showToast("没有可保存的图片", "error"); return; }
    var img = entry.img;
    if (!img.fileName && !img.b64_json && !img.path) {
      ns.showToast("图片数据不完整，无法保存", "error");
      return;
    }
    var b64 = img.b64_json;
    if (!b64 && img.fileName) {
      if (!state.activeConvId) { ns.showToast("未选择对话", "error"); return; }
      var res = await window.electronAPI.loadImageBase64(state.activeConvId, img.fileName);
      if (res.success) { b64 = res.base64; }
      else { ns.showToast("读取图片文件失败: " + (res.error || "未知错误"), "error"); return; }
    }
    if (!b64 && img.path) {
      var res2 = await window.electronAPI.readFileBase64(img.path);
      if (res2.success) { b64 = res2.base64; }
      else { ns.showToast("读取图片路径失败: " + (res2.error || "未知错误"), "error"); return; }
    }
    if (b64) {
      await window.electronAPI.saveImageDialog(b64, "gpt-image-" + Date.now() + ".png");
    }
  };
})(window.App);
