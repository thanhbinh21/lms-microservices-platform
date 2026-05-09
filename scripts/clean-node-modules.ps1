$rootPath = Resolve-Path "$PSScriptRoot\.."
$emptyDir = Join-Path $rootPath "empty_temp_dir"
if (!(Test-Path $emptyDir)) { New-Item -ItemType Directory -Path $emptyDir }

Write-Host "Searching for node_modules in $rootPath..."
# Find all node_modules directories
$nodeModules = Get-ChildItem -Path $rootPath -Filter node_modules -Recurse -Directory -ErrorAction SilentlyContinue | Select-Object -ExpandProperty FullName | Sort-Object -Descending # Sort descending to clean children first

foreach ($dir in $nodeModules) {
    if (Test-Path $dir) {
        Write-Host "Cleaning: $dir"
        # Use robocopy to wipe contents (handles long paths)
        robocopy $emptyDir $dir /mir /w:0 /r:0 /njh /njs /ndl /nc /ns /np > $null
        # Remove the now-empty directory
        Remove-Item -Path $dir -Force -Recurse -ErrorAction SilentlyContinue
    }
}

# Cleanup empty temp folder
Remove-Item -Path $emptyDir -Force -Recurse -ErrorAction SilentlyContinue
Write-Host "Done cleaning node_modules."
