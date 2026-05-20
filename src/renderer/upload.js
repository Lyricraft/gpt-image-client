// ============================================================
// Upload — 图片上传、粘贴、拖拽
// ============================================================
window.App = window.App || {};

(function (ns) {
  var state = ns.state;
  var dom = ns.dom;
  var MAX_IMAGES = ns.MAX_IMAGES;

  ns.getMaxUploads = function () {
    var lastTurn = ns.getLastTurn();
    var sel = lastTurn ? ns.getSelectedImage(lastTurn) : null;
    return sel ? MAX_IMAGES - 1 : MAX_IMAGES;
  };

  ns.addUploadedFiles = async function (filePaths) {
    var max = ns.getMaxUploads();
    var remaining = max - state.uploadedImages.length;
    if (remaining <= 0) {
      ns.showToast("最多上传 " + max + " 张图片", "error");
      return;
    }
    filePaths.slice(0, remaining).forEach(function (path) {
      state.uploadedImages.push({ id: ns.uid(), path: path });
    });
    ns.renderInputImages();
    ns.autoSaveDraft();
  };

  ns.addUploadedFileData = async function (dataUrl) {
    var tmpRes = await window.electronAPI.saveTempImage(dataUrl.split(",")[1]);
    if (!tmpRes.success) return;
    await ns.addUploadedFiles([tmpRes.filePath]);
  };

  ns.uploadImages = async function () {
    var result = await window.electronAPI.selectImage();
    if (!result.success) return;
    await ns.addUploadedFiles(result.filePaths);
  };

  ns.removeUploadedImage = function (index) {
    state.uploadedImages.splice(index, 1);
    ns.renderInputImages();
  };
})(window.App);
