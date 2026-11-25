"""PC Remote backend: keeps the list of PCs and relays commands to the PC Remote agent over HTTP."""
import json
import os
import socket
import time
import urllib.error
import urllib.parse
import urllib.request

import decky

SETTINGS = os.path.join(decky.DECKY_PLUGIN_SETTINGS_DIR, "pcs.json")
TIMEOUT = 4


def _load() -> dict:
    try:
        with open(SETTINGS, encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, ValueError):
        data = {}
    data.setdefault("pcs", [])
    data.setdefault("selected", 0)
    return data


def _save(data: dict) -> None:
    os.makedirs(os.path.dirname(SETTINGS), exist_ok=True)
    with open(SETTINGS, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def _discover(port: int = 47990, wait: float = 1.5) -> list:
    """Broadcasts PCREMOTE_DISCOVER; every agent on the LAN answers {"name","port"}."""
    found = {}
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        s.settimeout(0.3)
        s.sendto(b"PCREMOTE_DISCOVER", ("255.255.255.255", port))
        end = time.time() + wait
        while time.time() < end:
            try:
                raw, (ip, _) = s.recvfrom(1024)
                info = json.loads(raw)
                found[info["name"]] = {"name": info["name"], "host": ip, "port": int(info.get("port", port))}
            except socket.timeout:
                continue
            except ValueError:
                continue
    finally:
        s.close()
    return list(found.values())


def _call(pc: dict, method: str, path: str) -> dict:
    url = f"http://{pc['host']}:{int(pc.get('port') or 47990)}{path}"
    req = urllib.request.Request(url, method=method, headers={"X-Token": pc.get("token", "")})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return json.loads(r.read() or b"{}")


def _request(method: str, path: str) -> dict:
    data = _load()
    pcs = data["pcs"]
    if not pcs:
        return {"error": "No PC configured"}
    i = min(data["selected"], len(pcs) - 1)
    pc = pcs[i]
    try:
        res = _call(pc, method, path)
        if res.get("host") and pc.get("hostname") != res["host"]:
            pc["hostname"] = res["host"]  # remembered to find the PC again by name
            _save(data)
        return res
    except urllib.error.HTTPError as e:
        return {"error": "Invalid token" if e.code == 401 else f"Error {e.code}"}
    except Exception as e:  # offline, timeout, refused: maybe the IP changed (DHCP)
        decky.logger.info(f"{method} {pc['host']}{path}: {e}")
    wanted = (pc.get("hostname") or pc.get("name") or "").lower()
    for d in _discover(int(pc.get("port") or 47990)):
        if d["name"].lower() == wanted and d["host"] != pc["host"]:
            decky.logger.info(f"{wanted} moved {pc['host']} -> {d['host']}")
            pc["host"] = d["host"]
            _save(data)
            try:
                res = _call(pc, method, path)
                res["moved_to"] = d["host"]  # the panel tells the player the PC was found again
                return res
            except Exception:
                break
    return {"error": "PC offline"}


class Plugin:
    async def get_config(self) -> dict:
        return _load()

    async def save_pc(self, index: int, pc: dict) -> dict:
        data = _load()
        if 0 <= index < len(data["pcs"]):
            data["pcs"][index] = pc
        else:
            data["pcs"].append(pc)
            data["selected"] = len(data["pcs"]) - 1
        _save(data)
        return data

    async def remove_pc(self, index: int) -> dict:
        data = _load()
        if 0 <= index < len(data["pcs"]):
            data["pcs"].pop(index)
            data["selected"] = 0
        _save(data)
        return data

    async def select_pc(self, index: int) -> dict:
        data = _load()
        data["selected"] = index
        _save(data)
        return data

    async def discover(self) -> list:
        return _discover()

    async def games(self) -> dict:
        return _request("GET", "/games")

    async def status(self) -> dict:
        return _request("GET", "/status")

    async def command(self, path: str) -> dict:
        allowed = {"/steam/open", "/steam/close", "/screen/off", "/power/suspend",
                   "/power/shutdown", "/power/restart", "/mute"}
        if path not in allowed:
            return {"error": "unknown command"}
        return _request("POST", path)

    async def stats(self) -> dict:
        return _request("GET", "/stats")

    async def audio(self) -> dict:
        return _request("GET", "/audio")

    async def set_audio(self, device_id: str) -> dict:
        return _request("POST", "/audio/default?id=" + urllib.parse.quote(str(device_id), safe=""))

    async def set_volume(self, level: int) -> dict:
        return _request("POST", f"/volume?level={max(0, min(100, int(level)))}")

    async def _main(self):
        decky.logger.info("PC Remote loaded")

    async def _unload(self):
        pass
