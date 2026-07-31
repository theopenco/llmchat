import { describe, expect, it } from "vitest";

import {
	floatToPcm16Base64,
	frameRms,
	pcm16Base64ToFloat,
	resampleLinear,
	REALTIME_SAMPLE_RATE,
} from "./voice-call";

describe("PCM16 base64 codec", () => {
	it("round-trips samples within quantization error", () => {
		const input = new Float32Array([0, 0.5, -0.5, 1, -1, 0.123, -0.987]);
		const out = pcm16Base64ToFloat(floatToPcm16Base64(input));
		expect(out.length).toBe(input.length);
		for (let i = 0; i < input.length; i++) {
			expect(Math.abs(out[i] - input[i])).toBeLessThan(1 / 0x7fff + 1e-6);
		}
	});

	it("clamps out-of-range samples instead of wrapping", () => {
		// An overdriven mic sample must saturate (±1), never wrap to the
		// opposite sign — a wrap would be an audible full-scale click.
		const out = pcm16Base64ToFloat(
			floatToPcm16Base64(new Float32Array([2.5, -2.5])),
		);
		expect(out[0]).toBeCloseTo(1, 4);
		expect(out[1]).toBeCloseTo(-1, 4);
	});

	it("survives a large buffer (chunked btoa path)", () => {
		// > one 0x8000-byte chunk, exercising the chunked binary-string build.
		const big = new Float32Array(100_000).fill(0.25);
		const out = pcm16Base64ToFloat(floatToPcm16Base64(big));
		expect(out.length).toBe(big.length);
		expect(out[99_999]).toBeCloseTo(0.25, 3);
	});
});

describe("resampleLinear", () => {
	it("is the identity when rates match", () => {
		const input = new Float32Array([0.1, 0.2, 0.3]);
		expect(
			resampleLinear(input, REALTIME_SAMPLE_RATE, REALTIME_SAMPLE_RATE),
		).toBe(input);
	});

	it("halves the sample count when downsampling 48k → 24k", () => {
		const input = new Float32Array(4800).fill(0.5);
		const out = resampleLinear(input, 48_000, 24_000);
		expect(out.length).toBe(2400);
		// A constant signal stays constant through linear interpolation.
		expect(out[0]).toBeCloseTo(0.5, 6);
		expect(out[out.length - 1]).toBeCloseTo(0.5, 6);
	});

	it("preserves the endpoints of a ramp", () => {
		const input = new Float32Array([0, 0.25, 0.5, 0.75, 1]);
		const out = resampleLinear(input, 44_100, 24_000);
		expect(out[0]).toBeCloseTo(0, 6);
		expect(out[out.length - 1]).toBeCloseTo(1, 6);
	});

	it("handles the empty buffer without dividing by zero", () => {
		const out = resampleLinear(new Float32Array(0), 48_000, 24_000);
		expect(out.length).toBe(0);
	});
});

describe("frameRms", () => {
	it("is 0 for silence and empty frames", () => {
		expect(frameRms(new Float32Array(0))).toBe(0);
		expect(frameRms(new Float32Array(512))).toBe(0);
	});

	it("measures a constant signal's level exactly", () => {
		expect(frameRms(new Float32Array(256).fill(0.5))).toBeCloseTo(0.5, 6);
		expect(frameRms(new Float32Array(256).fill(-0.5))).toBeCloseTo(0.5, 6);
	});

	it("separates deliberate speech from quiet echo around the gate level", () => {
		// A full-scale sine (deliberate, close speech) sits at ~0.707 RMS —
		// far above the 0.07 gate; a -32 dBFS-ish murmur sits below it.
		const loud = Float32Array.from({ length: 480 }, (_, i) =>
			Math.sin((i / 480) * 2 * Math.PI * 10),
		);
		expect(frameRms(loud)).toBeGreaterThan(0.07);
		expect(frameRms(new Float32Array(480).fill(0.02))).toBeLessThan(0.07);
	});
});
