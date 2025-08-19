# Rebuild ReconFTW Docker Container with OSINT Tools
# This script rebuilds the ReconFTW container with all the necessary tools

Write-Host "🔧 Rebuilding ReconFTW container with OSINT tools..." -ForegroundColor Green

# Check if Docker is running
try {
    docker version | Out-Null
    Write-Host "✅ Docker is running" -ForegroundColor Green
} catch {
    Write-Host "❌ Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Navigate to project root
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptPath
Set-Location $projectRoot

Write-Host "📁 Working directory: $((Get-Location).Path)" -ForegroundColor Blue

# Stop existing ReconFTW container if running
Write-Host "🛑 Stopping existing ReconFTW containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.simple.yml stop reconftw 2>$null
docker-compose -f docker-compose.simple.yml rm -f reconftw 2>$null

# Remove existing ReconFTW image to force rebuild
Write-Host "🗑️ Removing existing ReconFTW image..." -ForegroundColor Yellow
docker rmi foundme-reconftw 2>$null

# Build new ReconFTW image
Write-Host "🔨 Building new ReconFTW image with OSINT tools..." -ForegroundColor Blue
Write-Host "This may take 10-15 minutes as Go tools are compiled..." -ForegroundColor Yellow

$buildOutput = docker build -t foundme-reconftw ./reconftw 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ ReconFTW image built successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to build ReconFTW image:" -ForegroundColor Red
    Write-Host $buildOutput -ForegroundColor Red
    exit 1
}

# Start the container
Write-Host "🚀 Starting ReconFTW container..." -ForegroundColor Blue
docker-compose -f docker-compose.simple.yml up -d reconftw

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ ReconFTW container started successfully!" -ForegroundColor Green
    
    # Wait a moment for container to fully start
    Start-Sleep -Seconds 5
    
    # Test the ReconFTW service
    Write-Host "🧪 Testing ReconFTW service..." -ForegroundColor Blue
    try {
        $testResponse = Invoke-RestMethod -Uri "http://localhost:3001/test/reconftw" -Method GET -TimeoutSec 30
        
        if ($testResponse.success) {
            Write-Host "✅ ReconFTW service test completed successfully!" -ForegroundColor Green
            
            # Show available tools
            $availableTools = $testResponse.result.toolStatus | Get-Member -MemberType NoteProperty | Where-Object { $testResponse.result.toolStatus.($_.Name).available } | ForEach-Object { $_.Name }
            $unavailableTools = $testResponse.result.toolStatus | Get-Member -MemberType NoteProperty | Where-Object { -not $testResponse.result.toolStatus.($_.Name).available } | ForEach-Object { $_.Name }
            
            Write-Host "📊 Tool Status:" -ForegroundColor Blue
            Write-Host "   Available: $($availableTools -join ', ')" -ForegroundColor Green
            Write-Host "   Unavailable: $($unavailableTools -join ', ')" -ForegroundColor Red
            
            if ($availableTools.Count -gt $unavailableTools.Count) {
                Write-Host "🎉 Most tools are now available!" -ForegroundColor Green
            }
        } else {
            Write-Host "⚠️ ReconFTW service test failed:" -ForegroundColor Yellow
            Write-Host $testResponse.error -ForegroundColor Red
        }
    } catch {
        Write-Host "❌ Failed to test ReconFTW service:" -ForegroundColor Red
        Write-Host $_.Exception.Message -ForegroundColor Red
    }
} else {
    Write-Host "❌ Failed to start ReconFTW container" -ForegroundColor Red
    exit 1
}

Write-Host "🏁 ReconFTW rebuild complete!" -ForegroundColor Green
Write-Host "You can now test the service at: http://localhost:3001/test/reconftw" -ForegroundColor Blue
