# PC Remote agent: a tiny HTTP server the "PC Remote" Decky plugin talks to.
# Runs in the logged-in user's session (Task Scheduler, at logon), so it can open Steam
# on the desktop and change the speaker volume. Every request needs the X-Token header.
#
#   GET  /status                 -> {"host","steam","volume","muted"}
#   GET  /games                  -> {"running", "games":[{"appid","name","lastPlayed","nonSteam"?}]}
#   POST /steam/open | /steam/close
#   POST /screen/off             -> turns the displays off only
#   POST /power/suspend | /power/shutdown | /power/restart
#   POST /volume?level=0..100
#   POST /mute                   -> toggles mute
param(
    [int]$Port = 47990,
    [string]$ConfigDir = (Join-Path $env:APPDATA 'pc-remote')
)
$ErrorActionPreference = 'Stop'
$tokenFile = Join-Path $ConfigDir 'token.txt'
if (-not (Test-Path $tokenFile)) { throw "Token missing: run install.ps1 first ($tokenFile)" }
$token = (Get-Content $tokenFile -Raw).Trim()
$logFile = Join-Path $ConfigDir 'agent.log'
function Log($m) { try { Add-Content $logFile "$(Get-Date -Format s) $m" } catch {} }

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
    int f(); int g(); int h(); int i();
    int SetMasterVolumeLevelScalar(float level, Guid ctx);
    int j(); int GetMasterVolumeLevelScalar(out float level);
    int k(); int l(); int m(); int n();
    int SetMute([MarshalAs(UnmanagedType.Bool)] bool mute, Guid ctx);
    int GetMute(out bool mute);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref Guid id, int ctx, IntPtr p, [MarshalAs(UnmanagedType.IUnknown)] out object o); }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int flow, int role, out IMMDevice d); }
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumerator {}
public static class PcAudio {
    static IAudioEndpointVolume Ep() {
        var e = (IMMDeviceEnumerator)new MMDeviceEnumerator();
        IMMDevice d; Marshal.ThrowExceptionForHR(e.GetDefaultAudioEndpoint(0, 1, out d));
        var iid = typeof(IAudioEndpointVolume).GUID; object o;
        Marshal.ThrowExceptionForHR(d.Activate(ref iid, 23, IntPtr.Zero, out o));
        return (IAudioEndpointVolume)o;
    }
    public static int Get() { float v; Ep().GetMasterVolumeLevelScalar(out v); return (int)Math.Round(v * 100); }
    public static void Set(int p) { Ep().SetMasterVolumeLevelScalar(Math.Max(0, Math.Min(100, p)) / 100f, Guid.Empty); }
    public static bool Muted() { bool m; Ep().GetMute(out m); return m; }
    public static void Mute(bool m) { Ep().SetMute(m, Guid.Empty); }
}
public static class PcPower {
    [DllImport("powrprof.dll")] public static extern bool SetSuspendState(bool hibernate, bool force, bool wakeupEventsDisabled);
    [DllImport("user32.dll")] static extern bool PostMessage(IntPtr hWnd, uint msg, IntPtr w, IntPtr l);
    // Turns the displays off (they wake on mouse/keyboard input). The PC keeps running.
    public static void ScreenOff() { PostMessage((IntPtr)0xFFFF, 0x0112, (IntPtr)0xF170, (IntPtr)2); }
}
'@

