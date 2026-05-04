# Cloudflare Tunnel

The `cloudflared` container in `docker-compose.yml` runs a tunnel using `TUNNEL_TOKEN`
from the env. Set up the tunnel + hostname on the Cloudflare dashboard:

1. Zero Trust → Networks → Tunnels → Create tunnel (named `cico-nas`).
2. Copy the tunnel token into `TUNNEL_TOKEN` in `infra/.env`.
3. Add a public hostname:
   - subdomain: `health` (or your choice)
   - service: `http://api:8787`
4. Restart the cloudflared container.

For local dev, skip cloudflared and hit `http://localhost:8787` directly.
