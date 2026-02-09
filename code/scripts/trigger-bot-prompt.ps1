# Trigger bot with a prompt (for scheduled tasks)
# Usage: powershell -File trigger-bot-prompt.ps1 "Your prompt here"

param(
    [Parameter(Mandatory=$true)]
    [string]$Prompt
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$triggerJs = Join-Path $projectRoot "dist\trigger.js"

if (-not (Test-Path $triggerJs)) {
    Write-Error "trigger.js not found at $triggerJs. Did you run 'npm run build'?"
    exit 1
}

Write-Host "[trigger-bot-prompt] Invoking bot with prompt: $Prompt"

try {
    node $triggerJs $Prompt
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
        Write-Host "[trigger-bot-prompt] Success"
    } else {
        Write-Error "[trigger-bot-prompt] Bot returned exit code $exitCode"
        exit $exitCode
    }
} catch {
    Write-Error "[trigger-bot-prompt] Error: $_"
    exit 1
}
