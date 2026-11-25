# Removes the PC Remote agent (logon task, firewall rule, files).
param([int]$Port = 47990)
Unregister-ScheduledTask -TaskName 'PC Remote Agent' -Confirm:$false -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
    Where-Object CommandLine -like '*pc-remote-agent.ps1*' | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
$rules = "PC Remote Agent ($Port)", "PC Remote Agent discovery ($Port)" |
    Where-Object { Get-NetFirewallRule -DisplayName $_ -ErrorAction SilentlyContinue }
if ($rules) {
    $cmd = ($rules | ForEach-Object { "Remove-NetFirewallRule -DisplayName '$_'" }) -join '; '
    Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile', '-Command', $cmd
}
Remove-Item (Join-Path $env:APPDATA 'pc-remote') -Recurse -Force -ErrorAction SilentlyContinue
Write-Host 'PC Remote agent removed.'
