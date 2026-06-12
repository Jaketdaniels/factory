export const SEMANTIC_TOKEN_NAMES = [
	"--canvas",
	"--surface",
	"--surface-raised",
	"--border",
	"--border-strong",
	"--text",
	"--muted",
	"--muted-strong",
	"--accent",
	"--accent-hover",
	"--accent-contrast",
	"--accent-wash",
	"--link",
	"--link-hover",
	"--good",
	"--bad",
	"--doctype",
	"--program",
	"--datum",
	"--datum-fresh",
	"--badge",
	"--badge-alert",
	"--badge-good",
	"--badge-info",
	"--focus",
	"--shadow",
	"--font-body",
	"--font-code",
	"--radius-control",
	"--radius-panel",
	"--space-page-x",
	"--space-page-y",
] as const;

export type SemanticTokenName = (typeof SEMANTIC_TOKEN_NAMES)[number];
export type BrandOverlayName = "netm8-parent" | "netm8-feed";

export const BRAND_PRIMITIVES_CSS = `/* Tier 1 - primitives: raw shared ramps. */
:root {
	--font-stack-sans: system-ui, -apple-system, "Segoe UI", sans-serif;
	--font-stack-mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
	--space-1: 0.25rem;
	--space-2: 0.5rem;
	--space-3: 0.75rem;
	--space-4: 1rem;
	--space-5: 1.25rem;
	--space-6: 1.5rem;
	--space-8: 2rem;
	--space-10: 2.5rem;
	--radius-1: 4px;
	--radius-2: 6px;
	--radius-3: 8px;
	--radius-4: 10px;
	--color-feed-canvas: #131210;
	--color-feed-surface: #1b1916;
	--color-feed-border: #2c2822;
	--color-feed-border-strong: #403a32;
	--color-feed-text: #eae6de;
	--color-feed-muted: #a59c8d;
	--color-feed-muted-strong: #c6bdae;
	--color-feed-accent: #d2a44c;
	--color-feed-accent-hover: #e5c078;
	--color-feed-accent-contrast: #1b1607;
	--color-feed-accent-wash: rgba(210, 164, 76, 0.12);
	--color-feed-good: #8fb284;
	--color-feed-bad: #c4806f;
	--color-feed-doctype: #9db3c8;
	--color-feed-program: #9fc0ae;
	--color-parent-canvas: #f4f2ed;
	--color-parent-surface: #faf9f6;
	--color-parent-border: #e0dcd4;
	--color-parent-border-strong: #cbc5ba;
	--color-parent-text: #1e1b16;
	--color-parent-muted: #7a7266;
	--color-parent-muted-strong: #5c554a;
	--color-parent-accent: #0b756f;
	--color-parent-accent-hover: #085e59;
	--color-parent-accent-contrast: #ffffff;
	--color-parent-accent-wash: #e6f4ef;
	--color-parent-good: #5e7d54;
	--color-parent-bad: #a8584a;
	--color-parent-doctype: #56708a;
	--color-parent-program: #4f7a64;
	--color-parent-mark: #b8863b;
}`;

export const SEMANTIC_TOKEN_CONTRACT_CSS = `/* Tier 2 - semantic tokens: components reference intent, never raw ramps. */
:root {
	--canvas: var(--brand-canvas);
	--surface: var(--brand-surface);
	--surface-raised: var(--brand-surface-raised);
	--border: var(--brand-border);
	--border-strong: var(--brand-border-strong);
	--text: var(--brand-text);
	--muted: var(--brand-muted);
	--muted-strong: var(--brand-muted-strong);
	--accent: var(--brand-accent);
	--accent-hover: var(--brand-accent-hover);
	--accent-contrast: var(--brand-accent-contrast);
	--accent-wash: var(--brand-accent-wash);
	--link: var(--brand-link);
	--link-hover: var(--brand-link-hover);
	--good: var(--brand-good);
	--bad: var(--brand-bad);
	--doctype: var(--brand-doctype);
	--program: var(--brand-program);
	--datum: var(--brand-datum);
	--datum-fresh: var(--brand-datum-fresh);
	--badge: var(--brand-badge);
	--badge-alert: var(--brand-badge-alert);
	--badge-good: var(--brand-badge-good);
	--badge-info: var(--brand-badge-info);
	--focus: var(--brand-focus);
	--shadow: var(--brand-shadow);
	--font-body: var(--font-stack-sans);
	--font-code: var(--font-stack-mono);
	--radius-control: var(--radius-2);
	--radius-panel: var(--radius-3);
	--space-page-x: var(--space-5);
	--space-page-y: var(--space-8);
}`;

