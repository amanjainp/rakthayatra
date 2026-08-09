$ErrorActionPreference = "Stop"
$pgDir = "c:\Users\amanj\OneDrive\Documents\project\rakthayatra\pg_server"
$zipPath = "$pgDir\postgres.zip"
$extractDir = "$pgDir\pgsql"

if (-not (Test-Path $pgDir)) {
    New-Item -ItemType Directory -Force -Path $pgDir
}

# 1. Download PostgreSQL Windows Binaries zip
if (-not (Test-Path "$extractDir\bin\initdb.exe")) {
    Write-Host "[INFO] Downloading portable PostgreSQL binaries from EnterpriseDB (approx. 300MB)..."
    Invoke-WebRequest -Uri "https://get.enterprisedb.com/postgresql/postgresql-16.2-1-windows-x64-binaries.zip" -OutFile $zipPath
    Write-Host "[INFO] Extracting archives..."
    Expand-Archive -Path $zipPath -DestinationPath $pgDir
    Remove-Item -Force $zipPath
}

# 2. Initialize database cluster data directory
$dataDir = "$pgDir\data"
if (-not (Test-Path $dataDir)) {
    Write-Host "[INFO] Initializing PostgreSQL cluster data directory..."
    & "$extractDir\bin\initdb.exe" -U postgres -A trust -D $dataDir
}

# 3. Start PostgreSQL Server on port 5432
Write-Host "[INFO] Starting PostgreSQL server on localhost:5432..."
& "$extractDir\bin\pg_ctl.exe" -D $dataDir -l "$pgDir\postgres.log" -o "-p 5432" start

# Wait a few seconds for the engine to boot
Start-Sleep -Seconds 5

# 4. Create database 'rakthayatra'
Write-Host "[INFO] Creating database 'rakthayatra'..."
try {
    & "$extractDir\bin\createdb.exe" -U postgres -h localhost -p 5432 rakthayatra
} catch {
    Write-Host "[WARN] Database may already exist, proceeding..."
}

# 5. Run Prisma migrations and seed
Write-Host "[INFO] Synchronizing Prisma database schemas..."
$env:PATH = "c:\Users\amanj\OneDrive\Documents\project\rakthayatra\.node\node-v20.12.2-win-x64;" + $env:PATH
$env:DATABASE_URL = "postgresql://postgres:postgrespassword@localhost:5432/rakthayatra?schema=public"

cd "c:\Users\amanj\OneDrive\Documents\project\rakthayatra\backend"
& "c:\Users\amanj\OneDrive\Documents\project\rakthayatra\.node\node-v20.12.2-win-x64\npx.cmd" prisma db push
& "c:\Users\amanj\OneDrive\Documents\project\rakthayatra\.node\node-v20.12.2-win-x64\npx.cmd" prisma db seed

Write-Host "[INFO] Local PostgreSQL database configured successfully!"
