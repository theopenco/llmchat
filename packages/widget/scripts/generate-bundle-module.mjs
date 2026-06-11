import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const src = join(__dirname, "../dist/widget.js");
const dest = join(__dirname, "../dist/widget-string.ts");

const content = readFileSync(src, "utf-8");
const escaped = content.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");

writeFileSync(dest, "// Generated — do not edit\nexport const widgetJs: string = `" + escaped + "`;\n");
console.log("[llmchat] generated dist/widget-string.ts (" + content.length + " bytes)");
