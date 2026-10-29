# Builds the Prelegal image and (re)starts it at http://localhost:8000.
# Failures are detected with $LASTEXITCODE: docker writes progress to stderr, which
# Windows PowerShell would treat as an error under $ErrorActionPreference = "Stop".
Set-Location (Join-Path $PSScriptRoot "..")

docker build -t prelegal .
if ($LASTEXITCODE -ne 0) { throw "docker build failed" }

if (docker ps -aq --filter "name=^prelegal$") { docker rm -f prelegal | Out-Null }

# Pass secrets such as OPENROUTER_API_KEY at run time; they are never baked into the image.
$envArgs = @()
if (Test-Path .env) { $envArgs = @("--env-file", ".env") }
docker run -d --name prelegal -p 8000:8000 @envArgs prelegal | Out-Null
if ($LASTEXITCODE -ne 0) { throw "docker run failed" }

Write-Host "Prelegal is running at http://localhost:8000"
