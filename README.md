# PC Remote (Decky plugin)

Control a Windows PC from the Steam Deck's Quick Access Menu (`…`):

- Open Steam / close Steam
- Turn the screen off only
- Suspend, restart, shut down (with confirmation)
- Volume slider and a Mute toggle
- Several PCs: add, edit, remove and switch between them (the form opens as a modal;
  **Search the network** fills the name and IP)
- Finds the PC again by name when DHCP gives it a new IP

It has two parts:

| Part | Where | What |
|---|---|---|
| `agent/` | Windows PC | A small PowerShell HTTP server (port 47990) started at logon in your session, protected by a token |
| plugin (`src/`, `main.py`) | Steam Deck | The Decky panel; the Python backend calls the agent |

## Install

### 1. PC (Windows)

In PowerShell, from this repository:

```powershell
powershell -ExecutionPolicy Bypass -File agent\install.ps1
```

It copies the agent to `%APPDATA%\pc-remote`, creates a token, registers the logon task
"PC Remote Agent", starts it, and adds a Windows Firewall rule for private networks
(TCP for commands, UDP for discovery; one administrator prompt). At the end it prints the PC's **IP** and **token**.

Remove it with `agent\uninstall.ps1`.

### 2. Steam Deck

Build the zip (or take it from a release):

```bash
npm install
npm run build
```

Package `plugin.json`, `main.py`, `package.json`, `LICENSE` and `dist/index.js` inside a
`PC Remote/` folder, zip it, then on the Deck: **Decky → Settings → Developer →
Install Plugin from ZIP File**.

Open the `…` menu → **PC Remote**, and add the PC with its IP, port (47990) and token.

## Agent API

Every request needs the header `X-Token: <token>`.

| Request | Effect |
|---|---|
| `GET /status` | `{"host","steam","volume","muted"}` |
| `POST /steam/open`, `POST /steam/close` | Opens Steam, or closes it with `steam.exe -shutdown` |
| `POST /screen/off` | Turns the displays off (input wakes them) |
| `POST /power/suspend`, `/power/restart`, `/power/shutdown` | Power actions, 1.5 s after the reply |
| `POST /volume?level=0..100` | Sets the default output device's volume (and unmutes) |
| `POST /mute` | Toggles mute |
| UDP `PCREMOTE_DISCOVER` to port 47990 | Answers `{"name","port"}` (discovery, no token needed, reveals nothing secret) |

Local network only: to reach the PC over the internet, use a VPN such as Tailscale and add the PC with its VPN address. The agent listens on the LAN only through the firewall's private profile. The token is the
only protection: don't expose the port to the internet.
