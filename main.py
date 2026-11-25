"""PC Remote backend: keeps the list of PCs and relays commands to the PC Remote agent over HTTP."""
import json
import os
import urllib.error
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


def _request(method: str, path: str) -> dict:
    data = _load()
    pcs = data["pcs"]
    if not pcs:
        return {"error": "Nenhum PC configurado"}
    pc = pcs[min(data["selected"], len(pcs) - 1)]
    url = f"http://{pc['host']}:{int(pc.get('port') or 47990)}{path}"
    req = urllib.request.Request(url, method=method, headers={"X-Token": pc.get("token", "")})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return {"error": "Token inválido" if e.code == 401 else f"Erro {e.code}"}
    except Exception as e:  # offline, timeout, refused
        decky.logger.info(f"{method} {url}: {e}")
        return {"error": "PC fora do ar"}


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

    async def status(self) -> dict:
        return _request("GET", "/status")

    async def command(self, path: str) -> dict:
        allowed = {"/steam/open", "/steam/close", "/screen/off", "/power/suspend",
                   "/power/shutdown", "/power/restart", "/mute"}
        if path not in allowed:
            return {"error": "comando desconhecido"}
        return _request("POST", path)

    async def set_volume(self, level: int) -> dict:
        return _request("POST", f"/volume?level={max(0, min(100, int(level)))}")

    async def _main(self):
        decky.logger.info("PC Remote loaded")

    async def _unload(self):
        pass
