# TODO: project name

> **First session:** the TODOs below are still open. Ask the owner what is unclear, fill them
> in, delete this note and open a PR. Keep this file under 60 lines. Tools, MCPs and box rules
> are in the global box CLAUDE.md, don't repeat them here.

## Demo content
`public/`, `Dockerfile` and `nginx.conf` are a placeholder static site that already satisfies the
contract below and keeps CI green. Replace them with the real project (or adapt them), then delete
this section.

## Purpose
TODO: what this project is, for whom, and the production URL (also in canonical, og:url,
og:image, `public/robots.txt` and `public/sitemap.xml`, which still say https://example.com).

## Stack
TODO: language, framework, database, notable libraries.

## Commands
- Install: TODO
- Dev server: TODO (listen on 0.0.0.0 so `dev expose` works)
- Tests: TODO
- Build: TODO

## Layout
TODO: the few folders that matter.

## CI and deploy contract
`.github/workflows/ci.yml` is a thin caller of the shared pipeline in `seitenschwung/template`,
managed by the owner. You can't change workflow files, so build the project to fit it:
- If `package-lock.json` exists, CI runs `npm ci`, then `npm run lint`, `npm test` and
  `npm run build` when those scripts exist. Keep them green locally before pushing.
- If a `Dockerfile` exists, CI builds it and runs the image hardened: read-only root
  filesystem, `/tmp` as the only writable path, no capabilities, as the image's (non-root)
  user. The image must:
  - listen on port **8080**
  - answer `GET /healthz` with 200
  - serve `GET /version.txt` with the build argument `APP_VERSION` (the commit SHA)
- If `/` returns HTML, CI also crawls the site with Playwright, axe (WCAG AA, serious and
  critical findings fail) and Lighthouse (accessibility, best practices and SEO at least 90).
- SEO on every indexable page (warnings, failures once the owner sets `SEO_STRICT=on`): a unique
  `<title>` (at most 60 characters) and `<meta name="description">` (50 to 160), exactly one `<h1>`,
  no skipped heading levels, `<link rel="canonical">` to the page itself, `og:title`,
  `og:description`, `og:image` (must exist). `/robots.txt` must not block the site, `/sitemap.xml`
  lists every indexable page and only those. Page weight: at most 1.5 MB per page, 300 KB per image.
  The demo uses `https://example.com`: replace it with the production URL (see the TODO above).
- A Dockerfile stage named `test` (`FROM ... AS test`) is built first: put lint and tests there for
  stacks without `package-lock.json`. It must not be the last stage.
- `docker-compose.yml` keeps the CrowdSec labels (`crowdsec.enable=true`,
  `crowdsec.labels.type=nginx`) and the json-file log rotation on every service that serves traffic.
  The CrowdSec agent on the server reads the container logs through them. Don't remove them; the
  type must match a parser there, so ask the owner before changing it.
- `docker-compose.yml` is what Coolify runs. Keep `image: ${IMAGE}`: the pipeline pushes
  the tested image to ghcr.io and tells Coolify which tag to run.
- `main` is production: every merge deploys after green CI. Work on branches, open PRs.

## Impressum and Datenschutz
Never write them by hand. Fill in `legal.json` (details from the owner/customer, never invented),
optionally a `legal-layout.html` in the site's design; CI generates both pages. Every page links to
`impressum.html` and `datenschutz.html`. A new external service (map, video, font CDN, form service)
needs a building block in seitenschwung/template `legal/`: ask the owner, don't work around it.
Details: `legal/README.md` in seitenschwung/template.

## Conventions
TODO: code style, language of the UI, anything the owner insists on.
