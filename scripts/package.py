"""Builds the release files into release/:
- decky-pc-remote.zip   the Decky plugin (install it on the Deck from this zip or its URL)
- PCRemote-Setup.ps1    the Windows installer with the agent embedded, a single file to download
Run `npm run build` first (dist/index.js)."""
import base64
import json
import pathlib
import zipfile

root = pathlib.Path(__file__).resolve().parent.parent
out = root / "release"
out.mkdir(exist_ok=True)
name = json.loads((root / "plugin.json").read_text(encoding="utf-8"))["name"]  # "PC Remote"

with zipfile.ZipFile(out / "decky-pc-remote.zip", "w", zipfile.ZIP_DEFLATED) as z:
    for f in ["plugin.json", "main.py", "package.json", "LICENSE", "README.md", "dist/index.js"]:
        z.write(root / f, f"{name}/{f}")

agent = (root / "agent" / "pc-remote-agent.ps1").read_text(encoding="utf-8")
install = (root / "agent" / "install.ps1").read_text(encoding="utf-8")
# Base64 keeps the agent's own here-strings intact inside this single file.
b64 = base64.b64encode(agent.encode("utf-8")).decode("ascii")
lines = "\n".join(b64[i:i + 100] for i in range(0, len(b64), 100))
# PowerShell needs param() first, so it moves above the embedded agent.
param = next(l for l in install.splitlines() if l.startswith("param("))
install = install.replace(param + "\n", "", 1)
setup = (
    "# PC Remote setup: installs or updates the PC Remote agent (embedded below, base64).\n"
    + param + "\n"
    "$agentBase64 = @'\n"
    + lines
    + "\n'@\n"
    + "$EmbeddedAgent = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String(($agentBase64 -replace '\\s', '')))\n\n"
    + install
)
# UTF-8 with BOM so Windows PowerShell 5.1 reads any non-ASCII text correctly.
(out / "PCRemote-Setup.ps1").write_text(setup, encoding="utf-8-sig", newline="\r\n")
print("release/decky-pc-remote.zip, release/PCRemote-Setup.ps1")
