# Self-hosting Typester — one-time setup

A static build served locally by Caddy, exposed to the internet only via an
outbound Cloudflare Tunnel to `typester.ashwinsathian.com`. No inbound port is
ever opened on this machine. Releases and logs live under `~/.typester`,
matching this machine's existing convention for other self-hosted projects
(`~/.brnr`, `~/.thoughts`, etc.) — no `sudo` or `/opt` required.

## 1. Install Caddy

```sh
brew install caddy
```

## 2. Create the tunnel and route DNS

`cloudflared` is already installed and authenticated on this machine (it
already runs tunnels for other projects). Creating a new tunnel and DNS
route doesn't require re-authenticating:

```sh
cloudflared tunnel create typester                          # prints a <TUNNEL_ID>
cloudflared tunnel route dns typester typester.ashwinsathian.com
```

Copy `ops/cloudflared/config.yml.example` to
`~/.cloudflared/typester-config.yml` and replace `<TUNNEL_ID>` with the value
printed above (in both the `tunnel:` line and the credentials-file path).
This machine already has a shared `~/.cloudflared/config.yml` for another
project — each project gets its own `<project>-config.yml` so they don't
collide.

**Route DNS by tunnel UUID, not name.** `cloudflared tunnel route dns
typester typester.ashwinsathian.com` resolved the tunnel *name* to the wrong
tunnel on this machine (it pointed the CNAME at an unrelated existing
tunnel) even though `cloudflared tunnel list` showed the right one existed.
Using the UUID form sidesteps the ambiguity and is worth doing by default
when more than one tunnel exists on the account:

```sh
cloudflared tunnel route dns --overwrite-dns <TUNNEL_ID> typester.ashwinsathian.com
```

After routing, confirm the fix actually worked before moving on - `dig`
won't show it (Cloudflare-proxied records only expose the edge anycast IPs),
so check the CLI's own log line: it names the tunnel ID it just routed to.

## 3. Prepare the release directory

```sh
mkdir -p ~/.typester/releases ~/.typester/logs
cp ops/Caddyfile ~/.typester/Caddyfile
```

## 4. First deploy

```sh
./ops/deploy.sh
```

## 5. Install both services to survive reboot/logout

```sh
cp ops/launchd/com.ashwinsathian.typester.caddy.plist ~/Library/LaunchAgents/
cp ops/launchd/com.ashwinsathian.typester.cloudflared.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.ashwinsathian.typester.caddy.plist
launchctl load ~/Library/LaunchAgents/com.ashwinsathian.typester.cloudflared.plist
```

`typester.ashwinsathian.com` should now resolve to the app. Both services
restart automatically on crash (`KeepAlive`) and at login (`RunAtLoad`).

## Subsequent deploys

```sh
./ops/deploy.sh
```

## Rollback

```sh
ls ~/.typester/releases                       # find the previous timestamp
ln -sfn ~/.typester/releases/<timestamp> ~/.typester/releases/current
caddy reload --config ~/.typester/Caddyfile --adapter caddyfile
```

## Updating the tunnel/Caddy config later

`ops/deploy.sh` copies `ops/Caddyfile` to `~/.typester/Caddyfile` and reloads
Caddy on every run, so an edit to `ops/Caddyfile` takes effect on the next
`./ops/deploy.sh` automatically. `ops/cloudflared/config.yml.example` isn't
auto-synced (it holds the tunnel's own credentials-file path, generated
once) - edit `~/.cloudflared/typester-config.yml` directly, or re-copy the
example and re-apply the `<TUNNEL_ID>` substitution, then:

```sh
launchctl kickstart -k gui/$(id -u)/com.ashwinsathian.typester.cloudflared
```

## Checking status

```sh
launchctl list | grep com.ashwinsathian.typester
tail -f ~/.typester/logs/caddy.out.log ~/.typester/logs/cloudflared.out.log
curl -I http://localhost:8787/
```

## Troubleshooting: 200 OK with an empty body over the public URL

If `curl -I https://typester.ashwinsathian.com/` comes back `200` but with
`content-length: 0` and none of the app's own headers (no
`content-security-policy`, etc.), while `cloudflared`'s logs show the tunnel
registered but never logs an incoming request, the Caddyfile's site address
is the culprit. Caddy treats a *hostname* in a site address (e.g.
`localhost:8787`) as a Host-header matcher, not just a bind address - it
only answers requests whose `Host` is literally `localhost`. Cloudflare
forwards the tunnel's real public hostname to the origin, so every real
request falls through to Caddy's empty default response. The fix (already
applied in `ops/Caddyfile`) is a port-only address with an explicit bind:

```caddyfile
:8787 {
	bind 127.0.0.1
	...
}
```

Verify with `curl -H "Host: typester.ashwinsathian.com" http://localhost:8787/`
locally before assuming the problem is DNS/tunnel propagation.

## Troubleshooting: the app loads but nothing works (blank word, broken deep links)

`curl` only checks that HTML comes back with a 200 - it doesn't execute
JavaScript or enforce CSP the way a real browser does, so it can look like
everything's fine while the actual app is broken for every visitor. Load
the site in a real browser (or drive one with Playwright) and check the
console. Two CSP directives are easy to get wrong for an Angular SPA
specifically:

- **`base-uri 'none'`** blocks Angular's own `<base href="/">` tag. Without
  it taking effect, every relative asset URL resolves against the *current
  route's path* instead of root - harmless on `/` (root and route happen to
  coincide) but breaks every asset load the moment someone deep-links into
  a non-root route (`/play/*`, a shared results-style link, or just
  refreshing on any page other than `/`). Use `base-uri 'self'`.
- **`style-src`/`script-src` without `'unsafe-inline'`** blocks Angular's
  SSR-emitted critical-CSS `<style>` tag and the JSON-LD `<script
  type="application/ld+json">` block in `index.html`. Neither renders any
  user-controlled data, so `'unsafe-inline'` here doesn't reopen an XSS hole
  the way it would for markup built from request input.
- Also add `connect-src` for anything the app fetches at runtime -
  `default-src 'self'` does **not** cover `fetch()`/XHR on its own. This app
  needs `https://api.datamuse.com` for `word-source.service.ts`'s live word
  requests; forgetting this silently degrades every round to the offline
  word-bank fallback with no visible error.

These three were all caught by loading the live site in a real headless
browser and inspecting `page.on('console', ...)` for CSP violations - not
by `curl`, and not by the unit/component test suite, which mocks HTTP
entirely.
