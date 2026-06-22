$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ServiceName = "MartreePonto"
$Nssm = Join-Path $ProjectRoot "tools\nssm-2.24\win64\nssm.exe"
$Npm = "C:\Program Files\nodejs\npm.cmd"
$Logs = Join-Path $ProjectRoot "logs"

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Execute este script como Administrador."
}

if (-not (Test-Path $Nssm)) {
  throw "NSSM nao encontrado em: $Nssm"
}

if (-not (Test-Path $Npm)) {
  throw "npm.cmd nao encontrado em: $Npm"
}

New-Item -ItemType Directory -Force $Logs | Out-Null

Push-Location $ProjectRoot
try {
  npm.cmd run service:prepare
}
finally {
  Pop-Location
}

$existing = Get-Service $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
  if ($existing.Status -ne "Stopped") {
    & $Nssm stop $ServiceName
    Start-Sleep -Seconds 2
  }

  & $Nssm remove $ServiceName confirm
}

& $Nssm install $ServiceName $Npm start
& $Nssm set $ServiceName AppDirectory $ProjectRoot
& $Nssm set $ServiceName AppStdout (Join-Path $Logs "service.out.log")
& $Nssm set $ServiceName AppStderr (Join-Path $Logs "service.err.log")
& $Nssm set $ServiceName AppRotateFiles 1
& $Nssm set $ServiceName AppRotateOnline 1
& $Nssm set $ServiceName AppRotateBytes 10485760
& $Nssm set $ServiceName Start SERVICE_AUTO_START
& $Nssm set $ServiceName AppStopMethodSkip 6
& $Nssm start $ServiceName

Get-Service $ServiceName | Format-Table -AutoSize
