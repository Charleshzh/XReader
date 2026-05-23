param(
    [Parameter(Mandatory = $true)]
    [string]$BinaryPath,

    [string]$AppDataRoot,

    [switch]$SeedDivergentDb,

    [string]$MigrationPath = "src-tauri/src/db/migrations/V1__initial_schema.sql",

    [int]$ReadySeconds = 5
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$resolvedBinaryPath = (Resolve-Path -Path $BinaryPath).Path
if (-not $AppDataRoot) {
    $AppDataRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("xreader-smoke-" + [guid]::NewGuid())
}

New-Item -ItemType Directory -Force -Path $AppDataRoot | Out-Null
$dataDir = Join-Path $AppDataRoot "xreader/XReader/data"
New-Item -ItemType Directory -Force -Path $dataDir | Out-Null

if ($SeedDivergentDb) {
    $resolvedMigrationPath = (Resolve-Path -Path $MigrationPath).Path
    python .github/scripts/seed_divergent_db.py --migration "$resolvedMigrationPath" --db (Join-Path $dataDir "xreader.db")
}

$previousAppData = $env:APPDATA
$process = $null

try {
    $env:APPDATA = $AppDataRoot
    $process = Start-Process -FilePath $resolvedBinaryPath -PassThru
    Start-Sleep -Seconds $ReadySeconds
    $process.Refresh()

    if ($process.HasExited) {
        throw "Startup smoke failed: process exited with code $($process.ExitCode)."
    }
}
finally {
    if ($process) {
        try {
            if (-not $process.HasExited) {
                taskkill /PID $process.Id /T /F | Out-Null
            }
        }
        catch {
            Write-Warning "Failed to terminate startup smoke process: $($_.Exception.Message)"
        }
    }

    $env:APPDATA = $previousAppData

    if (Test-Path -Path $AppDataRoot) {
        Remove-Item -Recurse -Force -Path $AppDataRoot
    }
}
