# PC Remote (Decky plugin)

A remote for your Windows PC in the Steam Deck's Quick Access Menu (`…`). Made for the couch:
you stream from the PC with Steam Link / Remote Play and want to open Steam, set the volume,
turn the screen off or put the PC to sleep without walking to the desk.

At a glance it also shows the PC's **live CPU, GPU and RAM use** (each GPU Windows has
running, so a laptop's MUX switch shows) and lets you **switch the audio output** (speakers,
headphones, TV) from the Deck.

## Quick start

**Latest version: [download page](https://github.com/hugouchoasborges/decky-pc-remote/releases/latest)** (the steps below fetch it for you)

**1. On the Windows PC.** Open PowerShell and paste:

```powershell
$f = "$env:TEMP\PCRemote-Setup.ps1"; iwr https://github.com/hugouchoasborges/decky-pc-remote/releases/latest/download/PCRemote-Setup.ps1 -OutFile $f -UseBasicParsing; powershell -ExecutionPolicy Bypass -File $f
```

Click **Yes** when Windows asks for permission (it opens the firewall on your home network).
At the end it shows a **token**: note it.

**2. On the Steam Deck.** You need [Decky Loader](https://decky.xyz).

1. Open the `…` menu → Decky (plug icon) → ⚙️ Settings → turn on **Developer mode**.
2. In **Developer**, choose **Install plugin from URL** and enter:
   `https://github.com/hugouchoasborges/decky-pc-remote/releases/latest/download/decky-pc-remote.zip`
3. Open `…` → **PC Remote** → **Add a PC** → **Search the network**, type the **token**, **Save**.

Done: the panel shows your PC as **Online**. To update later, run both steps again
(the token stays the same).

<p align="center">
  <img src="docs/screenshots/panel.png?v=1.1.0" width="360" alt="The whole PC Remote panel on the Steam Deck: status card (LEGION-5I online, address, Steam open, volume muted, on for 1d 22h) with meters for the i7-12700H, RAM, Iris Xe and RTX 3060; Games on the PC with Spider-Man, Zelda (non-Steam, artwork set on the Deck), Clair Obscur and The Last of Us; Close Steam; volume slider, Unmute and the Output picker; Turn off the screen; Sleep, Restart and Shut down; and Edit, Add, Remove for PCs">
</p>

## What it does

| Section | Controls |
|---|---|
| **Status** | Online / Offline / Connecting at a glance, with the PC's address, whether Steam is open, the volume, the game running and how long the PC has been on; live meters for the CPU (by model), each GPU Windows has running, and RAM |
| **Games on the PC** | The Steam games installed on the PC and its non-Steam shortcuts (emulators, launchers), last played first, with a *Playing* badge on the running one. Collapsed by default; pressing a game opens its page in the Deck's library, where Steam offers **Stream** |
| **Steam** | Open Steam, or close it when it is running |
| **Volume** | A slider for the PC's speakers, a Mute / Unmute button, and **Output** to switch the default device (speakers, headphones, TV) |
| **Screen** | Turn the PC's screen off (moving the mouse or a key wakes it) |
| **Power** | Sleep, Restart, Shut down, each asking to confirm first |
| **PCs** | Edit, add or remove PCs, switch between them when you have more than one, and choose which games each PC shows |

- Only the games list collapses (its header shows how many games are installed); the Deck
  remembers whether you keep it open.
- The meters are measured only while the panel is on screen: the plugin asks every 2 s while
  you look and stops when the menu closes. A laptop's MUX switch shows: with the dedicated GPU
  off, only the integrated one has a meter.
- **Output** lists the outputs Windows has active (Remote Play's virtual device left out); if
  Windows refuses a device, the panel says so.
- The games list is read from the PC's Steam library files, so it works with Steam closed;
  when Steam is closed the list offers to open it, since streaming needs it running.
- **PCs → Edit** lists the PC's games with a switch each: turn one off to hide it from the
  panel (saved per PC on the Deck).
- Rows use the artwork you set on the Deck for that game when there is one (Steam serves it as
  a custom image), then the store capsule, then a lettered tile.
- Non-Steam games come from the PC's `shortcuts.vdf`; the Deck knows them (same app id) only
  while Steam runs on the PC, so they open once Steam is up there.
- On a game the Deck could also install, Steam's main button reads **Install**: the arrow next
  to it offers **Stream** from the PC.
- Every action has an icon and a colour family: blue for Steam, teal for sound, violet for
  the screen, amber for sleep and restart, red for shut down.
- Buttons show a spinner while their command runs; failures appear as a toast.
- **Search the network** in the PC form fills in the PC's name and address, so the only thing
  to type is the token.
- If DHCP gives the PC a new IP, the plugin finds it again by name and carries on.
- Built to be used with the controller alone: the D-pad moves through sections and tiles.

## How it works

| Part | Where | What |
|---|---|---|
| `agent/` | Windows PC | A small PowerShell HTTP server on port 47990, started hidden at logon in your session, protected by a token |
| plugin (`src/`, `main.py`) | Steam Deck | The Decky panel; its Python backend calls the agent and finds it on the LAN |

The agent runs in your Windows session (a logon task, no window) rather than as a Windows
service: a service lives in a separate session without a desktop, where it could neither open
Steam on your screen nor turn the display off.

## Install from source

### 1. PC (Windows)

In PowerShell, from this repository:

```powershell
powershell -ExecutionPolicy Bypass -File agent\install.ps1
```

It copies the agent to `%APPDATA%\pc-remote`, creates a token, registers the logon task
"PC Remote Agent" (run through `conhost --headless`, so no window appears), starts it, and adds
Windows Firewall rules for private networks: TCP for commands, UDP for discovery (one
administrator prompt). At the end it prints the PC's **IP** and **token**.

Running it again updates the agent and keeps the token. Remove everything with
`agent\uninstall.ps1`.

### 2. Steam Deck

Build both release files:

```bash
npm install
npm run build
python scripts/package.py   # release/decky-pc-remote.zip and release/PCRemote-Setup.ps1
```

On the Deck: **Decky → Settings → Developer → Install Plugin from ZIP File** with
`release/decky-pc-remote.zip`.

Open `…` → **PC Remote** → **Add a PC**, press **Search the network**, and type the token.

## Agent API

Every HTTP request needs the header `X-Token: <token>`.

| Request | Effect |
|---|---|
| `GET /status` | `{"host","steam","volume","muted"}` |
| `GET /games` | `{"running","games":[{"appid","name","lastPlayed","nonSteam"}]}`: fully installed Steam games (tools and runtimes left out) and visible non-Steam shortcuts |
| `POST /steam/open`, `POST /steam/close` | Opens Steam, or closes it with `steam.exe -shutdown` |
| `POST /screen/off` | Turns the displays off |
| `POST /power/suspend`, `/power/restart`, `/power/shutdown` | Power actions, 1.5 s after the reply |
| `POST /volume?level=0..100` | Sets the default output device's volume (and unmutes) |
| `POST /mute` | Toggles mute |
| `GET /stats` | `{"cpu","cpuName","ramUsed","ramTotal","gpus":[{"name","use"}],"uptime","game"}`, measured on request |
| `GET /audio` | `{"default","devices":[{"id","name","kind"}]}`: active outputs |
| `POST /audio/default?id=` | Makes that output the default |
| UDP datagram `PCREMOTE_DISCOVER` to port 47990 | Answers `{"name","port"}`; needs no token and reveals nothing secret |

## Network and security

Local network only. The firewall rules cover private networks, and the token is the only
protection, so don't forward the port to the internet. To reach the PC away from home, put the
PC and the Deck on a VPN such as Tailscale and add the PC with its VPN address.

## Releasing

Push a tag such as `v1.1.0`: the Release workflow builds the plugin with that version and
publishes `decky-pc-remote.zip` and `PCRemote-Setup.ps1` (the Windows installer with the agent
embedded, a single file). The Quick start links always point at the latest release.

## Development

`PRODUCT.md` holds the design intent (users, principles, anti-references). The panel's visual
vocabulary (tones, tiles, collapsible sections) lives in `src/ui.tsx`.
