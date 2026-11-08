# Packs the game into dist/ember-swarm.zip for itch.io (index.html at the archive root).
# Run: powershell -ExecutionPolicy Bypass -File build.ps1
#
# Compress-Archive in Windows PowerShell 5.1 writes paths with backslashes, which
# breaks on itch.io's Linux servers, so the archive is built with .NET directly.

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = $PSScriptRoot
$dist = Join-Path $root 'dist'
$zipPath = Join-Path $dist 'ember-swarm.zip'

New-Item -ItemType Directory -Force $dist | Out-Null
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }

$files = @(Get-Item (Join-Path $root 'index.html'), (Join-Path $root 'style.css'))
$files += Get-ChildItem (Join-Path $root 'src') -Recurse -File

$zip = [System.IO.Compression.ZipFile]::Open($zipPath, 'Create')
try {
    foreach ($f in $files) {
        $entry = $f.FullName.Substring($root.Length + 1).Replace('\', '/')
        [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($zip, $f.FullName, $entry, 'Optimal') | Out-Null
        Write-Host "  + $entry"
    }
} finally {
    $zip.Dispose()
}

$sizeKb = [math]::Round((Get-Item $zipPath).Length / 1KB, 1)
Write-Host "Done: $zipPath ($sizeKb KB)"
