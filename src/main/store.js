const fs = require("node:fs");
const path = require("node:path");

function getRunDir() {
  return process.cwd();
}

function getConfigPath() {
  return path.join(getRunDir(), "config.json");
}

function ensureRunDir() {
  const dir = getRunDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function read() {
  try {
    const data = fs.readFileSync(getConfigPath(), "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

function write(data) {
  ensureRunDir();
  fs.writeFileSync(getConfigPath(), JSON.stringify(data, null, 2), "utf-8");
}

module.exports = {
  get(key) {
    return read()[key];
  },
  set(key, value) {
    const config = read();
    config[key] = value;
    write(config);
  },
  getAll() {
    return read();
  },
  reset(keys) {
    const config = read();
    if (Array.isArray(keys)) {
      keys.forEach((k) => delete config[k]);
    } else {
      write({});
      return;
    }
    write(config);
  },
};
