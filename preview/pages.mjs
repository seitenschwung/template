#!/usr/bin/env node
// Which pages get a screenshot? Used by pipeline.yml before the browser tests, results go to
// preview.yml (see README.md next to this file). Plain Node 20+, no dependencies.
//
//   node pages.mjs --base-url http://127.0.0.1:8080 [--changed files.txt | --git <base>..<head>]
//                  [--baseline pages.json] [--docroot-list html-files.txt] [--config .github/preview.json]
//                  [--force "<reason>"] [--out pages.json]
//
// 1. All pages, nothing listed by hand: links crawled from /, /sitemap.xml, every .html file in the
//    image (--docroot-list, so unlinked pages count too) and the variants from the config
//    (e.g. a test page with ?vorschau=3 to show its result).
// 2. A fingerprint per page: its HTML plus every same-origin file it loads (CSS, JS, images, and
//    what the CSS loads). Same fingerprint = the page looks the same.
// 3. Which to shoot, from the changed files (git diff) and the fingerprints of main (--baseline):
//    forced, diff unknown, a global file changed or no baseline yet -> all pages;
//    only files without visual effect changed -> none; otherwise the pages whose fingerprint
//    differs from main, plus new pages.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const MAX_PAGES = 80;

// Files that change every page (or the server) -> all pages. Patterns as in .gitignore: without a
// slash they match at any depth. Projects add their own in .github/preview.json ("global").
const GLOBAL = [
  'Dockerfile', '.dockerignore', 'docker-compose*.yml', 'compose*.yml', 'nginx.conf', 'legal.json',
  'package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb',
  '*.config.js', '*.config.mjs', '*.config.cjs', '*.config.ts', 'tsconfig.json', '.env.example',
  '.github/workflows/**', '.github/preview.json',
  'layout.*', '_layout.*', '+layout.*', '_app.*', '_document.*', 'global.css', 'globals.css', 'base.css',
];
// Files without visual effect -> no screenshot for them. Projects add more ("ignore").
const IGNORE = [
  '*.md', 'LICENSE*', 'docs/**', '*.test.*', '*.spec.*', '__tests__/**', '.gitignore', '.editorconfig',
  '.github/dependabot.yml', '.github/ISSUE_TEMPLATE/**', '.github/*.md', '.claude/**', '.progress/**',
];

export function globToRegExp(glob) {
  const anyDepth = !glob.replace(/\/\*\*$/, '').includes('/');
  let re = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      if (glob[i + 2] === '/') { re += '(?:.*/)?'; i += 2; } else { re += '.*'; i += 1; }
    } else if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if (c === '{') { const end = glob.indexOf('}', i); re += `(?:${glob.slice(i + 1, end).split(',').map(escape).join('|')})`; i = end; }
    else re += escape(c);
  }
  return new RegExp(`^${anyDepth ? '(?:.*/)?' : ''}${re}$`);
}
const escape = (s) => s.replace(/[.+^$()|[\]\\]/g, '\\$&');
const matcher = (globs) => { const res = globs.map(globToRegExp); return (f) => res.some((r) => r.test(f)); };

// Same file names as the screenshots of the browser tests: "/" -> home, "/a/b.html" -> a_b.html.
export const slugOf = (path) => (path === '/' ? 'home' : path.replace(/^\/|\/$/g, '').replace(/[^A-Za-z0-9._-]+/g, '_'));
// "/x", "/x.html", "/x/" and "/x/index.html" are the same page on most servers.
const samePage = (p) => p.replace(/\/index\.html$/, '/').replace(/\.html$/, '').replace(/(.)\/$/, '$1') || '/';
const sha = (data) => createHash('sha256').update(data).digest('hex');
const SKIP_EXT = /\.(pdf|zip|jpe?g|png|webp|avif|gif|svg|ico|mp4|webm|txt|xml|json|css|js|mjs|woff2?|ttf)$/i;

/** Decide from the changed files alone. Returns {mode, reason} or null (= look at the fingerprints). */
export function classify(changed, config = {}) {
  if (changed === null) return { mode: 'all', reason: 'changed files unknown (no base commit to compare with)' };
  const isGlobal = matcher([...GLOBAL, ...(config.global ?? [])]);
  const isIgnored = matcher([...IGNORE, ...(config.ignore ?? [])]);
  const global = changed.filter(isGlobal);
  if (global.length) return { mode: 'all', reason: `global file changed: ${global.slice(0, 3).join(', ')}${global.length > 3 ? ` (+${global.length - 3})` : ''}`, global };
  const relevant = changed.filter((f) => !isIgnored(f));
  if (!relevant.length) return { mode: 'none', reason: changed.length ? 'only files without visual effect changed' : 'no files changed' };
  return { relevant };
}

