const { execSync } = require("child_process");
const { version } = require("../package.json");
const zipName = `GPT-Image-Client-${version}-win-x64.zip`;
execSync(`tar -a -cf "../${zipName}" *`, {
  cwd: "out/win-unpacked",
  stdio: "inherit",
  shell: true,
});