const BRAND_OVERLAY_CSS: Record<BrandOverlayName, string> = {
	"netm8-parent": `/* Tier 3 - brand overlay: netm8-parent. */
:root[data-brand="netm8-parent"] {
	color-scheme: light;
	--brand-canvas: var(--color-parent-canvas);
	--brand-surface: var(--color-parent-surface);
	--brand-surface-raised: #ffffff;
	--brand-border: var(--color-parent-border);
	--brand-border-strong: var(--color-parent-border-strong);
	--brand-text: var(--color-parent-text);
	--brand-muted: var(--color-parent-muted);
	--brand-muted-strong: var(--color-parent-muted-strong);
	--brand-accent: var(--color-parent-accent);
	--brand-accent-hover: var(--color-parent-accent-hover);
	--brand-accent-contrast: var(--color-parent-accent-contrast);
	--brand-accent-wash: var(--color-parent-accent-wash);
	--brand-link: var(--color-parent-accent);
	--brand-link-hover: var(--color-parent-mark);
	--brand-good: var(--color-parent-good);
	--brand-bad: var(--color-parent-bad);
	--brand-doctype: var(--color-parent-doctype);
	--brand-program: var(--color-parent-program);
	--brand-datum: var(--color-parent-accent);
	--brand-datum-fresh: var(--color-parent-accent-hover);
	--brand-badge: var(--color-parent-muted);
	--brand-badge-alert: var(--color-parent-bad);
	--brand-badge-good: var(--color-parent-good);
	--brand-badge-info: var(--color-parent-doctype);
	--brand-focus: var(--color-parent-accent);
	--brand-shadow: rgba(30, 27, 22, 0.08);
}`,
	"netm8-feed": `/* Tier 3 - brand overlay: netm8-feed. */
:root[data-brand="netm8-feed"] {
	color-scheme: dark;
	--brand-canvas: var(--color-feed-canvas);
	--brand-surface: var(--color-feed-surface);
	--brand-surface-raised: #211f1b;
	--brand-border: var(--color-feed-border);
	--brand-border-strong: var(--color-feed-border-strong);
	--brand-text: var(--color-feed-text);
	--brand-muted: var(--color-feed-muted);
	--brand-muted-strong: var(--color-feed-muted-strong);
	--brand-accent: var(--color-feed-accent);
	--brand-accent-hover: var(--color-feed-accent-hover);
	--brand-accent-contrast: var(--color-feed-accent-contrast);
	--brand-accent-wash: var(--color-feed-accent-wash);
	--brand-link: var(--color-feed-accent);
	--brand-link-hover: var(--color-feed-accent-hover);
	--brand-good: var(--color-feed-good);
	--brand-bad: var(--color-feed-bad);
	--brand-doctype: var(--color-feed-doctype);
	--brand-program: var(--color-feed-program);
	--brand-datum: var(--color-feed-accent);
	--brand-datum-fresh: var(--color-feed-accent-hover);
	--brand-badge: var(--color-feed-muted);
	--brand-badge-alert: var(--color-feed-bad);
	--brand-badge-good: var(--color-feed-good);
	--brand-badge-info: var(--color-feed-doctype);
	--brand-focus: var(--color-feed-accent);
	--brand-shadow: rgba(0, 0, 0, 0.34);
}`,
};

export function brandCss(brand: BrandOverlayName): string {
	return `${BRAND_PRIMITIVES_CSS}

${SEMANTIC_TOKEN_CONTRACT_CSS}

${BRAND_OVERLAY_CSS[brand]}`;
}
