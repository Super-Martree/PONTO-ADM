$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ServiceName = "MartreePonto"
$Nssm = Join-Path $ProjectRoot "tools\nssm-2.24\win64\nssm.exe"

if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "Execute este script como Administrador."
}

if (-not (Test-Path $Nssm)) {
  throw "NSSM nao encontrado em: $Nssm"
}

$existing = Get-Service $ServiceName -ErrorAction SilentlyContinue
if (-not $existing) {
  Write-Host "Servico $ServiceName nao existe."
  exit 0
}

if ($existing.Status -ne "Stopped") {
  & $Nssm stop $ServiceName
  Start-Sleep -Seconds 2
}

& $Nssm remove $ServiceName confirm
