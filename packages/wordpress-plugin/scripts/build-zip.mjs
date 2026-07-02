#!/usr/bin/env node
/**
 * Package the plugin for distribution / wordpress.org submission:
 * dist/clanker-support-<version>.zip with a single `clanker-support/` folder
 * at the zip root (the layout WordPress expects on upload).
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pluginDir = join(root, "clanker-support");
const distDir = join(root, "dist");
const stageDir = join(distDir, "stage");

const mainFile = readFileSync(join(pluginDir, "clanker-support.php"), "utf8");
const version = mainFile.match(/^\s*\*\s*Version:\s*(\S+)/m)?.[1];
if (!version) {
	console.error("Could not read the plugin version from clanker-support.php");
	process.exit(1);
}

const zipName = `clanker-support-${version}.zip`;
const zipPath = join(distDir, zipName);

rmSync(distDir, { recursive: true, force: true });
mkdirSync(stageDir, { recursive: true });
cpSync(pluginDir, join(stageDir, "clanker-support"), { recursive: true });

// `zip` on macOS/Linux; bsdtar covers Windows (Compress-Archive writes
// backslash entry paths that WordPress can't extract).
try {
	execFileSync("zip", ["-rq", zipPath, "clanker-support"], { cwd: stageDir });
} catch {
	execFileSync("bsdtar", ["-a", "-cf", zipPath, "clanker-support"], {
		cwd: stageDir,
	});
}

rmSync(stageDir, { recursive: true, force: true });
console.log(`Built ${zipPath}`);
