# 🤖 Nota

> **Your AI Personal Assistant - Flat Rate, Unlimited Usage**
>
> Use your **Claude Code subscription** to build a powerful Telegram bot with Obsidian integration.
>
> **Already have Claude Code?** Get a personal assistant at **no extra cost**. Heavy users save $40-100/month vs API.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![grammy](https://img.shields.io/badge/grammy-1.35-green.svg)](https://grammy.dev/)

---

## 💡 Why Asystent?

Asystent leverages your **Claude Code CLI subscription** ($20/month flat rate) instead of pay-per-token API. This means **unlimited conversations** without counting tokens or worrying about usage costs.

**Perfect for:**
- 🧑‍💻 **Claude Code Users** - Already subscribed? Get a personal bot at no extra cost
- 📚 **Heavy Users** - Send 500+ messages/day and save $40-100/month vs API
- 🔐 **Privacy-conscious** - Local Whisper transcription, Obsidian vault stays on your machine
- 🎯 **Unlimited Usage** - No mental overhead tracking API costs or tokens

**Key Benefits:**
- ✅ **Flat rate unlimited** - $20/month Claude Code covers everything
- ✅ **No extra cost** - If you already use Claude Code for development
- ✅ **Local-first** - Whisper transcription runs locally, notes stored in Obsidian
- ✅ **Full privacy** - Your data stays local (except Claude Code API calls)
- ✅ **Extensible** - MCP (Model Context Protocol) for custom tools
- ✅ **Open source** - MIT licensed, modify as you wish

---

## ✨ What Can You Do?

### 💬 Natural Conversation
Talk to your bot in plain language - it understands context and remembers your preferences.

**Example:**
```
You: "Remind me daily at 9am to review my goals"
Bot: ✅ Scheduled! I'll send you a reminder every day at 09:00.

You: "Take a note: Meeting with John tomorrow - discuss Q1 roadmap"
Bot: 📝 Note saved in your vault!

You: "What notes do I have about project planning?"
Bot: 🔍 Found 3 notes: [Project Roadmap], [Q1 Planning], [Team Strategy]
```

### 🎤 Voice Messages → Text
Send voice messages, get instant transcription + intelligent response. Perfect for:
- Quick voice notes while commuting
- Capturing ideas hands-free
- Accessibility

**Powered by local Whisper** - no cloud transcription services, your voice stays private.

### 📝 Knowledge Management
Your Obsidian vault becomes a conversational database:

- **Create notes** - Just describe what you want to save
- **Search anything** - Natural language queries across all notes
- **Summarize content** - Links, articles, or your own notes
- **Auto-organize** - Bot suggests tags and links to related notes

### ⏰ Smart Reminders
Schedule tasks with natural language:

```
"Remind me in 2 minutes"
"Every Monday at 4pm, send me a week review"
"On my birthday, wish me happy birthday"
```

Tasks run independently (survives bot restart) with intelligent context generation.

### 📸 Web Analysis
Capture screenshots of websites, analyze content, extract information:

```
You: "Screenshot github.com/trending and summarize top 5 projects"
Bot: 📸 [image] Here are the top 5 trending repos today...
```

### 🧠 Persistent Memory
Bot maintains a separate "brain" vault to remember:
- Your preferences and habits
- Common tasks and patterns
- Project context across weeks/months
- Solutions to recurring problems

Next session picks up where you left off - no repeated explanations needed.

---

## 💰 Cost Analysis: When Does It Make Sense?

**Realistic Cost Comparison** (Claude Sonnet 4.5 with prompt caching):

| Daily Usage | Claude API | Claude Code | Difference |
|-------------|-----------|-------------|-----------|
| 50 msgs/day | ~$6/mo | $20/mo | ⚠️ API cheaper by $14 |
| 100 msgs/day | ~$12/mo | $20/mo | ⚠️ API cheaper by $8 |
| **200 msgs/day** | ~$24/mo | $20/mo | ✅ **Save $4/mo** |
| **500 msgs/day** | ~$60/mo | $20/mo | ✅ **Save $40/mo** |
| **1000 msgs/day** | ~$120/mo | $20/mo | ✅ **Save $100/mo** |

*API costs: Input $3/M tokens, Output $15/M tokens, Cache read $0.30/M tokens*

### 🎯 Asystent Makes Sense If:

✅ **You already have Claude Code** - Bot is "free" since you're paying $20/mo anyway
✅ **Heavy usage** - 200+ messages/day (breakeven at ~150 msgs/day)
✅ **Multiple use cases** - Using Claude Code for dev work + personal assistant
✅ **Unlimited peace of mind** - No mental overhead tracking tokens or costs
✅ **Privacy matters** - Local Whisper transcription, local Obsidian vault

### ⚠️ API Might Be Cheaper If:

- Light usage (<150 messages/day)
- Bot is your **only** Claude usage (not using CLI for anything else)
- You're okay with pay-per-use pricing

### 💡 The Real Value Proposition:

**Not "cheaper" - but "flat rate unlimited":**

1. **No usage anxiety** - Send 10 or 1000 messages, same cost
2. **Bundle value** - If you use Claude Code for dev, bot comes free
3. **Privacy** - Local transcription + Obsidian means your notes stay private
4. **Extensibility** - MCP protocol lets you add custom tools easily

**Bottom line:** Best for Claude Code subscribers who want a personal assistant without extra recurring costs.

---

## 🎬 Quick Start

### Prerequisites
- **Node.js** 18+ and npm/yarn/bun
- **Telegram Bot Token** (from [@BotFather](https://t.me/BotFather))
- **Obsidian** vault (can be empty to start)
- **Claude Code CLI** installed ([anthropics/claude-code](https://github.com/anthropics/claude-code))
- **Git Bash** (Windows only) or bash (macOS/Linux)

### Optional Prerequisites
- **Whisper WebUI** (for voice transcription) - [repo link](https://github.com/jhj0517/Whispering-WebUI)
- **Chrome/Edge** (for screenshots)
- **Task Scheduler** (Windows) or cron (Unix) for scheduled tasks

### Installation

**Option 1: Interactive Setup (Recommended)**

```bash
git clone https://github.com/yourusername/asystent.git
cd asystent
npm install
npx tsx setup.ts  # Run the setup wizard
```

The wizard will guide you through:
- Telegram bot configuration
- Obsidian vault paths
- Optional features (voice, scheduler, screenshots)
- MCP server setup

**Option 2: Manual Setup**

```bash
git clone https://github.com/yourusername/asystent.git
cd asystent/code
npm install

# Copy and configure environment variables
cp ../.env.example .env
# Edit .env with your configuration

# Copy and configure MCP servers
cp .mcp.json.example .mcp.json
# Edit .mcp.json with your vault paths

# Run the bot
npm run dev
```

### First Steps

1. **Start the bot**: `cd code && npm run dev`
2. **Open Telegram** and find your bot
3. **Send a message**: Try `/start` to verify authentication
4. **Create a note**: `/notatka Your first note content`
5. **Search**: `/szukaj keyword`

---

## ⚙️ Configuration

### Environment Variables (`.env`)

```bash
# Required
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl...  # From @BotFather
ALLOWED_USER_ID=123456789                      # Your Telegram user ID
CLAUDE_CODE_GIT_BASH_PATH=/path/to/bash       # Git bash path

# Optional
WHISPER_URL=http://localhost:7860              # Whisper WebUI endpoint
LOG_LEVEL=1                                    # 0=DEBUG, 1=INFO, 2=WARN, 3=ERROR
```

**How to get your Telegram User ID:**
1. Message [@userinfobot](https://t.me/userinfobot) on Telegram
2. Copy the numeric ID from the response

### MCP Configuration (`.mcp.json`)

Model Context Protocol servers provide the bot with access to external tools and data sources. See [.mcp.json.example](code/.mcp.json.example) for the full template.

**Required Servers:**
- **user-notes**: Your main Obsidian vault
- **memory**: Conversation context storage

**Optional Servers:**
- **brain**: Separate vault for bot's persistent memory
- **filesystem**: File system access for attachments
- **puppeteer**: Web automation and screenshots

Example configuration:

```json
{
  "mcpServers": {
    "user-notes": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@mauricio.wolff/mcp-obsidian@latest", "/path/to/vault"]
    }
  }
}
```

---

## 📖 Usage

### Commands

| Command | Description | Example |
|---------|-------------|---------|
| `/start` | Initialize bot and check authentication | `/start` |
| `/notatka` | Create a note in your Obsidian vault | `/notatka Meeting notes: ...` |
| `/szukaj` | Search across your notes | `/szukaj project ideas` |
| `/podsumuj` | Summarize text, links, or screenshots | `/podsumuj https://example.com` |
| `/tasks` | View and manage scheduled tasks | `/tasks` |
| `/new` | Start a new conversation session | `/new` |
| `/rewind` | Resume a previous session | `/rewind` |
| `/help` | Show help message | `/help` |

### Usage Examples

**Creating Notes:**
```
/notatka Project brainstorm
- Feature A: User authentication
- Feature B: Dark mode
- Feature C: Export functionality
```

**Voice Messages:**
Send a voice message → bot transcribes and processes it automatically

**Web Screenshots:**
```
Take a screenshot of https://github.com/trending
```

**Scheduled Tasks:**
```
Remind me daily at 9am to review my goals
```

**Search & Retrieve:**
```
/szukaj notes about machine learning from last month
```

---

## 🏛️ Architecture

### High-Level Overview

```
┌─────────────┐
│  Telegram   │  User sends message
│   Client    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│         Grammy Bot (bot.ts)         │
│  - Message routing & handling       │
│  - Authentication                   │
│  - Streaming response management    │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│    Claude Subprocess (claude.ts)    │
│  - Session management               │
│  - Streaming API interaction        │
│  - Cost tracking                    │
└──────┬──────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────┐
│   MCP Servers (.mcp.json)           │
│  - Obsidian vaults (user + brain)   │
│  - Filesystem access                │
│  - Puppeteer (screenshots)          │
│  - Memory (conversation context)    │
└─────────────────────────────────────┘
```

### Key Components

**1. Bot Handler (`code/src/bot.ts`)**
- Grammy framework for Telegram API
- Message queue (mutex) for serialization
- Streaming response with debounced edits
- Photo/voice message processing
- Command routing

**2. Claude Integration (`code/src/claude.ts`)**
- Subprocess wrapper for `claude -p` CLI
- NDJSON stream parser
- Session persistence (resume/rewind)
- System prompt injection from `.claude/CLAUDE.md`

**3. MCP Tools**
- **brain vault**: Bot's memory across sessions
- **user-notes vault**: Your Obsidian notes
- **filesystem**: File operations
- **puppeteer**: Web automation
- **memory**: Conversation context

**4. Task Scheduler (`code/.claude/skills/scheduler/`)**
- Natural language parsing for schedules
- Windows Task Scheduler / cron integration
- Intelligent triggers via `trigger-bot-prompt.ps1`
- Metadata tracking in brain vault

For detailed technical documentation, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## 🔧 Development

### Project Structure

```
asystent/
├── README.md                        # This file
├── ARCHITECTURE.md                  # Detailed technical docs
├── LICENSE                          # MIT License
├── setup.ts                         # Interactive setup wizard
├── .env.example                     # Environment template
├── bot.log                          # Runtime logs
├── sessions.json                    # Session history
└── code/                            # Main codebase
    ├── .claude/                     # Claude configuration
    │   ├── CLAUDE.md                # System prompt for subprocess
    │   └── skills/scheduler/        # Scheduler skill
    ├── .mcp.json                    # MCP configuration (gitignored)
    ├── .mcp.json.example            # MCP template
    ├── src/
    │   ├── index.ts                 # Entry point
    │   ├── bot.ts                   # Grammy bot handlers
    │   ├── claude.ts                # Claude subprocess wrapper
    │   ├── config.ts                # Environment config
    │   ├── logger.ts                # Logging system
    │   ├── transcribe.ts            # Whisper client
    │   └── trigger.ts               # Scheduled task entry point
    └── scripts/
        ├── screenshot.cjs           # Puppeteer screenshot utility
        └── trigger-bot-prompt.ps1   # Scheduled task runner
```

### Running Locally

```bash
# Development mode (with hot reload)
cd code
npm run dev

# Production build
npm run build
npm start

# View logs
tail -f ../bot.log  # Unix
Get-Content ..\bot.log -Wait -Tail 20  # Windows PowerShell
```

### Logging

Log levels: `0` (DEBUG), `1` (INFO), `2` (WARN), `3` (ERROR)

Set in `.env`:
```bash
LOG_LEVEL=0  # DEBUG - verbose logging
LOG_LEVEL=1  # INFO - default
```

Logs include:
- Session management
- Tool calls (MCP) with parameters
- Token usage and cost tracking
- Stream events
- Errors with stack traces

See [LOGGING.md](LOGGING.md) for details.

---

## 🐛 Troubleshooting

### Common Issues

**Bot doesn't respond:**
- Check `bot.log` for errors
- Verify Telegram bot token in `.env`
- Ensure your user ID matches `ALLOWED_USER_ID`

**Voice transcription fails:**
- Verify Whisper WebUI is running: `http://localhost:7860`
- Check `WHISPER_URL` in `.env`

**MCP connection errors:**
- Validate paths in `.mcp.json`
- Ensure Obsidian vaults exist and are accessible
- Check `npx` is available: `npx --version`

**Scheduled tasks not firing:**
- Windows: Check Task Scheduler event viewer
- Verify `CLAUDE_CODE_GIT_BASH_PATH` is correct
- Check task metadata in brain vault: `Asystent/scheduled-tasks.md`

**Screenshots fail:**
- Ensure Chrome/Edge is installed
- Check puppeteer logs in `bot.log`

### Debug Mode

Enable verbose logging:

```bash
# In .env
LOG_LEVEL=0

# View live logs
cd asystent
tail -f bot.log  # Unix
Get-Content bot.log -Wait -Tail 20  # PowerShell
```

---

## 🤝 Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Test thoroughly
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Style

- TypeScript with strict mode
- ESLint + Prettier (config TBD)
- Descriptive variable names
- Comments for complex logic
- Error handling for all async operations

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **[Claude Code](https://github.com/anthropics/claude-code)** - AI coding assistant CLI
- **[Grammy](https://grammy.dev/)** - Telegram bot framework
- **[Model Context Protocol (MCP)](https://modelcontextprotocol.io/)** - Tool integration standard
- **[Whisper WebUI](https://github.com/jhj0517/Whispering-WebUI)** - Speech transcription interface
- **[Obsidian](https://obsidian.md/)** - Knowledge management app

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/yourusername/asystent/issues)
- **Discussions**: [GitHub Discussions](https://github.com/yourusername/asystent/discussions)
- **Documentation**: [Wiki](https://github.com/yourusername/asystent/wiki)

---

**Made with ❤️ using Claude Code**