async function get(base, path) {
  try {
    const r = await fetch(new URL(path, base), { redirect: 'follow', headers: { 'Cache-Control': 'no-cache' } });
    return { status: r.status, type: r.headers.get('content-type') ?? '', url: r.url, body: Buffer.from(await r.arrayBuffer()) };
  } catch (e) {
    return { status: 0, type: '', url: '', body: Buffer.alloc(0), error: e.message };
  }
}

const attr = (html, re) => [...html.matchAll(re)].map((m) => m[1].replace(/&amp;/g, '&'));
function links(html) { return attr(html, /<a\b[^>]*?\bhref\s*=\s*["']([^"'#]+)/gi); }
function assets(html) {
  const out = [
    ...attr(html, /<(?:script|img|source|iframe|video|audio|embed|input)\b[^>]*?\bsrc\s*=\s*["']([^"']+)/gi),
    ...attr(html, /<link\b[^>]*?\bhref\s*=\s*["']([^"']+)/gi),
    ...attr(html, /\b(?:srcset|imagesrcset)\s*=\s*["']([^"']+)/gi).flatMap((s) => s.split(',').map((x) => x.trim().split(/\s+/)[0])),
    ...attr(html, /\bposter\s*=\s*["']([^"']+)/gi),
    ...cssRefs(html),
  ];
  return out.filter(Boolean);
}
function cssRefs(css) { return attr(css, /url\(\s*["']?([^"')]+)/gi).concat(attr(css, /@import\s+["']([^"']+)/gi)).filter((u) => !u.startsWith('data:')); }

export async function discover(base, { docroot = [], variants = [], log = () => {} } = {}) {
  const origin = new URL(base).origin;
  const pages = new Map();       // path -> {path, html}
  const known = new Set();       // samePage() of every page found
  const queue = ['/'];
  const sitemap = await get(base, '/sitemap.xml');
  if (sitemap.status === 200) for (const m of sitemap.body.toString().matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    try { const u = new URL(m[1]); queue.push(u.pathname); } catch { /* not a URL */ }
  }
  const fromFiles = docroot.map((f) => `/${f.replace(/^\/+/, '')}`.replace(/\/index\.html$/, '/'));
  const tried = new Set();
  const visit = async (path, source) => {
    if (tried.has(path) || pages.size >= MAX_PAGES || known.has(samePage(path))) return;
    tried.add(path);
    const r = await get(base, path);
    if (r.status !== 200 || !/^text\/html/i.test(r.type)) { log(`skip ${path} (${r.status || r.error} ${r.type})`); return; }
    if (new URL(r.url).origin !== origin) return;
    const html = r.body.toString();
    pages.set(path, { path, html, source });
    known.add(samePage(path));
    for (const href of links(html)) {
      let u; try { u = new URL(href, new URL(path, base)); } catch { continue; }
      if (u.origin === origin && !SKIP_EXT.test(u.pathname)) queue.push(u.pathname);
    }
  };
  while (queue.length) await visit(queue.shift(), 'link');   // links and sitemap first: their spelling wins
  for (const p of fromFiles) await visit(p, 'file');          // then pages nothing links to
  for (const p of [...pages.keys()].filter((p) => pages.get(p).source === 'file')) {   // their links too
    for (const href of links(pages.get(p).html)) {
      let u; try { u = new URL(href, new URL(p, base)); } catch { continue; }
      if (u.origin === origin && !SKIP_EXT.test(u.pathname)) await visit(u.pathname, 'link');
    }
  }

  // Fingerprints: HTML + everything same-origin it loads (one level into CSS).
  const cache = new Map();
  const assetHash = async (url) => {
    if (cache.has(url)) return cache.get(url);
    const p = (async () => {
      const r = await get(base, url);
      let h = `${r.status}:${sha(r.body)}`;
      if (/css/i.test(r.type) || /\.css(\?|$)/.test(url)) {
        const nested = [];
        for (const ref of cssRefs(r.body.toString())) {
          const u = new URL(ref, url);
          if (u.origin === origin) { const r2 = await get(base, u.href); nested.push(`${u.pathname}${u.search}=${r2.status}:${sha(r2.body)}`); }
        }
        h = sha([h, ...nested.sort()].join('\n'));
      }
      return h;
    })();
    cache.set(url, p);
    return p;
  };
  const out = [];
  for (const { path, html, source } of pages.values()) {
    const refs = new Set();
    for (const ref of assets(html)) {
      let u; try { u = new URL(ref, new URL(path, base)); } catch { continue; }
      if (u.origin === origin) refs.add(`${u.pathname}${u.search}`);
    }
    const parts = [sha(html)];
    for (const ref of [...refs].sort()) parts.push(`${ref}=${await assetHash(new URL(ref, base).href)}`);
    const hash = sha(parts.join('\n'));
    out.push({ path, slug: slugOf(path), hash, source });
    for (const v of variants) {
      if (!v || !/^[a-z0-9-]+$/i.test(v.name ?? '') || !/^\?/.test(v.query ?? '')) { log(`ignoring variant ${JSON.stringify(v)}: needs name (letters, digits, -) and query (starting with ?)`); continue; }
      const re = new RegExp(v.match ?? '.');
      if ((v.pages && !new RegExp(v.pages).test(path)) || !re.test(html)) continue;
      out.push({ path: `${path}${v.query}`, slug: `${slugOf(path)}.${v.name}`, hash: sha(`${hash}\n${v.query}`), source: 'variant' });
    }
  }
  return out.sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Mark the pages to shoot. baseline: {slug: hash} of main, or null. */
export function select(pages, decision, baseline) {
  let { mode, reason } = decision;
  if (!mode && !baseline) { mode = 'all'; reason = 'no fingerprints of main yet'; }
  if (mode === 'all') return { mode, reason, pages: pages.map((p) => ({ ...p, shoot: true })) };
  if (mode === 'none') return { mode, reason, pages: pages.map((p) => ({ ...p, shoot: false })) };
  const marked = pages.map((p) => ({ ...p, shoot: baseline[p.slug] !== p.hash, why: baseline[p.slug] === undefined ? 'new' : baseline[p.slug] !== p.hash ? 'changed' : undefined }));
  const n = marked.filter((p) => p.shoot).length;
  return {
    mode: n ? 'changed' : 'none',
    reason: n ? `${n} page(s) render differently than on main (${decision.relevant.length} relevant changed file(s))` : `${decision.relevant.length} changed file(s), but no page renders differently than on main`,
    pages: marked,
  };
}

function args(argv) {
  const a = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) a[argv[i].slice(2)] = argv[i + 1]?.startsWith('--') || argv[i + 1] === undefined ? true : argv[++i];
  return a;
}

async function main() {
  const a = args(process.argv.slice(2));
  if (!a['base-url']) { console.error('usage: pages.mjs --base-url URL [--changed FILE | --git BASE..HEAD] [--baseline FILE] [--docroot-list FILE] [--config FILE] [--force REASON] [--out FILE]'); process.exit(2); }
  const config = a.config && existsSync(a.config) ? JSON.parse(readFileSync(a.config, 'utf8')) : {};
  let changed = null;
  if (a.changed && a.changed !== true && existsSync(a.changed)) changed = readFileSync(a.changed, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  else if (a.git && a.git !== true) {
    const [from, to] = a.git.split('..');
    try { changed = execFileSync('git', ['diff', '--name-only', '--no-renames', from, to || 'HEAD'], { encoding: 'utf8' }).split('\n').filter(Boolean); } catch { changed = null; }
  }
  const docroot = a['docroot-list'] && existsSync(a['docroot-list']) ? readFileSync(a['docroot-list'], 'utf8').split('\n').map((s) => s.trim()).filter((s) => s.endsWith('.html')) : [];
  let baseline = null;
  if (a.baseline && existsSync(a.baseline)) {
    try { baseline = Object.fromEntries(JSON.parse(readFileSync(a.baseline, 'utf8')).pages.map((p) => [p.slug, p.hash])); } catch { baseline = null; }
  }

  const pages = await discover(a['base-url'], { docroot, variants: config.variants ?? [], log: a.verbose ? (m) => console.error(m) : () => {} });
  const decision = a.force && a.force !== true ? { mode: 'all', reason: a.force } : classify(changed, config);
  const result = { ...select(pages, decision, baseline), changedFiles: changed?.length ?? null };
  if (a.out) writeFileSync(a.out, `${JSON.stringify(result, null, 2)}\n`);

  const shoot = result.pages.filter((p) => p.shoot);
  console.log(`Screenshots: ${result.mode} (${result.reason})`);
  console.log(`${result.pages.length} page(s) found, ${shoot.length} to shoot:`);
  for (const p of result.pages) console.log(`  ${p.shoot ? '📸' : '  '} ${p.path}${p.why ? ` (${p.why})` : ''}${p.source === 'file' ? ' (not linked)' : ''}`);
}

const isMain = (() => { try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; } })();
if (isMain) main().catch((e) => { console.error(e); process.exit(1); });
