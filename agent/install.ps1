# Installs the PC Remote agent for the current user:
# - creates the token (%APPDATA%\pc-remote\token.txt) if it does not exist
# - copies the agent to %APPDATA%\pc-remote
# - registers a logon task that starts it hidden in your session, and starts it now
# - opens the port in Windows Firewall for private networks (asks for admin once)
param([int]$Port = 47990)
$ErrorActionPreference = 'Stop'
$dir = Join-Path $env:APPDATA 'pc-remote'
New-Item -ItemType Directory -Force $dir | Out-Null
$tokenFile = Join-Path $dir 'token.txt'
if (-not (Test-Path $tokenFile)) {
    $chars = 'abcdefghjkmnpqrstuvwxyz23456789'.ToCharArray()
    -join (1..8 | ForEach-Object { $chars | Get-Random }) | Set-Content $tokenFile -NoNewline
}
Copy-Item (Join-Path $PSScriptRoot 'pc-remote-agent.ps1') $dir -Force
$agent = Join-Path $dir 'pc-remote-agent.ps1'

$name = 'PC Remote Agent'
# conhost --headless runs PowerShell with no console window at all (not even a flash).
$action = New-ScheduledTaskAction -Execute 'conhost.exe' `
    -Argument "--headless powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$agent`" -Port $Port"
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
# Any earlier copy still holding the port would make the new one fail to start.
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
    Where-Object CommandLine -like '*pc-remote-agent.ps1*' | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Milliseconds 500
Start-ScheduledTask -TaskName $name

# TCP for commands, UDP for discovery (the Deck finds the PC again when its IP changes).
$rule = "PC Remote Agent ($Port)"
$ruleUdp = "PC Remote Agent discovery ($Port)"
$cmds = @()
if (-not (Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue)) {
    $cmds += "New-NetFirewallRule -DisplayName '$rule' -Direction Inbound -Protocol TCP -LocalPort $Port -Profile Private -Action Allow"
}
if (-not (Get-NetFirewallRule -DisplayName $ruleUdp -ErrorAction SilentlyContinue)) {
    $cmds += "New-NetFirewallRule -DisplayName '$ruleUdp' -Direction Inbound -Protocol UDP -LocalPort $Port -Profile Private -Action Allow"
}
if ($cmds) { Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile', '-Command', ($cmds -join '; ') }

$ips = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -in 'Dhcp', 'Manual' -and $_.IPAddress -notlike '169.*' }).IPAddress
Write-Host "PC Remote agent running on port $Port"
Write-Host "Host:  $($ips -join ', ')"
Write-Host "Token: $((Get-Content $tokenFile -Raw).Trim())"