function SteamExe {
    $p = (Get-ItemProperty 'HKCU:\Software\Valve\Steam' -ErrorAction SilentlyContinue).SteamExe
    if ($p -and (Test-Path $p)) { return $p }
    return "${env:ProgramFiles(x86)}\Steam\steam.exe"
}
function SteamRunning { [bool](Get-Process steam -ErrorAction SilentlyContinue) }
# Installed Steam games, read from the library files (works with Steam closed).
# Fully installed only (StateFlags 4), tools and runtimes left out, last played first.
function Games {
    $steam = (Get-ItemProperty 'HKCU:\Software\Valve\Steam' -ErrorAction SilentlyContinue).SteamPath
    if (-not $steam) { return @() }
    $vdf = Join-Path $steam 'steamapps\libraryfolders.vdf'
    $libs = @($steam)
    if (Test-Path $vdf) { $libs += [regex]::Matches((Get-Content $vdf -Raw -Encoding UTF8), '"path"\s+"([^"]+)"') | ForEach-Object { $_.Groups[1].Value -replace '\\\\', '\' } }
    $tools = '^(Steamworks Common Redistributables|Proton|Steam Linux Runtime|SteamVR|Steam Audio)'
    $seen = @{}
    $games = foreach ($lib in ($libs | Select-Object -Unique)) {
        foreach ($f in Get-ChildItem (Join-Path $lib 'steamapps') -Filter 'appmanifest_*.acf' -ErrorAction SilentlyContinue) {
            $t = Get-Content $f.FullName -Raw -Encoding UTF8
            $get = { param($k) $m = [regex]::Match($t, "`"$k`"\s+`"([^`"]*)`""); if ($m.Success) { $m.Groups[1].Value } }
            $id = [int](& $get 'appid'); $name = & $get 'name'
            if (-not $id -or $seen[$id] -or $name -match $tools -or [int](& $get 'StateFlags') -ne 4) { continue }
            $seen[$id] = $true
            [pscustomobject]@{ appid = $id; name = $name; lastPlayed = [int64](& $get 'LastPlayed') }
        }
    }
    $games = @($games) + @(NonSteamGames $steam)
    $running = (Get-ItemProperty 'HKCU:\Software\Valve\Steam' -ErrorAction SilentlyContinue).RunningAppID
    @{ running = [int64]$running; games = @($games | Sort-Object @{ e = 'lastPlayed'; Descending = $true }, name) }
}

# Non-Steam games: the shortcuts in userdata\<user>\config\shortcuts.vdf (binary VDF:
# 0x00 map, 0x01 string, 0x02 int32, 0x07 int64, 0x08 end of map). Their appid is the one the
# Deck's library uses for them while Steam runs on the PC. Hidden shortcuts are left out.
function NonSteamGames($steam) {
    $seen = @{}
    foreach ($file in Get-ChildItem (Join-Path $steam 'userdata\*\config\shortcuts.vdf') -ErrorAction SilentlyContinue) {
        $b = [IO.File]::ReadAllBytes($file.FullName)
        $i = 0; $depth = 0; $cur = $null
        while ($i -lt $b.Length) {
            $type = $b[$i]; $i++
            if ($type -eq 8) {
                $depth--
                if ($depth -eq 1 -and $cur) {
                    if ($cur.appid -and $cur.name -and -not $cur.hidden -and -not $seen[$cur.appid]) {
                        $seen[$cur.appid] = $true
                        [pscustomobject]@{ appid = $cur.appid; name = $cur.name; lastPlayed = $cur.lastPlayed; nonSteam = $true }
                    }
                    $cur = $null
                }
                continue
            }
            $s = $i; while ($i -lt $b.Length -and $b[$i] -ne 0) { $i++ }
            $key = [Text.Encoding]::UTF8.GetString($b, $s, $i - $s); $i++
            if ($type -eq 0) { $depth++; if ($depth -eq 2) { $cur = @{ lastPlayed = [int64]0 } } }
            elseif ($type -eq 1) {
                $s = $i; while ($i -lt $b.Length -and $b[$i] -ne 0) { $i++ }
                $val = [Text.Encoding]::UTF8.GetString($b, $s, $i - $s); $i++
                if ($cur -and $key -ieq 'appname') { $cur.name = $val }
            }
            elseif ($type -eq 2) {
                $u = [BitConverter]::ToUInt32($b, $i); $i += 4
                if ($cur) {
                    if ($key -ieq 'appid') { $cur.appid = [int64]$u }
                    elseif ($key -ieq 'LastPlayTime') { $cur.lastPlayed = [int64]$u }
                    elseif ($key -ieq 'IsHidden') { $cur.hidden = $u -ne 0 }
                }
            }
            elseif ($type -eq 7) { $i += 8 }
            else { break }
        }
    }
}

function Status {
    @{ host = $env:COMPUTERNAME; steam = (SteamRunning); volume = [PcAudio]::Get(); muted = [PcAudio]::Muted() }
}
# Power actions run a moment after the reply, so the Deck gets its answer first.
function Later([scriptblock]$b) {
    $t = New-Object System.Timers.Timer 1500; $t.AutoReset = $false
    Register-ObjectEvent $t Elapsed -Action $b | Out-Null; $t.Start()
}

function Handle($method, $path, $query) {
    switch ("$method $path") {
        'GET /status'        { return Status }
        'GET /games'         { return Games }
        'POST /steam/open'   { if (-not (SteamRunning)) { Start-Process (SteamExe) }; return @{ ok = $true } }
        'POST /steam/close'  { if (SteamRunning) { Start-Process (SteamExe) -ArgumentList '-shutdown' }; return @{ ok = $true } }
        'POST /screen/off'     { Later { [PcPower]::ScreenOff() }; return @{ ok = $true } }
        'POST /power/suspend'  { Later { [PcPower]::SetSuspendState($false, $false, $false) | Out-Null }; return @{ ok = $true } }
        'POST /power/shutdown' { Later { Stop-Computer -Force }; return @{ ok = $true } }
        'POST /power/restart'  { Later { Restart-Computer -Force }; return @{ ok = $true } }
        'POST /volume' {
            $lvl = [int]$query['level']; [PcAudio]::Set($lvl)
            if ($lvl -gt 0 -and [PcAudio]::Muted()) { [PcAudio]::Mute($false) }
            return Status
        }
        'POST /mute' { [PcAudio]::Mute(-not [PcAudio]::Muted()); return Status }
    }
    return $null
}

function Reply($stream, [int]$code, $obj) {
    $body = [Text.Encoding]::UTF8.GetBytes(($obj | ConvertTo-Json -Compress -Depth 5))
    $reason = @{ 200 = 'OK'; 401 = 'Unauthorized'; 404 = 'Not Found'; 500 = 'Error' }[$code]
    $head = "HTTP/1.1 $code $reason`r`nContent-Type: application/json`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
    $h = [Text.Encoding]::ASCII.GetBytes($head)
    $stream.Write($h, 0, $h.Length); $stream.Write($body, 0, $body.Length); $stream.Flush()
}

$listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Any, $Port)
$listener.Start()
# Discovery: a UDP datagram "PCREMOTE_DISCOVER" on the same port gets {"name","port"} back,
# so the Deck finds the PC again after DHCP gives it a new IP. Reveals no secret.
$udp = [Net.Sockets.UdpClient]::new($Port)
$udp.EnableBroadcast = $true
Log "listening on $Port (tcp + udp discovery)"
while ($true) {
    if ($udp.Available -gt 0) {
        try {
            $from = [Net.IPEndPoint]::new([Net.IPAddress]::Any, 0)
            $msg = [Text.Encoding]::ASCII.GetString($udp.Receive([ref]$from))
            if ($msg -eq 'PCREMOTE_DISCOVER') {
                $b = [Text.Encoding]::UTF8.GetBytes((@{ name = $env:COMPUTERNAME; port = $Port } | ConvertTo-Json -Compress))
                [void]$udp.Send($b, $b.Length, $from)
            }
        } catch { Log "udp error: $_" }
        continue
    }
    if (-not $listener.Pending()) { Start-Sleep -Milliseconds 50; continue }
    $client = $listener.AcceptTcpClient()
    try {
        $client.ReceiveTimeout = 5000
        $stream = $client.GetStream()
        $reader = New-Object IO.StreamReader($stream, [Text.Encoding]::ASCII, $false, 4096, $true)
        $first = $reader.ReadLine()
        if (-not $first) { continue }
        $headers = @{}
        while (($l = $reader.ReadLine())) { $i = $l.IndexOf(':'); if ($i -gt 0) { $headers[$l.Substring(0, $i).Trim().ToLower()] = $l.Substring($i + 1).Trim() } }
        $method, $target = $first.Split(' ')[0, 1]
        $path, $qs = $target.Split('?', 2)
        $query = @{}
        if ($qs) { foreach ($kv in $qs.Split('&')) { $k, $v = $kv.Split('=', 2); $query[$k] = [Uri]::UnescapeDataString("$v") } }
        if ($headers['x-token'] -ne $token) { Reply $stream 401 @{ error = 'bad token' }; continue }
        $res = Handle $method $path $query
        if ($null -eq $res) { Reply $stream 404 @{ error = "no route $method $path" } } else { Reply $stream 200 $res }
        Log "$method $path"
    } catch {
        Log "error: $_"
        try { Reply $stream 500 @{ error = "$_" } } catch {}
    } finally { $client.Close() }
}
