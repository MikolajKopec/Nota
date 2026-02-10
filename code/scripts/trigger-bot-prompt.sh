#!/bin/bash
# Trigger bot prompt - macOS/Linux version
# Spawns a new instance of claude subprocess with given prompt

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TRIGGER_JS="$PROJECT_ROOT/dist/trigger.js"
LOG_FILE="$PROJECT_ROOT/../bot.log"

# Log function
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    echo "[$timestamp] [$level] [sh:trigger-prompt] $message" | tee -a "$LOG_FILE"
}

log "INFO" "Starting trigger-bot-prompt.sh"
log "DEBUG" "Script Dir: $SCRIPT_DIR"
log "DEBUG" "Project Root: $PROJECT_ROOT"
log "DEBUG" "Trigger JS: $TRIGGER_JS"

# Get prompt from arguments
if [ -z "$1" ]; then
    log "ERROR" "No prompt provided"
    exit 1
fi

PROMPT="$1"
log "DEBUG" "Prompt: $PROMPT"

# Check if trigger.js exists
if [ ! -f "$TRIGGER_JS" ]; then
    log "ERROR" "trigger.js not found at $TRIGGER_JS"
    exit 1
fi

# Invoke node with trigger.js
log "INFO" "Invoking node with trigger.js"
START_TIME=$(date +%s)

cd "$PROJECT_ROOT" || exit 1
node "$TRIGGER_JS" "$PROMPT" 2>&1 | tee -a "$LOG_FILE"

EXIT_CODE=$?
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

if [ $EXIT_CODE -eq 0 ]; then
    log "INFO" "Success (duration: ${DURATION}s)"
else
    log "ERROR" "Failed with exit code $EXIT_CODE (duration: ${DURATION}s)"
fi

exit $EXIT_CODE
