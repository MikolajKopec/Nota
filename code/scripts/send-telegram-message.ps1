# Send message via Telegram Bot API
# Usage: powershell -File send-telegram-message.ps1 "Your message here"

param(
    [Parameter(Mandatory=$true)]
    [string]$Message
)

# Load .env file
$envFile = Join-Path $PSScriptRoot "..\.env"
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+?)\s*=\s*(.+?)\s*$') {
            $name = $matches[1]
            $value = $matches[2]
            Set-Variable -Name $name -Value $value -Scope Script
        }
    }
}

if (-not $TELEGRAM_BOT_TOKEN -or -not $ALLOWED_USER_ID) {
    Write-Error "Missing TELEGRAM_BOT_TOKEN or ALLOWED_USER_ID in .env"
    exit 1
}

$url = "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage"
$body = @{
    chat_id = $ALLOWED_USER_ID
    text = $Message
    parse_mode = "HTML"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri $url -Method Post -Body $body -ContentType "application/json"
    Write-Host "Message sent successfully"
    exit 0
} catch {
    Write-Error "Failed to send message: $_"
    exit 1
}
