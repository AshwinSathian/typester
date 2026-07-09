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

Edit `ops/Caddyfile` or `ops/cloudflared/config.yml.example` in the repo, then
re-copy to `~/.typester/Caddyfile` / `~/.cloudflared/typester-config.yml` and:

```sh
caddy reload --config ~/.typester/Caddyfile --adapter caddyfile
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
