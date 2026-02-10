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

## 💡 Why Nota?

Nota leverages your **Claude Code CLI subscription** ($20/month flat rate) instead of pay-per-token API. This means **unlimited conversations** without counting tokens or worrying about usage costs.

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

### 🎯 Nota Makes Sense If:

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

---

### 📋 Pre-Installation Checklist

Before running the setup wizard, gather the following information:

#### 1️⃣ **Create Your Telegram Bot**

1. Open Telegram and search for [@BotFather](https://t.me/BotFather)
2. Send `/newbot` command
3. Follow the prompts:
   - **Bot name**: Your bot's display name (e.g., "My Personal Assistant")
   - **Bot username**: Must end in "bot" (e.g., "my_assistant_bot")
4. **Save the token** - BotFather will send you a token like:
   ```
   123456789:ABCdefGHIjklMNOpqrsTUVwxyz
   ```
   ⚠️ Keep this token secret! Anyone with it can control your bot.

#### 2️⃣ **Get Your Telegram User ID**

1. In Telegram, search for [@userinfobot](https://t.me/userinfobot)
2. Start a chat or send any message
3. The bot will reply with your user ID (a numeric value like `123456789`)
4. **Save this ID** - only this user will be able to use your bot

#### 3️⃣ **Locate Git Bash Path** (Windows only)

The bot needs Git Bash to run certain commands. Find your installation:

**Common locations:**
```bash
C:\Program Files\Git\bin\bash.exe
C:\Program Files (x86)\Git\bin\bash.exe
```

**To verify:**
```bash
# In PowerShell or CMD
where bash
# or
Get-Command bash | Select-Object -ExpandProperty Source
```

**macOS/Linux:** Just use `/bin/bash`

#### 4️⃣ **Prepare Obsidian Vault Paths**

You need two Obsidian vaults:

**User Vault (Required):**
- This is your main notes vault
- Can be a new empty vault or existing one
- Example: `C:\Users\YourName\Documents\Obsidian\MyVault`

**Brain Vault (Recommended):**
- Separate vault for bot's persistent memory
- Recommended to keep bot memory separate from your notes
- Can create a new vault called "Claude Brain" or similar
- Example: `C:\Users\YourName\Documents\Obsidian\ClaudeBrain`

**To create a new vault in Obsidian:**
1. Open Obsidian
2. Click "Open another vault" → "Create new vault"
3. Name it and choose location
4. Copy the full path

#### 5️⃣ **Whisper WebUI (Optional - for voice messages)**

If you want voice transcription:

1. Clone the repo: [Whisper WebUI](https://github.com/jhj0517/Whispering-WebUI)
2. Follow installation instructions in their README
3. Start the server (usually runs on `http://localhost:7860`)
4. Keep it running while using voice messages

**Skip this if:** You don't plan to send voice messages to the bot.

---

### Installation

**Option 1: Interactive Setup (Recommended)**

```bash
git clone https://github.com/MikolajKopec/Nota.git
cd Nota
npx tsx setup.ts  # Run the setup wizard
```

The wizard will ask you for:

✅ **Telegram Bot Token** - From BotFather (see checklist above)
✅ **Your Telegram User ID** - From @userinfobot (see checklist above)
✅ **Git Bash Path** - Location of bash.exe (see checklist above)
✅ **Obsidian Vault Path** - Your main notes vault
✅ **Brain Vault Path** (optional) - Separate vault for bot memory
✅ **Whisper URL** (optional) - If using voice transcription
✅ **Optional Features** - Enable/disable voice, scheduler, screenshots

The wizard will then:
- Generate `.env` file with your configuration
- Generate `.mcp.json` with MCP server configuration
- Install dependencies automatically in `code/` directory
- Verify your setup

💡 **Tip:** Have the [Pre-Installation Checklist](#-pre-installation-checklist) information ready before running the wizard!

---

**Option 2: Manual Setup**

```bash
git clone https://github.com/MikolajKopec/Nota.git
cd Nota

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your configuration

# Navigate to code directory and install dependencies
cd code
npm install

# Copy and configure MCP servers
cp .mcp.json.example .mcp.json
# Edit .mcp.json with your vault paths

# Run the bot
npm run dev
```

### ✅ After Setup

Once the setup wizard completes (or manual setup is done):

1. **Navigate to the code directory:**
   ```bash
   cd code
   ```

2. **Start the bot:**
   ```bash
   npm run dev
   ```

   You should see:
   ```
   🤖 Bot started successfully!
   📝 Listening for messages...
   ```

3. **Open Telegram** and search for your bot (the username you created with BotFather)

4. **Test authentication:** Send `/start` to your bot
   - ✅ If authorized: You'll get a welcome message
   - ❌ If unauthorized: Check that `ALLOWED_USER_ID` in `.env` matches your Telegram ID

5. **Try basic commands:**
   ```
   /help              - See all available commands
   /notatka Test      - Create your first note
   /szukaj test       - Search for the note you just created
   ```

6. **Stop the bot:** Press `Ctrl+C` in the terminal

💡 **Next:** Check out the [Usage](#-usage) section for more commands and features!

---

### First Steps After Installation

Quick reference for getting started:

1. **Start the bot**: From the project root, run `cd code && npm run dev`
2. **Open Telegram** and find your bot
3. **Send a message**: Try `/start` to verify authentication
4. **Create a note**: `/notatka Your first note content`
5. **Search**: `/szukaj keyword`
6. **View logs**: `Get-Content bot.log -Wait -Tail 20` (PowerShell) or `tail -f bot.log` (Unix)

---

## ⚙️ Configuration

### Environment Variables

The setup wizard automatically creates `.env` in the **project root directory** (same level as `README.md`).

If you're configuring manually, create `.env` with:

```bash
# Required
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl...  # From @BotFather (see Pre-Installation Checklist)
ALLOWED_USER_ID=123456789                      # Your Telegram user ID (see Pre-Installation Checklist)
CLAUDE_CODE_GIT_BASH_PATH=/path/to/bash       # Git bash path (see Pre-Installation Checklist)

# Optional
WHISPER_URL=http://localhost:7860              # Whisper WebUI endpoint
LOG_LEVEL=1                                    # 0=DEBUG, 1=INFO, 2=WARN, 3=ERROR
```

💡 See [Pre-Installation Checklist](#-pre-installation-checklist) for how to get these values.

### MCP Configuration

The setup wizard automatically creates `.mcp.json` in the `code/` directory based on your vault paths.

If you're configuring manually, create `.mcp.json` in `code/` directory (see `code/.mcp.json.example` for the full template).

Model Context Protocol servers provide the bot with access to external tools and data sources.

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
nota/                                # Project root
├── README.md                        # This file
├── ARCHITECTURE.md                  # Detailed technical docs
├── LICENSE                          # MIT License
├── setup.ts                         # Interactive setup wizard
├── .env.example                     # Environment template
├── .env                             # Your environment config (create from .env.example)
├── bot.log                          # Runtime logs
├── sessions.json                    # Session history
└── code/                            # Main codebase
    ├── package.json                 # Node.js dependencies
    ├── tsconfig.json                # TypeScript configuration
    ├── .claude/                     # Claude configuration
    │   ├── CLAUDE.md                # System prompt for subprocess
    │   └── skills/scheduler/        # Scheduler skill
    ├── .mcp.json                    # MCP configuration (create from .mcp.json.example)
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
cd code        # Navigate to code directory if not already there
npm run dev

# Production build
npm run build
npm start

# View logs (from project root)
tail -f bot.log  # Unix
Get-Content bot.log -Wait -Tail 20  # Windows PowerShell
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

**Setup wizard fails:**
- Ensure you have Node.js 18+ installed: `node --version`
- Check that you have network access (wizard downloads dependencies)
- On Windows, run as administrator if you get permission errors
- If `npx tsx setup.ts` fails, try: `npm install -g tsx` then `tsx setup.ts`

**Bot doesn't respond:**
- Check `bot.log` for errors
- Verify Telegram bot token in `.env` matches the one from BotFather
- Ensure your user ID matches `ALLOWED_USER_ID`
- Try sending `/start` to initialize the bot
- Restart the bot: Stop with `Ctrl+C`, then `npm run dev` again

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
# In .env (located in project root)
LOG_LEVEL=0

# View live logs (from project root)
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

- **Issues**: [GitHub Issues](https://github.com/MikolajKopec/Nota/issues)
- **Discussions**: [GitHub Discussions](https://github.com/MikolajKopec/Nota/discussions)
- **Documentation**: [Wiki](https://github.com/MikolajKopec/Nota/wiki)

---

**Made with ❤️ using Claude Code**
