// Derives the parent's light palette from the feed sites' dark palette using
// the Atlassian-style scale model (atlassian.design/foundations/color):
//
//   1. NEUTRALS mirror their ΔL *from the background*, with each mode anchored
//      to its own surface — ink (#131210) for the feeds, paper (L 0.96 at the
//      ink hue) for the parent. Neutral100 ↔ DarkNeutral100, not 1-L.
//   2. CHROMATICS keep their hue and take the most-chromatic tone that still
//      meets WCAG AA (>= 4.5:1) against the light background — the highest
//      usable step, hue alive. (Delta-equal tones would push gold/yellow below
//      L 0.4 where the hue physically leaves sRGB gamut.)
//
// Usage: node sites/netm8/design/mirror-palette.mjs

const DARK = {
	bg: "#131210",
	surface: "#1b1916",
	border: "#2c2822",
	text: "#eae6de",
	muted: "#a59c8d",
};
const CHROMATIC = {
	accent: "#d2a44c",
	good: "#8fb284",
	bad: "#c4806f",
	doctype: "#9db3c8",
	program: "#9fc0ae",
};
const PAPER_L = 0.96; // light-mode background anchor (Atlassian Neutral100 ≈ L 0.96)

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const linearToSrgb = (c) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

function hexToOklab(hex) {
	const n = Number.parseInt(hex.slice(1), 16);
	const [r, g, b] = [16, 8, 0].map((s) => srgbToLinear(((n >> s) & 255) / 255));
	const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
	const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
	const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
	return {
		L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
		a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
		b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
	};
}

function oklabToRgb({ L, a, b }) {
	const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
	const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
	const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
	return [
		4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
		-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
		-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
	];
}

const inGamut = (rgb) => rgb.every((c) => c >= -1e-6 && c <= 1 + 1e-6);
const toHex = (rgb) =>
	`#${rgb
		.map((v) =>
			Math.round(linearToSrgb(Math.min(1, Math.max(0, v))) * 255)
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;

function lchToHex(L, C, H) {
	let c = C;
	let rgb = oklabToRgb({ L, a: c * Math.cos(H), b: c * Math.sin(H) });
	while (!inGamut(rgb) && c > 0.0005) {
		c *= 0.99;
		rgb = oklabToRgb({ L, a: c * Math.cos(H), b: c * Math.sin(H) });
	}
	return toHex(rgb);
}

function lum(hex) {
	const n = Number.parseInt(hex.slice(1), 16);
	const [r, g, b] = [16, 8, 0].map((s) => srgbToLinear(((n >> s) & 255) / 255));
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a, b) => {
	const [hi, lo] = [Math.max(lum(a), lum(b)), Math.min(lum(a), lum(b))];
	return (hi + 0.05) / (lo + 0.05);
};

// 1 — neutrals: mirror ΔL from background, anchored at paper
const inkBg = hexToOklab(DARK.bg);
const light = {};
for (const [name, hex] of Object.entries(DARK)) {
	const { L, a, b } = hexToOklab(hex);
	const dL = L - inkBg.L; // distance above ink
	const C = Math.hypot(a, b);
	const H = Math.atan2(b, a);
	light[name] = lchToHex(PAPER_L - dL, C, H); // same distance below paper
}

// 2 — chromatics: most-chromatic AA tone (highest L with ratio >= 4.5 vs light bg)
function maxChromaAt(L, H, C0 = 0.4) {
	return lchToHex(L, C0, H);
}
for (const [name, hex] of Object.entries(CHROMATIC)) {
	const { a, b } = hexToOklab(hex);
	const H = Math.atan2(b, a);
	let L = 0.75;
	let out = maxChromaAt(L, H);
	while (ratio(out, light.bg) < 4.5 && L > 0.2) {
		L -= 0.005;
		out = maxChromaAt(L, H);
	}
	light[name] = out;
}

console.log("/* light parent tokens — derived, do not hand-edit */");
for (const [name, hex] of Object.entries(light)) {
	const r = ratio(hex, light.bg).toFixed(2);
	console.log(`--${name}: ${hex};  /* ${r}:1 vs bg */`);
}
