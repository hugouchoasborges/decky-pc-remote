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
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$agent`" -Port $Port"
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
Register-ScheduledTask -TaskName $name -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
Stop-ScheduledTask -TaskName $name -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName $name

$rule = "PC Remote Agent ($Port)"
if (-not (Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue)) {
    $cmd = "New-NetFirewallRule -DisplayName '$rule' -Direction Inbound -Protocol TCP -LocalPort $Port -Profile Private -Action Allow"
    Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile', '-Command', $cmd
}

$ips = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.PrefixOrigin -in 'Dhcp', 'Manual' -and $_.IPAddress -notlike '169.*' }).IPAddress
Write-Host "PC Remote agent running on port $Port"
Write-Host "Host:  $($ips -join ', ')"
Write-Host "Token: $((Get-Content $tokenFile -Raw).Trim())"
