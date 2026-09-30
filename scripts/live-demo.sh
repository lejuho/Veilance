#!/usr/bin/env bash
# Live demo: the Preprod v2 sponsor + node on this machine (agent/API_V2.md "Preprod"),
# exposed over a tunnel so the GitHub Pages build (VITE_V2_DEMO=auto) can reach it.
# Prints the Pages link with `?api=<tunnel>`; Ctrl-C stops everything it started.
#
#   scripts/live-demo.sh                 # Cloudflare quick tunnel (new address each run)
#   TUNNEL=ngrok scripts/live-demo.sh    # the account's fixed ngrok-free.dev domain
#
# Needs: the proof server on 127.0.0.1:6300, agent/.env.preprod and the secrets in
# agent/.state/preprod/v2 (created once per the runbook), and cloudflared (in PATH or
# ~/.local/bin) or ngrok with an authtoken.
set -euo pipefail

PAGES_URL="${PAGES_URL:-https://lejuho.github.io/Veilance/}"
SPONSOR_PORT="${SPONSOR_PORT:-4201}"
NODE_PORT="${NODE_PORT:-4101}"
TUNNEL_KIND="${TUNNEL:-cloudflared}"
export PATH="$HOME/.local/bin:$PATH"

cd "$(dirname "$0")/../agent"
STATE=.state/preprod/v2
LOGS="$STATE/logs"
mkdir -p "$LOGS"

up() { curl -sf -m 3 "$1" >/dev/null 2>&1; }

up http://127.0.0.1:6300/version || { echo "proof server is not answering on 127.0.0.1:6300 — start Docker Desktop and the proof server first" >&2; exit 1; }
for f in .env.preprod "$STATE/sponsor-token" "$STATE/master-key" "$STATE/state-password"; do
  [[ -f "$f" ]] || { echo "missing agent/$f — see agent/API_V2.md \"Preprod\"" >&2; exit 1; }
done
command -v "$TUNNEL_KIND" >/dev/null || { echo "$TUNNEL_KIND is not installed" >&2; exit 1; }

set -a; . ./.env.preprod; set +a
export VEILANCE_SPONSOR_SEED="$VEILANCE_FUNDER_SEED"
export VEILANCE_SPONSOR_TOKEN="$(cat "$STATE/sponsor-token")"
export VEILANCE_V2_MASTER_KEY="$(cat "$STATE/master-key")"
export VEILANCE_V2_STATE_PASSWORD="$(cat "$STATE/state-password")"
PAGES_ORIGIN="$(printf '%s' "$PAGES_URL" | sed -E 's#^(https?://[^/]+).*#\1#')"
export CORS_ORIGIN="$PAGES_ORIGIN,http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174"

PIDS=()
cleanup() {
  echo; echo "stopping…"
  for pid in "${PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap cleanup EXIT
trap 'exit 130' INT TERM

if up "http://127.0.0.1:$SPONSOR_PORT/sponsor/health"; then
  echo "sponsor already running on :$SPONSOR_PORT"
else
  VEILANCE_V2_ROLE=sponsor VEILANCE_V2_PORT="$SPONSOR_PORT" node_modules/.bin/tsx src/v2/main.ts >>"$LOGS/sponsor.log" 2>&1 &
  PIDS+=($!); echo "sponsor starting on :$SPONSOR_PORT (log: agent/$LOGS/sponsor.log)"
fi

if up "http://127.0.0.1:$NODE_PORT/v2/health"; then
  echo "node already running on :$NODE_PORT — restart it yourself if its CORS_ORIGIN lacks $PAGES_ORIGIN"
else
  VEILANCE_V2_ROLE=node VEILANCE_V2_PORT="$NODE_PORT" VEILANCE_SPONSOR_URL="http://localhost:$SPONSOR_PORT" \
    node_modules/.bin/tsx src/v2/main.ts >>"$LOGS/node.log" 2>&1 &
  PIDS+=($!); echo "node starting on :$NODE_PORT (log: agent/$LOGS/node.log)"
fi

TUNNEL=""
if [[ "$TUNNEL_KIND" == ngrok ]]; then
  ngrok http "$NODE_PORT" --log stdout >"$LOGS/tunnel.log" 2>&1 &
  PIDS+=($!)
  for _ in $(seq 1 30); do
    TUNNEL="$(curl -s -m 2 http://127.0.0.1:4040/api/tunnels 2>/dev/null \
      | python3 -c 'import json,sys; t=[x["public_url"] for x in json.load(sys.stdin)["tunnels"] if x["public_url"].startswith("https")]; print(t[0] if t else "")' 2>/dev/null || true)"
    [[ -n "$TUNNEL" ]] && break
    sleep 1
  done
else
  # QUIC (UDP 7844) is often blocked; HTTP/2 works everywhere.
  cloudflared tunnel --no-autoupdate --protocol http2 --url "http://localhost:$NODE_PORT" >"$LOGS/tunnel.log" 2>&1 &
  PIDS+=($!)
  for _ in $(seq 1 40); do
    grep -q "Registered tunnel connection" "$LOGS/tunnel.log" && TUNNEL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOGS/tunnel.log" | head -1)"
    [[ -n "$TUNNEL" ]] && break
    sleep 1
  done
fi
[[ -n "$TUNNEL" ]] || { echo "$TUNNEL_KIND did not come up — see agent/$LOGS/tunnel.log" >&2; exit 1; }

# A fresh quick-tunnel hostname resolves intermittently for a while: wait for 5 in a row.
echo "waiting for $TUNNEL to answer…"
ok=0
for _ in $(seq 1 60); do
  if [[ "$(curl -s -m 5 -o /dev/null -w '%{http_code}' -H 'ngrok-skip-browser-warning: 1' "$TUNNEL/v2/health")" == 200 ]]; then
    ok=$((ok + 1)); [[ $ok -ge 5 ]] && break
  else
    ok=0
  fi
  sleep 2
done
[[ $ok -ge 5 ]] || echo "warning: the tunnel still drops requests — the page may show the fallback screen; retry there" >&2

cat <<EOF

  tunnel   $TUNNEL  →  localhost:$NODE_PORT
  open     ${PAGES_URL}?api=${TUNNEL}&mode=live
  local    http://localhost:$NODE_PORT/v2/health

The page falls back to the front-end demo button if this node stops answering.
Waiting for the node to report ready (the sponsor may still be syncing)…
EOF

last=""
while true; do
  h="$(curl -s -m 3 "http://127.0.0.1:$NODE_PORT/v2/health" || echo '{"step":"not answering"}')"
  step="$(printf '%s' "$h" | python3 -c 'import json,sys; d=json.load(sys.stdin); print("ready" if d.get("ready") else d.get("step","?"))' 2>/dev/null || echo "?")"
  [[ "$step" != "$last" ]] && { echo "  $(date +%H:%M:%S)  node: $step"; last="$step"; }
  sleep 10
done
