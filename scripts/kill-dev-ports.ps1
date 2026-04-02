# Giai phong cac port dev cua monorepo (Windows). Chay: pnpm dev:kill-ports
$ports = 3000, 3001, 3002, 3004, 3006, 3101
foreach ($port in $ports) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
    $procId = $_.OwningProcess
    if ($procId -and $procId -ne 0) {
      Write-Host "Stopping PID $procId (port $port)"
      Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
  }
}
Write-Host "Done."
