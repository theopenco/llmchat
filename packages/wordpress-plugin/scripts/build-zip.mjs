// Packages the plugin directory into dist/clanker-support.zip — the artifact
// a WordPress site installs via Plugins → Add New → Upload. Run on demand
// (`pnpm --filter @clankersupport/wordpress-plugin package`); intentionally
// not wired to `build` so turbo CI does not depend on a system zip tool.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const pkgRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const distDir = path.join(pkgRoot, "dist");
const zipPath = path.join(distDir, "clanker-support.zip");

if (existsSync(zipPath)) rmSync(zipPath);
mkdirSync(distDir, { recursive: true });

// The zip must contain the `clanker-support/` directory at its root so
// WordPress extracts it as wp-content/plugins/clanker-support.
if (process.platform === "win32") {
	// bsdtar (ships with Windows 10+), not Compress-Archive: the latter writes
	// backslash entry paths, which Linux WordPress hosts extract as literal
	// `\`-in-name files instead of directories. Relative output path: bsdtar
	// parses the `C:` in an absolute path as a remote-host prefix.
	execFileSync(
		"tar.exe",
		["-a", "-cf", "dist/clanker-support.zip", "clanker-support"],
		{ cwd: pkgRoot, stdio: "inherit" },
	);
} else {
	execFileSync("zip", ["-r", zipPath, "clanker-support"], {
		cwd: pkgRoot,
		stdio: "inherit",
	});
}

console.log(`wrote ${zipPath}`);
