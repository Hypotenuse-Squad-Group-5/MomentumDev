// Themes (Settings › Appearance). Run with: node --test tests/*.test.cjs
// 1. New CSS must use var(--…) for colors and corners, so it follows every theme.
// 2. The theme list is the same in js/theme.js, css/styles.css and migration 031.
// 3. Text stays readable in every theme (contrast checks).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');

const css = fs.readFileSync('css/styles.css', 'utf8');
const themeJs = fs.readFileSync('js/theme.js', 'utf8');

// ---------- helpers ----------
function stripComments(s) { return s.replace(/\/\*[\s\S]*?\*\//g, ''); }
// Split CSS into top-level { selector, body } rules (enough for this file: @media bodies are scanned as text)
function rules(s) {
  const out = []; let depth = 0, start = 0, sel = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '{') { if (depth === 0) { sel = s.slice(start, i).trim(); start = i + 1; } depth++; }
    else if (s[i] === '}') { depth--; if (depth === 0) { out.push({ sel, body: s.slice(start, i) }); start = i + 1; } }
  }
  return out;
}
const all = rules(stripComments(css));
const isThemeBlock = (sel) => /^:root\b|\[data-theme/.test(sel);

function varsOf(sel) {
  const r = all.find((x) => x.sel === sel);
  assert.ok(r, 'missing block ' + sel);
  const v = {};
  for (const m of r.body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) v[m[1]] = m[2].trim();
  return v;
}

// colors -> [r, g, b, a] in 0..1 (sRGB)
function parseColor(c) {
  c = c.trim().toLowerCase();
  let m;
  if ((m = c.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/))) {
    const n = parseInt(m[1], 16);
    return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, m[2] ? parseInt(m[2], 16) / 255 : 1];
  }
  if (c === '#fff') return [1, 1, 1, 1];
  if ((m = c.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+)%)?\s*\)$/))) {
    const L = +m[1], C = +m[2], h = +m[3] * Math.PI / 180;
    const a = C * Math.cos(h), b = C * Math.sin(h);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    const l = l_ ** 3, mm = m_ ** 3, s = s_ ** 3;
    const lin = [4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * mm + 1.7076147010 * s];
    const enc = (x) => { x = Math.min(1, Math.max(0, x)); return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055; };
    return [...lin.map(enc), m[4] ? +m[4] / 100 : 1];
  }
  return null;
}
function luminance([r, g, b]) {
  const f = (x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) { const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); }

const THEMES = [...themeJs.matchAll(/"([a-z]+)":\s*\{\s*name:/g)].map((m) => m[1]);
const DEFAULT_SEL = ':root, [data-theme]';
function themeVars(id) {
  const base = varsOf(DEFAULT_SEL);
  return id === 'default' ? base : { ...base, ...varsOf(`[data-theme="${id}"]`) };
}
function resolve(vars, name, seen = 0) {
  let v = vars[name];
  if (v == null || seen > 5) return null;
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  return ref ? resolve(vars, ref[1], seen + 1) : v;
}

// ---------- 1. no hard-coded values outside the theme blocks ----------
test('styles.css: colors and corners outside the theme blocks use var(--…)', () => {
  const problems = [];
  for (const { sel, body } of all) {
    if (isThemeBlock(sel) && /^(:root|\[data-theme="[a-z]+"\])\s*$|^:root, \[data-theme\]$/.test(sel)) continue; // the value blocks themselves
    const text = sel + '{' + body + '}';
    for (const m of text.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch)\(/g)) problems.push(`${sel.slice(0, 50)} → ${m[0]}`);
    for (const m of body.matchAll(/border-radius\s*:\s*([^;]+)/g)) {
      const v = m[1].trim();
      if (/var\(/.test(v) || /^(inherit|(?:[\d.]+%|0)(?: (?:[\d.]+%|0))*)$/.test(v)) continue;
      problems.push(`${sel.slice(0, 50)} → border-radius: ${v}`);
    }
  }
  assert.deepEqual(problems, [], 'Use a variable from the top of styles.css instead (or add one there):\n' + problems.join('\n'));
});

test('page scripts: no hard-coded colors in inline styles', () => {
  const files = ['js/ui.js', ...fs.readdirSync('js/pages').map((f) => 'js/pages/' + f)];
  const problems = [];
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    for (const m of s.matchAll(/(?:color|background|border|fill|stroke)[\w-]*\s*[:=]\s*["']?\s*(#[0-9a-fA-F]{3,8}\b|(?:rgba?|oklch|hsla?)\()/g)) problems.push(`${f} → ${m[1]}`);
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});

// ---------- 2. one theme list everywhere ----------
test('theme list matches in js/theme.js, styles.css and migration 031', () => {
  assert.deepEqual(THEMES, ['default', 'trailhead', 'pop', 'quiet', 'field']);
  for (const id of THEMES.filter((t) => t !== 'default')) assert.ok(all.some((r) => r.sel === `[data-theme="${id}"]`), `styles.css needs a [data-theme="${id}"] block`);
  const sql = fs.readFileSync('database/031_user_theme.sql', 'utf8');
  const allowed = [...sql.match(/check \(theme in \(([^)]*)\)\)/)[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
  assert.deepEqual(allowed, THEMES);
});

test('every page loads js/theme.js in <head> and no fixed font link', () => {
  for (const f of fs.readdirSync('.').filter((x) => x.endsWith('.html'))) {
    const head = fs.readFileSync(f, 'utf8').split('</head>')[0];
    assert.match(head, /<script src="js\/theme\.js\?v=[\w-]+"><\/script>/, f + ' should load js/theme.js in <head>');
    assert.doesNotMatch(head, /<link[^>]+fonts\.googleapis\.com\/css2/, f + ': fonts come from js/theme.js now');
  }
});

// ---------- 3. readable text in every theme ----------
// [text, background, minimum]. 4.5 = normal text; 3 = big/bold text and controls.
const PAIRS = [
  ['--fg', '--bg', 4.5], ['--muted-fg', '--bg', 4.5], ['--fg', '--surface', 4.5],
  ['--secondary-fg', '--secondary', 4.5], ['--flame', '--flame-soft', 4.5], ['--gold-fg', '--gold', 4.5],
  ['--primary-fg', '--primary', 3], ['--on-color', '--danger', 3],
];
// Known and accepted for now. Default's orange Momentum-chip text was approved as-is (2026-11-16);
// darkening --flame in the Default block would fix it. Remove a line here once it's fixed.
const KNOWN = { default: ['--flame on --flame-soft'] };
for (const id of THEMES) {
  test(`contrast is readable in the "${id}" theme`, () => {
    const vars = themeVars(id), bad = [];
    for (const [fgName, bgName, min] of PAIRS) {
      const fg = parseColor(resolve(vars, fgName) || ''), bg = parseColor(resolve(vars, bgName) || '');
      if (!fg || !bg || bg[3] < 1) continue; // see-through backgrounds depend on what's behind them
      const r = contrast(fg, bg);
      if (r < min && !(KNOWN[id] || []).includes(`${fgName} on ${bgName}`)) bad.push(`${fgName} on ${bgName}: ${r.toFixed(2)} (needs ${min})`);
    }
    assert.deepEqual(bad, []);
  });
}
