# FoundMe Development Environment Setup Script
# This script automates the setup of the FoundMe development environment

Write-Host "🚀 FoundMe Development Environment Setup" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

# Check if Docker is running
Write-Host "`n📋 Checking Docker status..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    Write-Host "✅ Docker is available: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not available. Please install Docker Desktop and ensure it's running." -ForegroundColor Red
    exit 1
}

# Check if Docker Compose is available
Write-Host "`n📋 Checking Docker Compose..." -ForegroundColor Yellow
try {
    $composeVersion = docker-compose --version
    Write-Host "✅ Docker Compose is available: $composeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker Compose is not available. Please install Docker Compose." -ForegroundColor Red
    exit 1
}

# Check if required files exist
Write-Host "`n📋 Checking required files..." -ForegroundColor Yellow
$requiredFiles = @(
    "docker-compose.simple.yml",
    "backend/Dockerfile.dev",
    "backend/package.json",
    "backend/src/server.js",
    "env.simple"
)

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file exists" -ForegroundColor Green
    } else {
        Write-Host "❌ $file is missing" -ForegroundColor Red
        exit 1
    }
}

# Copy environment file
Write-Host "`n📋 Setting up environment..." -ForegroundColor Yellow
if (Test-Path ".env") {
    Write-Host "⚠️  .env file already exists, backing up..." -ForegroundColor Yellow
    Copy-Item ".env" ".env.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
}

Copy-Item "env.simple" ".env"
Write-Host "✅ Environment file created from env.simple" -ForegroundColor Green

# Create necessary directories if they don't exist
Write-Host "`n📋 Creating necessary directories..." -ForegroundColor Yellow
$directories = @(
    "database/postgres_data",
    "cache/redis_data",
    "logs"
)

foreach ($dir in $directories) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        Write-Host "✅ Created directory: $dir" -ForegroundColor Green
    } else {
        Write-Host "ℹ️  Directory already exists: $dir" -ForegroundColor Blue
    }
}

# Stop any existing containers
Write-Host "`n📋 Stopping existing containers..." -ForegroundColor Yellow
try {
    docker-compose -f docker-compose.simple.yml down
    Write-Host "✅ Stopped existing containers" -ForegroundColor Green
} catch {
    Write-Host "ℹ️  No existing containers to stop" -ForegroundColor Blue
}

# Build and start the environment
Write-Host "`n📋 Building and starting development environment..." -ForegroundColor Yellow
try {
    # Build the images
    Write-Host "🔨 Building Docker images..." -ForegroundColor Cyan
    docker-compose -f docker-compose.simple.yml build
    
    # Start the services
    Write-Host "🚀 Starting services..." -ForegroundColor Cyan
    docker-compose -f docker-compose.simple.yml up -d
    
    Write-Host "✅ Development environment started successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to start development environment" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Wait for services to be ready
Write-Host "`n⏳ Waiting for services to be ready..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check service status
Write-Host "`n📊 Checking service status..." -ForegroundColor Yellow
try {
    $status = docker-compose -f docker-compose.simple.yml ps
    Write-Host $status -ForegroundColor Cyan
} catch {
    Write-Host "❌ Failed to check service status" -ForegroundColor Red
}

# Display access information
Write-Host "`n🌐 Access Information:" -ForegroundColor Green
Write-Host "=====================" -ForegroundColor Green
Write-Host "Frontend: http://localhost:8472" -ForegroundColor Cyan
Write-Host "Backend API: http://localhost:3001" -ForegroundColor Cyan
Write-Host "Backend Health: http://localhost:3001/health" -ForegroundColor Cyan
Write-Host "PostgreSQL: localhost:7942" -ForegroundColor Cyan
Write-Host "Redis: localhost:6379" -ForegroundColor Cyan

Write-Host "`n📋 Default Credentials:" -ForegroundColor Green
Write-Host "=====================" -ForegroundColor Green
Write-Host "Database: foundme_dev" -ForegroundColor Cyan
Write-Host "Username: foundme_user" -ForegroundColor Cyan
Write-Host "Password: dev_password_secure_123" -ForegroundColor Cyan

Write-Host "`n🔧 Useful Commands:" -ForegroundColor Green
Write-Host "==================" -ForegroundColor Green
Write-Host "View logs: docker-compose -f docker-compose.simple.yml logs -f" -ForegroundColor Cyan
Write-Host "Stop services: docker-compose -f docker-compose.simple.yml down" -ForegroundColor Cyan
Write-Host "Restart services: docker-compose -f docker-compose.simple.yml restart" -ForegroundColor Cyan
Write-Host "View status: docker-compose -f docker-compose.simple.yml ps" -ForegroundColor Cyan

Write-Host "`n✅ Setup complete! Your FoundMe development environment is ready." -ForegroundColor Green
Write-Host "🎯 Next steps:" -ForegroundColor Yellow
Write-Host "   1. Open http://localhost:8472 in your browser" -ForegroundColor White
Write-Host "   2. Test the API at http://localhost:3001/health" -ForegroundColor White
Write-Host "   3. Start developing!" -ForegroundColor White
