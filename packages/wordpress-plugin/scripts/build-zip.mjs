#!/usr/bin/env node
/**
 * Package the plugin for distribution / wordpress.org submission:
 * dist/clanker-support-<version>.zip with a single `clanker-support/` folder
 * at the zip root (the layout WordPress expects on upload).
 *
 * The zip is written directly in Node. Every native Windows option fails in
 * its own way — there is no zip CLI, tar.exe cannot write zip format (with
 * `-a` it silently emits a TAR named .zip, which wordpress.org rejects as
 * "the plugin has no name"), and both Compress-Archive and .NET Framework's
 * ZipFile store backslash entry paths that Linux hosts extract as literal
 * `\`-in-name files. Writing the format ourselves gives one deterministic
 * code path on every OS.
 */
import {
	mkdirSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { crc32, deflateRawSync } from "node:zlib";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pluginDir = join(root, "clanker-support");
const distDir = join(root, "dist");

const mainFile = readFileSync(join(pluginDir, "clanker-support.php"), "utf8");
const version = mainFile.match(/^\s*\*\s*Version:\s*(\S+)/m)?.[1];
if (!version) {
	console.error("Could not read the plugin version from clanker-support.php");
	process.exit(1);
}

const zipName = `clanker-support-${version}.zip`;
const zipPath = join(distDir, zipName);

/** Collect files under `dir` as sorted zip entry names ("clanker-support/…"). */
function collect(dir, prefix) {
	const out = [];
	for (const name of readdirSync(dir).sort()) {
		const abs = join(dir, name);
		if (statSync(abs).isDirectory()) {
			out.push(...collect(abs, `${prefix}${name}/`));
		} else {
			out.push({ entryName: `${prefix}${name}`, abs });
		}
	}
	return out;
}

function dosDateTime(mtime) {
	const d = new Date(mtime);
	return {
		time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
		date:
			((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
	};
}

/** Minimal zip writer: local headers + central directory + EOCD. */
function writeZip(entries, outPath) {
	const locals = [];
	const centrals = [];
	let offset = 0;

	for (const { entryName, abs } of entries) {
		const data = readFileSync(abs);
		const crc = crc32(data) >>> 0;
		const deflated = deflateRawSync(data, { level: 9 });
		const stored = deflated.length >= data.length;
		const payload = stored ? data : deflated;
		const method = stored ? 0 : 8;
		const name = Buffer.from(entryName, "utf8");
		const { time, date } = dosDateTime(statSync(abs).mtimeMs);

		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0); // local file header signature
		local.writeUInt16LE(20, 4); // version needed to extract
		local.writeUInt16LE(0, 6); // flags
		local.writeUInt16LE(method, 8);
		local.writeUInt16LE(time, 10);
		local.writeUInt16LE(date, 12);
		local.writeUInt32LE(crc, 14);
		local.writeUInt32LE(payload.length, 18);
		local.writeUInt32LE(data.length, 22);
		local.writeUInt16LE(name.length, 26);
		local.writeUInt16LE(0, 28); // extra field length
		locals.push(local, name, payload);

		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0); // central directory signature
		central.writeUInt16LE(20, 4); // version made by
		central.writeUInt16LE(20, 6); // version needed
		central.writeUInt16LE(0, 8); // flags
		central.writeUInt16LE(method, 10);
		central.writeUInt16LE(time, 12);
		central.writeUInt16LE(date, 14);
		central.writeUInt32LE(crc, 16);
		central.writeUInt32LE(payload.length, 20);
		central.writeUInt32LE(data.length, 24);
		central.writeUInt16LE(name.length, 28);
		// extra/comment/disk/attrs all zero (Buffer.alloc), offset at 42
		central.writeUInt32LE(offset, 42);
		centrals.push(central, name);

		offset += local.length + name.length + payload.length;
	}

	const centralStart = offset;
	const centralSize = centrals.reduce((n, b) => n + b.length, 0);
	const eocd = Buffer.alloc(22);
	eocd.writeUInt32LE(0x06054b50, 0); // end of central directory signature
	eocd.writeUInt16LE(entries.length, 8);
	eocd.writeUInt16LE(entries.length, 10);
	eocd.writeUInt32LE(centralSize, 12);
	eocd.writeUInt32LE(centralStart, 16);

	writeFileSync(outPath, Buffer.concat([...locals, ...centrals, eocd]));
}

rmSync(distDir, { recursive: true, force: true });
mkdirSync(distDir, { recursive: true });
const entries = collect(pluginDir, "clanker-support/");
writeZip(entries, zipPath);

// Belt and braces: reject the artifact if it somehow isn't zip format.
const magic = readFileSync(zipPath).subarray(0, 4);
if (
	!(magic[0] === 0x50 && magic[1] === 0x4b && magic[2] === 3 && magic[3] === 4)
) {
	console.error(`${zipName} is not a valid zip (bad magic bytes)`);
	process.exit(1);
}

console.log(`Built ${zipPath} (${entries.length} files)`);
