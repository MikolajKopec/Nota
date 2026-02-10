# Trigger bot with a prompt (for scheduled tasks)
# Usage: powershell -File trigger-bot-prompt.ps1 "Your prompt here"

param(
    [Parameter(Mandatory=$true)]
    [string]$Prompt
)

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$logFile = Join-Path (Split-Path -Parent $projectRoot) "bot.log"
$triggerJs = Join-Path $projectRoot "dist\trigger.js"

function Write-Log {
    param([string]$Level, [string]$Message)
    $logLine = "[$timestamp] [$Level] [ps:trigger-prompt] $Message"
    Write-Host $logLine
    Add-Content -Path $logFile -Value $logLine -ErrorAction SilentlyContinue
}

Write-Log "INFO " "Starting trigger-bot-prompt.ps1"
Write-Log "DEBUG" "Script Dir: $scriptDir"
Write-Log "DEBUG" "Project Root: $projectRoot"
Write-Log "DEBUG" "Trigger JS: $triggerJs"
Write-Log "DEBUG" "Prompt: $($Prompt.Substring(0, [Math]::Min(100, $Prompt.Length)))"

if (-not (Test-Path $triggerJs)) {
    Write-Log "ERROR" "trigger.js not found at $triggerJs. Did you run 'npm run build'?"
    exit 1
}

Write-Log "INFO " "Invoking node with trigger.js"

try {
    $startTime = Get-Date
    node $triggerJs $Prompt
    $exitCode = $LASTEXITCODE
    $duration = (Get-Date) - $startTime

    if ($exitCode -eq 0) {
        Write-Log "INFO " "Success (duration: $($duration.TotalSeconds)s)"
    } else {
        Write-Log "ERROR" "Bot returned exit code $exitCode (duration: $($duration.TotalSeconds)s)"
        exit $exitCode
    }
} catch {
    Write-Log "ERROR" "Exception: $_"
    Write-Log "ERROR" "Exception details: $($_.Exception.Message)"
    exit 1
}
