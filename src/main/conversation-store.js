const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const CONV_DIR = path.join(__dirname, "..", "..", "run", "conversations");

function ensureDir() {
  if (!fs.existsSync(CONV_DIR)) {
    fs.mkdirSync(CONV_DIR, { recursive: true });
  }
}

function makeId() {
  return crypto.randomUUID();
}

function indexPath() {
  return path.join(CONV_DIR, "index.json");
}

function convFilePath(id) {
  return path.join(CONV_DIR, `${id}.json`);
}

function readIndex() {
  ensureDir();
  try {
    return JSON.parse(fs.readFileSync(indexPath(), "utf-8"));
  } catch {
    return [];
  }
}

function writeIndex(list) {
  ensureDir();
  fs.writeFileSync(indexPath(), JSON.stringify(list, null, 2), "utf-8");
}

// --- Public API ---

function list() {
  return readIndex();
}

function get(id) {
  try {
    const conv = JSON.parse(fs.readFileSync(convFilePath(id), "utf-8"));
    // Sanitize: clear stale transient state and deprecated fields
    for (const turn of conv.turns || []) {
      // Migrate old format: text/params/uploadedImages were at turn level
      if (turn.text) {
        for (const branch of turn.branches || []) {
          if (!branch.text) {
            branch.text = turn.text;
            branch.params = { ...turn.params };
            branch.uploadedImages = [...(turn.uploadedImages || [])];
          }
        }
        delete turn.text;
        delete turn.params;
        delete turn.uploadedImages;
      }
      // Clean up deprecated fields
      for (const branch of turn.branches || []) {
        delete branch.loading;
        if (branch.params) delete branch.params.n;
      }
    }
    return conv;
  } catch {
    return null;
  }
}

function create() {
  const id = makeId();
  const now = Date.now();
  const conv = {
    id,
    title: "新对话",
    createdAt: now,
    updatedAt: now,
    turns: [],
  };
  ensureDir();
  fs.writeFileSync(convFilePath(id), JSON.stringify(conv, null, 2), "utf-8");

  const index = readIndex();
  index.unshift({ id, title: conv.title, createdAt: now, updatedAt: now });
  writeIndex(index);

  return conv;
}

function save(conv) {
  ensureDir();

  // Deep clone so we don't mutate the caller's in-memory object
  const clean = JSON.parse(JSON.stringify(conv));
  clean.updatedAt = Date.now();

  // Strip transient UI state and deprecated fields
  for (const turn of clean.turns || []) {
    // Migrate old format: text/params/uploadedImages at turn level → copy to branches
    if (turn.text) {
      for (const branch of turn.branches || []) {
        if (!branch.text) {
          branch.text = turn.text;
          branch.params = { ...turn.params };
          branch.uploadedImages = [...(turn.uploadedImages || [])];
        }
      }
      delete turn.text;
      delete turn.params;
      delete turn.uploadedImages;
    }
    for (const branch of turn.branches || []) {
      delete branch.loading;
      if (branch.params) delete branch.params.n;
    }
  }

  fs.writeFileSync(convFilePath(clean.id), JSON.stringify(clean, null, 2), "utf-8");

  const index = readIndex();
  const entry = index.find((e) => e.id === clean.id);
  if (entry) {
    entry.title = clean.title;
    entry.updatedAt = clean.updatedAt;
  }
  writeIndex(index);
}

function remove(id) {
  // Delete conversation JSON
  const filePath = convFilePath(id);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  // Delete conversation image directory
  const imgDir = path.join(CONV_DIR, id);
  if (fs.existsSync(imgDir)) {
    fs.rmSync(imgDir, { recursive: true, force: true });
  }
  const index = readIndex().filter((e) => e.id !== id);
  writeIndex(index);
}

function rename(id, title) {
  const conv = get(id);
  if (!conv) return null;
  conv.title = title;
  save(conv);
  return conv;
}

module.exports = { list, get, create, save, remove, rename };
