# Screenshots: which pages, and only the changed ones

`pipeline.yml` takes full-page screenshots for `preview.yml` (baseline on `main`, comment on a PR).
`pages.mjs` decides which pages they are. It runs in the step "Pages to screenshot", before the
browser tests, against the running image. The browser tests still check every linked page; only
the screenshots are limited.

## All pages, found automatically
No page list to maintain. A page counts when it answers 200 with HTML and comes from
- links, crawled from `/` (up to 80 pages),
- `/sitemap.xml`,
- every `.html` file in the image (web root = the folder of the shortest path to an `index.html`),
  so pages that nothing links to (drafts, hidden tests) are shot too,
- variants from `.github/preview.json` (below), e.g. a test page with its result shown.

## Only what changed
Per page a fingerprint: its HTML plus every same-origin file it loads (CSS, JS, images, fonts and
what the CSS loads). `preview.yml` keeps the fingerprints of `main` in `main/pages.json` on the
branch `pr-previews`. Then, in this order:

| Situation | Screenshots of |
|---|---|
| manual run (`workflow_dispatch`) or repository variable `SCREENSHOTS=all` | all pages |
| no base to compare with (first push, force push) | all pages |
| a global file changed: `Dockerfile`, `docker-compose*.yml`, `nginx.conf`, `package*.json` and lock files, `*.config.*`, `legal.json`, `layout.*`, `globals.css`, `.github/workflows/**`, `.github/preview.json` and the project's own `global` list | all pages |
| only files without visual effect changed: `*.md`, `docs/**`, `*.test.*`, `*.spec.*`, `.github/dependabot.yml` and the project's own `ignore` list | none |
| no fingerprints of `main` yet | all pages |
| otherwise | the pages whose fingerprint differs from `main`, and new pages |

Changed files: on a PR the merge commit against its base, on `main` the push against the previous
head (`git diff --name-only`). On `main` only the new shots replace theirs in the baseline, pages
that are gone are removed, the others keep their picture.

## `.github/preview.json` (optional, in the project)
```json
{
  "global": ["site/lib/**"],
  "ignore": ["server/*.test.js"],
  "variants": [{ "name": "ergebnis", "query": "?vorschau=3", "match": "js/antreiber\\.js" }]
}
```
- `global`, `ignore`: more patterns as in `.gitignore` (without a slash they match at any depth).
- `exclude`: URL paths (patterns as above) that are never shot; `/50x.html` (the nginx error page) is always left out.
- `variants`: for every page whose HTML matches the regular expression `match` (and whose path
  matches `pages`, if given), also the URL with `query`, saved as `<page>.<name>`.

## Try it locally
```bash
node preview/pages.mjs --base-url http://127.0.0.1:8080 --git origin/main..HEAD --config .github/preview.json
```
`--baseline pages.json` compares with a saved result (`--out pages.json`), `--docroot-list` takes a
list of .html files, `--force "<reason>"` selects all. It prints every page and marks the ones to
shoot with 📸.
