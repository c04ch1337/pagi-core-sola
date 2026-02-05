# Start all PAGI Core Sola services: backend (Rust), bridge (Python), frontend (Vite).
# Run from repo root: .\scripts\start-all.ps1  or  powershell -ExecutionPolicy Bypass -File scripts\start-all.ps1
# Optional: copy .env.example to .env and set PAGI_HTTP_PORT, PAGI_GRPC_PORT, PAGI_FRONTEND_PORT.

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
if (-not (Test-Path $Root)) { $Root = (Get-Location).Path }
Set-Location $Root

# Load .env if present (simple key=value, no export)
if (Test-Path ".env") {
    Get-Content ".env" | ForEach-Object {
        if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2].Trim(), "Process")
        }
    }
    Write-Host "Loaded .env"
}

$HttpPort = [Environment]::GetEnvironmentVariable("PAGI_HTTP_PORT", "Process")
if (-not $HttpPort) { $HttpPort = "8000" }
$GrpcPort = [Environment]::GetEnvironmentVariable("PAGI_GRPC_PORT", "Process")
if (-not $GrpcPort) { $GrpcPort = "50051" }
$FrontendPort = [Environment]::GetEnvironmentVariable("PAGI_FRONTEND_PORT", "Process")
if (-not $FrontendPort) { $FrontendPort = "3000" }

Write-Host "Starting PAGI Core Sola (backend :$GrpcPort, bridge :$HttpPort, frontend :$FrontendPort)..."

# 1) Rust orchestrator (backend)
$CargoPath = Join-Path $Root "pagi-core-orchestrator"
if (Test-Path (Join-Path $CargoPath "Cargo.toml")) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$CargoPath'; `$env:PAGI_GRPC_PORT='$GrpcPort'; if (Test-Path '../.env') { Get-Content '../.env' | ForEach-Object { if (`$_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { Set-Item -Path \"env:\`$(`$matches[1])\" -Value `$matches[2].Trim() } } }; cargo run --release"
    Write-Host "  Started orchestrator (gRPC :$GrpcPort) in new window."
    Start-Sleep -Seconds 2
} else {
    Write-Warning "  Skipped orchestrator (pagi-core-orchestrator/Cargo.toml not found)."
}

# 2) Python bridge
$BridgePath = Join-Path $Root "pagi-intelligence-bridge"
if (Test-Path (Join-Path $BridgePath "pyproject.toml")) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$BridgePath'; `$env:PAGI_HTTP_PORT='$HttpPort'; `$env:PAGI_GRPC_PORT='$GrpcPort'; if (Test-Path '../.env') { Get-Content '../.env' | ForEach-Object { if (`$_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$') { Set-Item -Path \"env:\`$(`$matches[1])\" -Value `$matches[2].Trim() } } }; poetry run uvicorn src.main:app --port $HttpPort --reload"
    Write-Host "  Started bridge (HTTP :$HttpPort) in new window."
    Start-Sleep -Seconds 2
} else {
    Write-Warning "  Skipped bridge (pagi-intelligence-bridge/pyproject.toml not found)."
}

# 3) Frontend (Vite)
$FrontPath = Join-Path $Root "pagi-frontend"
if (Test-Path (Join-Path $FrontPath "package.json")) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$FrontPath'; `$env:PAGI_FRONTEND_PORT='$FrontendPort'; npm run dev"
    Write-Host "  Started frontend (port $FrontendPort) in new window."
} else {
    Write-Warning "  Skipped frontend (pagi-frontend/package.json not found)."
}

Write-Host ""
Write-Host "All services started. Open http://localhost:$FrontendPort for the UI."
Write-Host "Set Settings -> PAGI Bridge URL to http://127.0.0.1:$HttpPort (or 8001 if you use that port)."
Write-Host "Optional: run Qdrant for L4 memory (e.g. docker run -p 6334:6334 qdrant/qdrant)."
Write-Host "Close each service window to stop that service."
