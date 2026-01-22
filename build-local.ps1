# Local MMIP Package Builder
# This script creates a .mmip package locally for testing

Write-Host "Building MMIP package locally..." -ForegroundColor Cyan

# Use fixed version for local builds (GitHub builds use info.json version)
$version = "0.0.1"

Write-Host "Local build version: $version" -ForegroundColor Green

# Create bin folder if it doesn't exist
$binFolder = "bin"
if (-not (Test-Path $binFolder)) {
    New-Item -ItemType Directory -Path $binFolder | Out-Null
    Write-Host "Created bin folder" -ForegroundColor Yellow
}

# Define package name
$packageName = Join-Path $binFolder "SimilarArtists-$version.mmip"

# Remove old package if it exists
if (Test-Path $packageName) {
    Remove-Item $packageName
    Write-Host "Removed existing package: $packageName" -ForegroundColor Yellow
}

# Create the MMIP package (ZIP file with .mmip extension)
$filesToInclude = @(
    "dialogs",
    "actions_add.js",
    "info.json",
    "init.js",
    "README.md",
    "similarArtists.js",
    "smiley_yellow_128.png"
)

Write-Host "Creating package..." -ForegroundColor Cyan

# Create a temporary zip file
$tempZip = "temp_package.zip"
if (Test-Path $tempZip) {
    Remove-Item $tempZip
}

# Compress files
Compress-Archive -Path $filesToInclude -DestinationPath $tempZip -Force

# Rename to .mmip
Move-Item -Path $tempZip -Destination $packageName -Force

Write-Host "`nPackage created successfully!" -ForegroundColor Green
Write-Host "File: $packageName" -ForegroundColor White

# Show package details
$fileInfo = Get-Item $packageName
Write-Host "Size: $([math]::Round($fileInfo.Length / 1KB, 2)) KB" -ForegroundColor White
Write-Host "Path: $($fileInfo.FullName)" -ForegroundColor White

# Optional: Calculate SHA256 checksum
$hash = Get-FileHash -Path $packageName -Algorithm SHA256
Write-Host "`nSHA256: $($hash.Hash)" -ForegroundColor Gray
$checksumPath = Join-Path $binFolder "SimilarArtists-$version.mmip.sha256"
$hash.Hash | Out-File -FilePath $checksumPath -NoNewline

Write-Host "`nBuild complete! You can now install this package in MediaMonkey." -ForegroundColor Green
Write-Host "Note: Local builds use version $version. GitHub builds use version from info.json." -ForegroundColor Yellow
