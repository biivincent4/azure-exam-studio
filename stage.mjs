import { copyFile, mkdir, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const publicFiles = [
  "index.html", "styles.css", "app.js", "core.js", "questions.js",
  "bank-ai103.js", "bank-ai200.js", "bank-ai500.js", "staticwebapp.config.json",
];
const output = new URL("./.azure-publish/", import.meta.url);
await mkdir(output, { recursive: true });
const unexpected = (await readdir(output)).filter(name => !publicFiles.includes(name));
if (unexpected.length) {
  throw new Error(`Refusing to publish unexpected files in .azure-publish: ${unexpected.join(", ")}`);
}
for (const file of publicFiles) {
  await copyFile(new URL(file, import.meta.url), new URL(file, output));
}
console.log(`Staged ${publicFiles.length} public assets in ${fileURLToPath(output)}`);
