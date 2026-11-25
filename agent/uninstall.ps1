# Removes the PC Remote agent (logon task, firewall rule, files).
param([int]$Port = 47990)
Unregister-ScheduledTask -TaskName 'PC Remote Agent' -Confirm:$false -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
    Where-Object CommandLine -like '*pc-remote-agent.ps1*' | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
$rule = "PC Remote Agent ($Port)"
if (Get-NetFirewallRule -DisplayName $rule -ErrorAction SilentlyContinue) {
    Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile', '-Command', "Remove-NetFirewallRule -DisplayName '$rule'"
}
Remove-Item (Join-Path $env:APPDATA 'pc-remote') -Recurse -Force -ErrorAction SilentlyContinue
Write-Host 'PC Remote agent removed.'
