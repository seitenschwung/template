# Project template

Starting point for new projects made with `dev <name>` (claude-dev kit). It brings:

- `CLAUDE.md`: a skeleton the box fills in during its first session
- `.github/workflows/ci.yml`: checks, a hardened Docker test, browser tests, and a deploy to
  Coolify after green CI on `main`
- `docker-compose.yml`: what Coolify runs (the image tested by CI)
- `.gitignore`, `.dockerignore`, a PR template

Replace this README with one about the project.

## Setting up the deploy (owner, once per project)

Nothing deploys until `COOLIFY_APP_UUID` is set, so CI stays green before that.

1. **Coolify:** New Resource → this repository → Build Pack **Docker Compose**. Give the
   service `web` the domain `https://<domain>:8080`. The server needs a `docker login ghcr.io`
   (a token with `read:packages`) if the repository is private.
2. **GitHub → Settings → Environments → `production`:**
   - secrets `COOLIFY_TOKEN` (Coolify API token with read, write and deploy),
     `TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET` (Tailscale OAuth client with tag `tag:ci`)
   - variables `COOLIFY_URL` (Coolify on the tailnet) and `APP_URL` (`https://<domain>`)
3. **GitHub → Settings → Secrets and variables → Actions → Variables (repository):**
   `COOLIFY_APP_UUID`. It must be a repository variable, since it decides whether the deploy
   job runs at all.
4. Optional: `BROWSER_TESTS=off` (repository variable) for a project without a web UI.

The deploy steps live in the workflow on purpose: the bot that writes the code can't change
workflow files, so it can't change what runs with the deploy secrets.
