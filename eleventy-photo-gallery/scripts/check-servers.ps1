# Check if Kanri admin server and Eleventy dev server are running
# Usage: .\scripts\check-servers.ps1

Write-Host "Checking server status..." -ForegroundColor Cyan
Write-Host ""

$adminPort = 8686
$eleventyPort = 8080

# Check Admin Server (port 8686)
$adminCheck = netstat -ano | findstr ":$adminPort"
if ($adminCheck) {
    Write-Host "✓ Admin Server (port $adminPort)" -ForegroundColor Green
    Write-Host "  Status: RUNNING" -ForegroundColor Green
    Write-Host "  URL: http://localhost:$adminPort" -ForegroundColor Gray
} else {
    Write-Host "✗ Admin Server (port $adminPort)" -ForegroundColor Red
    Write-Host "  Status: NOT RUNNING" -ForegroundColor Red
    Write-Host "  Run: npm run watch:admin" -ForegroundColor Yellow
}

Write-Host ""

# Check Eleventy Server (port 8080)
$eleventyCheck = netstat -ano | findstr ":$eleventyPort"
if ($eleventyCheck) {
    Write-Host "✓ Eleventy Server (port $eleventyPort)" -ForegroundColor Green
    Write-Host "  Status: RUNNING" -ForegroundColor Green
    Write-Host "  URL: http://localhost:$eleventyPort" -ForegroundColor Gray
} else {
    Write-Host "✗ Eleventy Server (port $eleventyPort)" -ForegroundColor Red
    Write-Host "  Status: NOT RUNNING" -ForegroundColor Red
    Write-Host "  Run: npm run watch:eleventy" -ForegroundColor Yellow
}

Write-Host ""

# Summary
if ($adminCheck -and $eleventyCheck) {
    Write-Host "All servers are running! ✓" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some servers are not running. Please start them before uploading." -ForegroundColor Yellow
    exit 1
}

