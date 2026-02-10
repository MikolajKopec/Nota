# 🏗️ Architecture Documentation

Deep technical documentation for Nota - the AI-powered Telegram bot for Obsidian integration.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Components](#core-components)
3. [Message Flow](#message-flow)
4. [Streaming Architecture](#streaming-architecture)
5. [Session Management](#session-management)
6. [MCP Integration](#mcp-integration)
7. [Task Scheduler](#task-scheduler)
8. [Security](#security)
9. [Performance](#performance)
10. [Limitations & Trade-offs](#limitations--trade-offs)

---

## System Overview

Nota is built on a **subprocess architecture** where the main bot process spawns Claude Code CLI instances for AI processing. This design provides:

- **Isolation**: Each Claude interaction runs in its own process
- **Streaming**: Real-time response updates via NDJSON streaming
- **MCP Access**: Claude subprocess has direct access to tools via Model Context Protocol
- **Session Persistence**: Conversations can be resumed across bot restarts

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Bot Framework | [Grammy](https://grammy.dev/) | Telegram Bot API wrapper |
| Runtime | Node.js 18+ | TypeScript execution |
| AI Model | Claude Code CLI | AI processing & tool use |
| Tool Protocol | MCP (Model Context Protocol) | Extensible tool integration |
| Voice Transcription | Whisper WebUI (Gradio) | Speech-to-text |
| Screenshots | Puppeteer | Web page capture |
| Scheduler | Windows Task Scheduler / cron | Recurring tasks |
| Knowledge Base | Obsidian (2 vaults) | Note storage |

---

## Core Components

### 1. Bot Handler (`code/src/bot.ts`)

**Responsibilities:**
- Telegram message routing
- User authentication
- Message queue management (mutex)
- Streaming response handling
- Photo/voice processing
- Command dispatching

**Key Features:**

**Handler Order (Critical!):**
```typescript
// Middleware runs in this exact order:
bot.use(hydrateFiles)        // File API integration
bot.use(authMiddleware)      // User authentication
bot.command('start')         // Start command
bot.command('new')           // New session
bot.command('rewind')        // Session history
bot.on('callback_query')     // Inline button callbacks
bot.command('test')          // Test command
bot.command('notatka')       // Note creation
bot.command('szukaj')        // Search
bot.command('podsumuj')      // Summarize
bot.on('message:voice')      // Voice messages
bot.on('message:photo')      // Photo messages
bot.on('message:text')       // Text messages (MUST BE LAST!)
```

**Mutex Queue:**

All handlers are wrapped in an `enqueue()` function that ensures serial processing:

```typescript
const queue: Array<() => Promise<void>> = [];
let isProcessing = false;

async function enqueue(task: () => Promise<void>) {
  queue.push(task);
  if (!isProcessing) {
    isProcessing = true;
    while (queue.length > 0) {
      const current = queue.shift()!;
      await current();
    }
    isProcessing = false;
  }
}
```

This prevents:
- Race conditions in session management
- Concurrent Claude subprocess spawning
- Telegram API rate limit violations

**Streaming Response:**

```typescript
async function handleStreamingResponse(
  ctx: Context,
  prompt: string,
  sessionId?: string
) {
  const placeholderMsg = await ctx.reply('🤔 Myślę...');

  let lastEditTime = 0;
  const EDIT_DEBOUNCE = 800; // ms

  const onChunk = (chunk: string, isPartial: boolean) => {
    accumulatedText += chunk;

    const now = Date.now();
    if (now - lastEditTime > EDIT_DEBOUNCE) {
      lastEditTime = now;
      editMessageSafely(ctx, placeholderMsg.message_id, accumulatedText);
    }
  };

  const result = await askClaudeStream(prompt, sessionId, onChunk);

  // Final update
  await editMessageSafely(ctx, placeholderMsg.message_id, result.text);
}
```

Key details:
- **Placeholder message**: Immediate feedback ("🤔 Myślę...")
- **Debounced edits**: Update every 800ms (not on every chunk)
- **Message splitting**: Auto-split if text exceeds 4096 chars
- **Image extraction**: `[IMG:path]` markers parsed and sent as photos

### 2. Claude Integration (`code/src/claude.ts`)

**Subprocess Wrapper:**

```typescript
async function askClaudeStream(
  prompt: string,
  sessionId?: string,
  onChunk?: (chunk: string, isPartial: boolean) => void
): Promise<ClaudeResponse>
```

**CLI Arguments:**

- **New session**: `claude -p --session-id <uuid> --system-prompt <path> --output-format stream-json --include-partial-messages --verbose`
- **Resumed session**: `claude --resume <uuid> -p --output-format stream-json --include-partial-messages --verbose`

**NDJSON Stream Parser:**

```typescript
function parseNDJSON(line: string): StreamEvent | ResultEvent {
  const parsed = JSON.parse(line);

  if (parsed.type === 'stream_event') {
    const event = parsed.data;

    switch (event.type) {
      case 'content_block_delta':
        if (event.delta.type === 'text_delta') {
          return { type: 'text', text: event.delta.text, isPartial: true };
        }
        break;

      case 'message_stop':
        return { type: 'end' };
    }
  }

  if (parsed.type === 'result') {
    return {
      type: 'result',
      sessionId: parsed.session_id,
      totalCost: parsed.total_cost_usd,
      ...parsed
    };
  }
}
```

**System Prompt Injection:**

The subprocess loads a **separate system prompt** from `code/.claude/CLAUDE.md`:

```bash
--system-prompt "$(cat code/.claude/CLAUDE.md)"
```

This isolates the subprocess context from the main Claude Code session. The bot has its own persona, instructions, and tool access.

### 3. Transcription (`code/src/transcribe.ts`)

**Whisper WebUI Integration:**

Uses Gradio API with two-step process:

1. **Upload audio file**: `POST /upload`
2. **Predict (transcribe)**: `POST /api/predict`

```typescript
async function transcribe(filePath: string): Promise<string> {
  // Step 1: Upload
  const uploadResponse = await fetch(`${WHISPER_URL}/upload`, {
    method: 'POST',
    body: formData
  });

  const uploadedPath = await uploadResponse.json();

  // Step 2: Transcribe
  const predictResponse = await fetch(`${WHISPER_URL}/api/predict`, {
    method: 'POST',
    body: JSON.stringify({
      fn_index: 0,  // Transcribe function
      data: [uploadedPath, 'transcribe', ...]
    })
  });

  return predictResponse.data[0];  // Transcribed text
}
```

### 4. Logger (`code/src/logger.ts`)

**Centralized Logging System:**

```typescript
enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  log(level: LogLevel, module: string, message: string, data?: any) {
    if (level < this.minLevel) return;

    const timestamp = new Date().toISOString();
    const levelStr = LogLevel[level];
    const logLine = `[${timestamp}] [${levelStr}] [${module}] ${message}`;

    // Write to file
    fs.appendFileSync(this.logFile, logLine + '\n');

    // Console output
    console.log(logLine);
    if (data) console.log(JSON.stringify(data, null, 2));
  }
}
```

**What Gets Logged:**

- Session lifecycle (create, resume, fail)
- Tool calls (name, ID, input params, result)
- Token usage (input/output, cache hits/misses)
- Stream events (message_start, content_block_delta, message_stop)
- Errors with stack traces
- Cost tracking per interaction

---

## Message Flow

### Standard Text Message

```
User sends text
     ↓
[Grammar Handler: message:text]
     ↓
enqueue() → mutex
     ↓
[handleStreamingResponse()]
     ↓
Send placeholder: "🤔 Myślę..."
     ↓
[askClaudeStream()] spawns subprocess
     ↓
Read CLAUDE.md system prompt
     ↓
Spawn: claude -p --session-id UUID --system-prompt ...
     ↓
NDJSON stream: line by line parsing
     ↓
onChunk() callback fires (debounced 800ms)
     ↓
Edit placeholder message with accumulated text
     ↓
Stream ends → final result
     ↓
[handleResponse()] extracts images, costs
     ↓
Send final message(s) + images
     ↓
Update session history
```

### Voice Message

```
User sends voice
     ↓
[Grammar Handler: message:voice]
     ↓
Download audio file → tmpdir
     ↓
[transcribe()] via Whisper WebUI
     ↓
Get transcribed text
     ↓
Reply with: "🎤 Transcript: ..."
     ↓
Continue with standard flow (text → Claude)
```

### Photo Message

```
User sends photo + caption
     ↓
[Grammar Handler: message:photo]
     ↓
Download largest photo → tmpdir
     ↓
Construct prompt: "User sent photo at <path>: <caption>"
     ↓
Continue with standard flow
     ↓
Claude subprocess can read image file via filesystem MCP
```

---

## Streaming Architecture

### Why Streaming?

- **User Experience**: Real-time feedback, feels responsive
- **Long Responses**: Edit message incrementally (not wait 30+ seconds)
- **Error Visibility**: See partial response even if stream fails
- **Cost Awareness**: Show running costs during generation

### Stream Event Types

**1. `stream_event` (API events):**

```json
{
  "type": "stream_event",
  "data": {
    "type": "message_start",
    "message": { "id": "msg_123", "model": "claude-sonnet-4-5", ... }
  }
}
```

```json
{
  "type": "stream_event",
  "data": {
    "type": "content_block_delta",
    "delta": { "type": "text_delta", "text": "Hello" }
  }
}
```

```json
{
  "type": "stream_event",
  "data": {
    "type": "message_stop"
  }
}
```

**2. `result` (final summary):**

```json
{
  "type": "result",
  "session_id": "uuid",
  "total_cost_usd": 0.0234,
  "usage": {
    "input_tokens": 1500,
    "output_tokens": 800,
    "cache_creation_tokens": 0,
    "cache_read_tokens": 1200
  }
}
```

### Debouncing Strategy

**Problem**: Editing Telegram message on every chunk (100+ times) causes:
- Rate limiting
- Flickering UI
- Wasted API calls

**Solution**: Debounce edits to max 1 per 800ms:

```typescript
const EDIT_DEBOUNCE = 800; // ms
let lastEditTime = 0;

const onChunk = (chunk: string) => {
  accumulatedText += chunk;

  const now = Date.now();
  if (now - lastEditTime > EDIT_DEBOUNCE) {
    lastEditTime = now;
    editMessageSafely(ctx, msgId, accumulatedText);
  }
};
```

### Message Splitting

Telegram limit: **4096 characters per message**

If response exceeds limit:

```typescript
function splitMessage(text: string, maxLength = 4096): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Find natural break point (newline or space)
    let splitIndex = remaining.lastIndexOf('\n', maxLength);
    if (splitIndex === -1) {
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIndex === -1) {
      splitIndex = maxLength;  // Hard cut
    }

    chunks.push(remaining.substring(0, splitIndex));
    remaining = remaining.substring(splitIndex + 1);
  }

  return chunks;
}
```

Mid-stream splitting: If message grows >4096 during streaming:
1. Send current accumulated text as new message
2. Start fresh accumulation in new message

---

## Session Management

### Session Object

```typescript
interface SessionData {
  id: string;           // UUID
  timestamp: Date;
  prompt: string;       // First message of session
  summary?: string;     // Short description
}
```

### Session Storage

**In-memory array** (max 10 sessions):

```typescript
const sessionHistory: SessionData[] = [];
const MAX_HISTORY = 10;

function saveSession(id: string, prompt: string) {
  sessionHistory.unshift({
    id,
    timestamp: new Date(),
    prompt: prompt.substring(0, 100)  // Truncate for display
  });

  if (sessionHistory.length > MAX_HISTORY) {
    sessionHistory.pop();
  }

  // Persist to disk
  fs.writeFileSync('sessions.json', JSON.stringify(sessionHistory, null, 2));
}
```

### Session Commands

**`/new` - Start Fresh:**

```typescript
bot.command('new', async (ctx) => {
  currentSessionId = undefined;  // Clear session
  await ctx.reply('🆕 Nowa sesja rozpoczęta!');
});
```

**`/rewind` - Resume Session:**

Shows inline keyboard with last 5 sessions:

```typescript
bot.command('rewind', async (ctx) => {
  const buttons = sessionHistory.slice(0, 5).map(session => [
    Keyboard.text({
      text: `${session.timestamp} - ${session.prompt}`,
      callback_data: `resume:${session.id}`
    })
  ]);

  await ctx.reply('Wybierz sesję:', { reply_markup: { inline_keyboard: buttons } });
});

bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;

  if (data.startsWith('resume:')) {
    const sessionId = data.substring(7);
    currentSessionId = sessionId;
    await ctx.answerCallbackQuery('✅ Sesja wznowiona!');
  }
});
```

### Resume Retry Logic

If resume fails (e.g., session expired in Claude), **auto-retry as new session**:

```typescript
async function askClaudeStream(
  prompt: string,
  sessionId?: string,
  onChunk?: ChunkCallback,
  isRetry = false
): Promise<ClaudeResponse> {
  try {
    const args = sessionId
      ? ['--resume', sessionId, '-p', ...]
      : ['-p', '--session-id', uuidv4(), ...];

    const result = await spawnClaudeProcess(args);
    return result;

  } catch (error) {
    if (sessionId && !isRetry) {
      logger.warn('claude', 'Resume failed, retrying as new session');
      return askClaudeStream(prompt, undefined, onChunk, true);
    }
    throw error;
  }
}
```

---

## MCP Integration

### What is MCP?

**Model Context Protocol** ([modelcontextprotocol.io](https://modelcontextprotocol.io/)) is a standard for connecting AI models to external tools and data sources.

### MCP Architecture in Asystent

```
Claude Subprocess
      ↓
  .mcp.json config
      ↓
  MCP Servers (stdio)
      ↓
┌─────────────────────────────────┐
│ brain          (Obsidian vault) │
│ user-notes     (Obsidian vault) │
│ filesystem     (File operations)│
│ puppeteer      (Web automation) │
│ memory         (Conversation)   │
└─────────────────────────────────┘
```

### MCP Servers

**1. brain (Obsidian vault)**

- **Purpose**: Bot's persistent memory across sessions
- **Path**: User-configured (e.g., `C:\...\claude`)
- **Package**: `@mauricio.wolff/mcp-obsidian`

**Usage:**
```typescript
mcp__brain__read_note("Home.md")
mcp__brain__write_note("Asystent/actions-log.md", content)
mcp__brain__search_notes({ query: "scheduled tasks" })
```

**2. user-notes (Obsidian vault)**

- **Purpose**: User's personal knowledge base
- **Path**: User-configured (e.g., `C:\...\Krypta`)
- **Package**: `@mauricio.wolff/mcp-obsidian`

**Usage:**
```typescript
mcp__user-notes__write_note("Daily/2026-02-10.md", content)
mcp__user-notes__search_notes({ query: "project ideas" })
```

**3. filesystem**

- **Purpose**: Read/write files outside Obsidian
- **Paths**: User-configured directories
- **Package**: `@modelcontextprotocol/server-filesystem`

**Usage:**
```typescript
mcp__filesystem__read_file("/path/to/file.txt")
mcp__filesystem__write_file("/path/to/output.txt", content)
```

**4. puppeteer**

- **Purpose**: Web automation, screenshots
- **Package**: `@modelcontextprotocol/server-puppeteer`
- **Config**: Headless mode enabled

**Usage:**
```typescript
mcp__puppeteer__screenshot({ url: "https://example.com" })
// Returns base64 PNG (but we use standalone script instead - see below)
```

**Note**: We actually use `scripts/screenshot.cjs` instead of MCP due to Windows CLI arg limit with base64.

**5. memory**

- **Purpose**: Conversation context (ephemeral)
- **Package**: `@modelcontextprotocol/server-memory`
- **Storage**: `code/memory.jsonl`

**Usage:**
```typescript
mcp__memory__create_entity({ name: "project_x", type: "project", ... })
mcp__memory__get_entities({ query: "recent projects" })
```

### Tool Allowlist

Only specific MCP tools are exposed to the Claude subprocess (configured in global `~/.claude.json`):

```json
{
  "projects": {
    "C:\\Users\\...\\asystent": {
      "allowedTools": [
        "mcp__user-notes__*",
        "mcp__brain__*",
        "mcp__filesystem__*",
        "mcp__puppeteer__*",
        "WebSearch",
        "WebFetch",
        "Bash"
      ]
    }
  }
}
```

This prevents Claude from:
- Editing the bot's own code
- Running arbitrary system commands (only allowed Bash)
- Accessing disallowed MCP servers

---

## Task Scheduler

### Architecture

**Intelligent Triggers** (not static messages):

```
Windows Task Scheduler
      ↓
trigger-bot-prompt.ps1
      ↓
node trigger.ts "Your prompt here"
      ↓
spawn claude -p subprocess (NEW INSTANCE)
      ↓
MCP tools access (brain, user-notes, WebSearch, etc.)
      ↓
Generate intelligent, contextual response
      ↓
Send to Telegram via bot API
```

### Scheduler Skill

Located in `code/.claude/skills/scheduler/`:

**Python Scripts:**
- `create_task.py` - Parse natural language → schtasks command
- `list_tasks.py` - List all Asystent_* tasks
- `delete_task.py` - Remove task
- `enable_task.py` - Enable disabled task
- `disable_task.py` - Temporarily disable task
- `get_task_history.py` - Show execution history

**Natural Language Parsing:**

```python
# Examples:
"za 2 minuty" → schedule 2 minutes from now
"codziennie o 09:00" → /sc daily /st 09:00
"w poniedziałki o 16:00" → /sc weekly /d MON /st 16:00
"co godzinę" → /sc hourly
```

**Date Format:** DD/MM/YYYY (deterministic, no locale issues)

### Metadata Tracking

All scheduled tasks tracked in `brain/Asystent/scheduled-tasks.md`:

```markdown
## Asystent_DailyGoalReview

- **Prompt**: "Review user's daily goals and send motivational message"
- **Schedule**: Daily at 09:00
- **Created**: 2026-02-10
- **Status**: ✅ Enabled
- **Last Run**: 2026-02-10 09:00

---

## Asystent_WeeklySummary

- **Prompt**: "Summarize user's week and suggest action items"
- **Schedule**: Weekly on Monday at 16:00
- **Created**: 2026-02-09
- **Status**: ⏸️ Disabled
- **Last Run**: Never
```

### Task Naming Convention

All bot tasks prefixed with `Asystent_`:

```
Asystent_DailyGoalReview
Asystent_WeeklySummary
Asystent_AfternoonCheckIn
```

This allows easy filtering:

```powershell
schtasks /query /fo LIST | Select-String "Asystent_"
```

### `/tasks` Command

Lists all scheduled tasks with management options:

```
📋 Scheduled Tasks

✅ DailyGoalReview
   Daily at 09:00
   "Review daily goals"
   [Disable] [Delete]

⏸️ WeeklySummary (disabled)
   Weekly Monday 16:00
   "Summarize week"
   [Enable] [Delete]
```

Inline buttons allow direct management (no CLI needed).

---

## Security

### Authentication

**Telegram User ID Whitelist:**

```typescript
const ALLOWED_USER_ID = parseInt(process.env.ALLOWED_USER_ID!);

bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;

  if (userId !== ALLOWED_USER_ID) {
    await ctx.reply('⛔ Unauthorized. This bot is private.');
    return;
  }

  await next();
});
```

**Why User ID (not username)?**
- Username can change
- User ID is immutable
- No brute-force risk (numeric, but high entropy)

### MCP Tool Restrictions

Global `~/.claude.json` allowlist prevents:
- Writing bot source code
- Running destructive system commands
- Accessing sensitive directories

**Example restriction:**

```json
{
  "allowedTools": [
    "mcp__user-notes__*",   // OK
    "mcp__brain__*",        // OK
    "Edit",                 // ❌ NOT ALLOWED
    "Write",                // ❌ NOT ALLOWED
    "Bash"                  // ⚠️ Limited to allowed commands
  ]
}
```

### Environment Variables

**Sensitive data in `.env` (gitignored):**

```bash
TELEGRAM_BOT_TOKEN=...     # Never commit!
ALLOWED_USER_ID=...        # Private
```

**.env.example** provides template (no secrets).

### Subprocess Isolation

Each Claude invocation is **isolated**:
- Separate process
- Own system prompt (`.claude/CLAUDE.md`)
- No access to main session context
- Limited tool access via MCP allowlist

---

## Performance

### Metrics

**Typical Latencies:**

| Operation | Time | Notes |
|-----------|------|-------|
| Text message → response start | ~2-3s | Claude API cold start |
| Streaming first token | ~1-2s | After request sent |
| Full response (200 tokens) | ~5-10s | Streamed incrementally |
| Voice transcription | ~3-5s | Whisper WebUI |
| Screenshot capture | ~2-4s | Puppeteer load time |
| MCP tool call | ~100-500ms | Depends on tool |

**Token Usage (typical):**

- **Input**: 1500-3000 tokens (system prompt + MCP tools + conversation)
- **Output**: 200-800 tokens (depends on task)
- **Cache hits**: 80-90% (system prompt cached after first use)

**Costs (estimated):**

- **Simple query**: $0.01-0.03
- **With tool use**: $0.03-0.08
- **Complex multi-tool**: $0.10-0.20

Cache hits drastically reduce input token costs (~10x cheaper).

### Optimizations

**1. Input Cache (Prompt Caching):**

System prompt from `.claude/CLAUDE.md` is ~1200 tokens. With caching:
- **First request**: Full input tokens charged
- **Subsequent requests**: 10x cheaper (cache read tokens)

Cache TTL: ~5 minutes (Anthropic's default).

**2. Debounced Message Edits:**

Without debouncing: 100+ Telegram API calls per response
With 800ms debouncing: ~10 API calls per response

**3. Mutex Queue:**

Prevents concurrent subprocess spawning (resource usage):
- Max 1 Claude process at a time
- Max RAM: ~200-300 MB per process
- No race conditions

**4. Session Reuse:**

Resume sessions to maintain:
- Conversation context
- Cached system prompt
- MCP connection state

**5. Lazy Loading:**

- Whisper WebUI only initialized if voice message received
- Puppeteer only for screenshot requests
- MCP servers spawned on-demand by Claude

---

## Limitations & Trade-offs

### Known Limitations

**1. Single User:**
- Only 1 Telegram user allowed (by design)
- Scaling to multi-user requires: user-specific sessions, vault isolation, cost tracking per user

**2. No Concurrent Requests:**
- Mutex queue enforces serial processing
- Multiple messages → queued (not parallel)
- Trade-off: Prevents race conditions, but slower for rapid-fire messages

**3. Session Limit:**
- Max 10 sessions in memory
- Older sessions discarded
- No persistent session storage beyond `sessions.json`

**4. Windows CLI Arg Limit:**
- Max ~8KB for command arguments
- Why we use external `screenshot.cjs` instead of inline base64
- Affects: Large data passing to Bash scripts

**5. Whisper WebUI Dependency:**
- Voice transcription requires separate service (port 7860)
- Not bundled with bot
- Fails gracefully if unavailable

**6. Telegram API Limits:**
- 4096 char per message (auto-split implemented)
- ~20 edits per minute (debouncing mitigates)
- File size limits (20 MB for photos)

### Design Trade-offs

**Subprocess vs. SDK:**

| Approach | Pros | Cons |
|----------|------|------|
| **Subprocess** (current) | Isolated context, easy MCP, streaming CLI, resume sessions | Overhead (spawn latency), harder to debug |
| **SDK** (alternative) | Direct API, faster, more control | No MCP, no CLI features (resume, etc.), more code |

**Decision**: Subprocess wins due to MCP and CLI features.

**Polling vs. Webhooks:**

| Approach | Pros | Cons |
|----------|------|------|
| **Polling** (current) | No server setup, works anywhere, simple | Slight latency (~1s), uses bandwidth |
| **Webhooks** | Instant messages, efficient | Requires public URL, SSL, server config |

**Decision**: Polling for simplicity (personal bot, low traffic).

**Two Vaults vs. One:**

| Approach | Pros | Cons |
|----------|------|------|
| **Two vaults** (current) | Separation of concerns, user privacy | More config, duplication risk |
| **One vault** | Simpler setup | Bot memory mixed with user notes |

**Decision**: Two vaults for clear separation (user data vs. bot state).

### Future Improvements

**Potential Enhancements:**

1. **Multi-user support** - Database for sessions, per-user vaults
2. **Parallel processing** - Multiple concurrent Claude subprocesses
3. **Webhook mode** - Instant message delivery
4. **Richer media** - Video, document, audio file support
5. **Claude API SDK** - Replace subprocess with direct API calls (trade-offs)
6. **Persistent sessions** - Store session state in database (not just in-memory)
7. **Analytics dashboard** - Track usage, costs, popular commands
8. **Plugin system** - Extensible MCP servers without code changes

---

## Debugging

### Log Analysis

**Enable DEBUG logging:**

```bash
# .env
LOG_LEVEL=0
```

**Tail logs:**

```bash
# Unix
tail -f bot.log

# Windows PowerShell
Get-Content bot.log -Wait -Tail 20
```

**Log patterns to watch:**

```
[INFO] [session] Created new session: <uuid>
[DEBUG] [claude] Spawning subprocess: claude -p --session-id ...
[DEBUG] [mcp] Tool call: mcp__user-notes__write_note
[DEBUG] [stream] Stream event: content_block_delta
[INFO] [tokens] Usage: input=1500 output=200 cache_hit=1200
[ERROR] [claude] Subprocess error: ...
```

### Common Issues

**Issue: Session resume fails**

**Log:**
```
[WARN] [claude] Resume failed, retrying as new session
```

**Cause:** Session expired in Claude (TTL ~5-10 min)

**Solution:** Automatic retry as new session (already implemented)

---

**Issue: MCP connection error**

**Log:**
```
[ERROR] [mcp] Failed to connect to server: brain
```

**Cause:** Vault path incorrect in `.mcp.json`

**Solution:** Verify paths, ensure `npx` available

---

**Issue: Telegram edit message error**

**Log:**
```
[ERROR] [bot] editMessageText failed: message is not modified
```

**Cause:** Trying to edit with identical text

**Solution:** Already handled (try-catch ignores this error)

---

## Conclusion

Nota's architecture prioritizes:

- **Simplicity**: Minimal dependencies, clear abstractions
- **Extensibility**: MCP allows adding tools without code changes
- **User Experience**: Streaming, real-time feedback, natural language
- **Reliability**: Graceful failures, retry logic, comprehensive logging

The subprocess design, while unconventional, provides unique benefits (MCP, streaming, isolation) that outweigh the overhead for a personal assistant bot.

---

**Questions or feedback?** Open an issue on [GitHub](https://github.com/yourusername/asystent/issues).
