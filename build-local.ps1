# Local MMIP Package Builder
# This script creates a .mmip package locally for testing
# 
# Supports MM5 5.0+

Write-Host "Building MMIP package locally..." -ForegroundColor Cyan

# Use fixed version for local builds (GitHub builds use info.json version)
$version = "0.0.1"

Write-Host "Local build version: $version" -ForegroundColor Green
Write-Host "MM5 Compatibility: 5.0+" -ForegroundColor Gray

# Create bin folder if it doesn't exist
$binFolder = "bin"
if (-not (Test-Path $binFolder)) {
	New-Item -ItemType Directory -Path $binFolder | Out-Null
	Write-Host "Created bin folder" -ForegroundColor Yellow
}

# Define package name
$packageName = Join-Path $binFolder "MatchMonkey-$version.mmip"

# Remove old package if it exists
if (Test-Path $packageName) {
	Remove-Item $packageName
	Write-Host "Removed existing package: $packageName" -ForegroundColor Yellow
}

# Verify required root files exist
Write-Host "`nVerifying root files..." -ForegroundColor Cyan
$rootFiles = @(
	"info.json",
	"init.js",
	"actions_add.js",
	"matchMonkey.js",
	"MatchMonkey.png",
	"README.md"
)

$missingFiles = @()
foreach ($file in $rootFiles) {
	if (-not (Test-Path $file)) {
		$missingFiles += $file
	}
}

# Verify required directories exist
Write-Host "Verifying directories..." -ForegroundColor Cyan
$requiredDirs = @("modules", "dialogs")

foreach ($dir in $requiredDirs) {
	if (-not (Test-Path $dir)) {
		$missingFiles += $dir
	}
}

if ($missingFiles.Count -gt 0) {
	Write-Host "ERROR: Missing files or directories:" -ForegroundColor Red
	foreach ($item in $missingFiles) {
		Write-Host "  - $item" -ForegroundColor Red
	}
	Write-Host "`nAborted build. Please check file paths." -ForegroundColor Red
	exit 1
}

Write-Host "All required files and directories verified ?" -ForegroundColor Green

# Create temporary staging directory for building proper structure
$stagingDir = "mmip_staging_$([System.Guid]::NewGuid().ToString().Substring(0,8))"

Write-Host "`nPreparing package structure in: $stagingDir" -ForegroundColor Cyan

try {
	# Create staging directory
	New-Item -ItemType Directory -Path $stagingDir | Out-Null

	# Copy root files
	foreach ($file in $rootFiles) {
		Copy-Item -Path $file -Destination (Join-Path $stagingDir $file) -Force
		Write-Host "  ? Copied: $file" -ForegroundColor Green
	}

	# Copy directories with full structure
	foreach ($dir in $requiredDirs) {
		$destPath = Join-Path $stagingDir $dir
		Copy-Item -Path $dir -Destination $destPath -Recurse -Force
		Write-Host "  ? Copied: $dir/ (with subdirectories)" -ForegroundColor Green
	}

	Write-Host "`nCreating archive with preserved directory structure..." -ForegroundColor Cyan

	# Compress-Archive only supports .zip extension, so we create a .zip then rename to .mmip
	$tempZipPath = Join-Path $binFolder "MatchMonkey-$version.zip"
	
	# Remove temp zip if it exists
	if (Test-Path $tempZipPath) {
		Remove-Item $tempZipPath -Force
	}

	# Compress entire staging directory as .zip
	Compress-Archive -Path (Join-Path $stagingDir "*") -DestinationPath $tempZipPath -Force

	# List package contents to verify structure BEFORE renaming
	Write-Host "`nPackage structure verification:" -ForegroundColor Cyan
	$tempExtract = "temp_verify_$([System.Guid]::NewGuid().ToString().Substring(0,8))"
	try {
		New-Item -ItemType Directory -Path $tempExtract | Out-Null
		# Verify using the .zip file before we rename it
		Expand-Archive -Path $tempZipPath -DestinationPath $tempExtract -Force
		
		Write-Host "Directory structure (first 20 items):" -ForegroundColor Gray
		Get-ChildItem $tempExtract -Recurse -File | 
			Select-Object @{Name="Path";Expression={$_.FullName.Substring((Get-Item $tempExtract).FullName.Length+1)}} |
			Sort-Object Path |
			Select-Object -First 20 |
			ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
	} finally {
		Remove-Item $tempExtract -Recurse -Force -ErrorAction SilentlyContinue
	}

	# NOW rename .zip to .mmip (after verification)
	Rename-Item -Path $tempZipPath -NewName "MatchMonkey-$version.mmip" -Force

	Write-Host "`nPackage created successfully!" -ForegroundColor Green
	Write-Host "File: $packageName" -ForegroundColor White

	# Show package details
	$fileInfo = Get-Item $packageName
	Write-Host "Size: $([math]::Round($fileInfo.Length / 1KB, 2)) KB" -ForegroundColor White
	Write-Host "Path: $($fileInfo.FullName)" -ForegroundColor White

	# Calculate SHA256 checksum
	Write-Host "`nCalculating checksum..." -ForegroundColor Cyan
	$hash = Get-FileHash -Path $packageName -Algorithm SHA256
	Write-Host "SHA256: $($hash.Hash)" -ForegroundColor Gray
	$checksumPath = Join-Path $binFolder "MatchMonkey-$version.mmip.sha256"
	$hash.Hash | Out-File -FilePath $checksumPath -NoNewline
	Write-Host "Checksum saved: $checksumPath" -ForegroundColor Green

	Write-Host "`n  Build complete! You can now install this package in MediaMonkey 5.0+" -ForegroundColor Green
	Write-Host "  Directory structure properly maintained (modules/, dialogs/)" -ForegroundColor Gray
	Write-Host "  Configuration initialized in init.js on first startup" -ForegroundColor Gray
	Write-Host "  Note: Local builds use version $version. GitHub builds use version from info.json." -ForegroundColor Yellow

} finally {
	# Cleanup staging directory
	if (Test-Path $stagingDir) {
		Remove-Item $stagingDir -Recurse -Force -ErrorAction SilentlyContinue
		Write-Host "`nCleaned up temporary files" -ForegroundColor Gray
	}
}
