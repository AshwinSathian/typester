# Self-hosting Typester — one-time setup

Everything here targets zero recurring cost: a static build served locally by
Caddy, exposed to the internet only via an outbound Cloudflare Tunnel to
`typester.ashwinsathian.com`. No inbound port is ever opened on this machine.

These are one-time, credential-bound steps only _you_ can run (they open a
browser to your Cloudflare login) — they are intentionally not automated by
Claude. Everything else (the app build, the Caddyfile, the launchd services)
is already in this repo.

## 1. Install Caddy

```sh
brew install caddy
```

## 2. Authenticate and create the tunnel (cloudflared is already installed)

```sh
cloudflared tunnel login                                   # opens browser, picks your zone
cloudflared tunnel create typester                          # prints a <TUNNEL_ID>
cloudflared tunnel route dns typester typester.ashwinsathian.com
```

Copy `ops/cloudflared/config.yml.example` to `~/.cloudflared/config.yml` and
replace `<TUNNEL_ID>` with the value printed above (in both the `tunnel:` line
and the credentials-file path).

## 3. Prepare the release directory

```sh
sudo mkdir -p /opt/typester/releases /opt/typester/logs
sudo chown "$(whoami)" /opt/typester /opt/typester/releases /opt/typester/logs
cp ops/Caddyfile /opt/typester/Caddyfile
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
ls /opt/typester/releases                       # find the previous timestamp
ln -sfn /opt/typester/releases/<timestamp> /opt/typester/releases/current
caddy reload --config /opt/typester/Caddyfile --adapter caddyfile
```

## Updating the tunnel/Caddy config later

Edit `ops/Caddyfile` or `ops/cloudflared/config.yml.example` in the repo, then
re-copy to `/opt/typester/Caddyfile` / `~/.cloudflared/config.yml` and:

```sh
caddy reload --config /opt/typester/Caddyfile --adapter caddyfile
launchctl kickstart -k gui/$(id -u)/com.ashwinsathian.typester.cloudflared
```
