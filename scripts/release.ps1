# Builds the portable exe and copies it to the app root.
# Usage (from _source):  powershell -ExecutionPolicy Bypass -File scripts\release.ps1
$ErrorActionPreference = 'Stop'
$src = Split-Path -Parent $PSScriptRoot
$app = Split-Path -Parent $src
Set-Location $src

$env:RUSTUP_HOME = [Environment]::GetEnvironmentVariable('RUSTUP_HOME', 'User')
$env:CARGO_HOME = [Environment]::GetEnvironmentVariable('CARGO_HOME', 'User')
if ($env:CARGO_HOME) { $env:PATH = "$env:CARGO_HOME\bin;$env:PATH" }
if (-not $env:TEMP -or $env:TEMP -like 'C:*') { $env:TEMP = 'D:\CLAUDE EDIT\_temp'; $env:TMP = $env:TEMP }

npx vitest run
if ($LASTEXITCODE) { throw 'tests failed' }
# Cargo caches the embedded Windows icon resource; touching build.rs forces it to re-embed icons\icon.ico.
(Get-Item 'src-tauri\build.rs').LastWriteTime = Get-Date
npx tauri build --no-bundle
if ($LASTEXITCODE) { throw 'tauri build failed' }

$exe = Join-Path $src 'src-tauri\target\release\mtr-check-list.exe'
Copy-Item $exe (Join-Path $app 'MTR Check list.exe') -Force
Write-Host "OK -> $app\MTR Check list.exe ($([math]::Round((Get-Item $exe).Length / 1MB, 1)) MB)"
