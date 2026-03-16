# Yurpass — Dev environment startup script
# Usage: powershell -ExecutionPolicy Bypass -File scripts/dev.ps1

Write-Host "Yurpass — Starting dev environment..." -ForegroundColor Magenta

# Check Docker Desktop is running
$docker = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
if (-not $docker) {
    Write-Host "ERROR: Docker Desktop is not running. Please start it first." -ForegroundColor Red
    exit 1
}

Write-Host "Docker Desktop detected." -ForegroundColor Green

# Copy .env.example to .env.local if not exists
if (-not (Test-Path ".env.local")) {
    Copy-Item ".env.example" ".env.local"
    Write-Host "Created .env.local from .env.example — please configure it." -ForegroundColor Yellow
}

# Start containers
Write-Host "Starting containers..." -ForegroundColor Cyan
docker-compose up --build
