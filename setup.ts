#!/usr/bin/env tsx
/**
 * Asystent Setup Wizard
 * Interactive configuration tool for setting up the Telegram bot
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { execSync } from 'child_process';
import * as readline from 'readline';

// Simple inquirer-like interface using readline
interface Question {
  name: string;
  message: string;
  default?: string;
  required?: boolean;
  validate?: (value: string) => boolean | string;
}

class Prompt {
  private rl: readline.Interface;

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  async ask(question: Question): Promise<string> {
    return new Promise((resolve) => {
      const defaultText = question.default ? ` (${question.default})` : '';
      const requiredText = question.required ? ' *' : '';

      this.rl.question(
        `${question.message}${defaultText}${requiredText}: `,
        (answer) => {
          const value = answer.trim() || question.default || '';

          if (question.required && !value) {
            console.log('❌ This field is required!');
            resolve(this.ask(question));
            return;
          }

          if (question.validate) {
            const result = question.validate(value);
            if (result !== true) {
              console.log(`❌ ${result}`);
              resolve(this.ask(question));
              return;
            }
          }

          resolve(value);
        }
      );
    });
  }

  async confirm(message: string, defaultValue = true): Promise<boolean> {
    return new Promise((resolve) => {
      const defaultText = defaultValue ? '[Y/n]' : '[y/N]';
      this.rl.question(`${message} ${defaultText}: `, (answer) => {
        const value = answer.trim().toLowerCase();
        if (!value) {
          resolve(defaultValue);
        } else {
          resolve(value === 'y' || value === 'yes');
        }
      });
    });
  }

  close() {
    this.rl.close();
  }
}

interface Config {
  telegramBotToken: string;
  allowedUserId: string;
  claudeCodePath: string;
  obsidianVaultPath: string;
  brainVaultPath?: string;
  whisperUrl?: string;
  logLevel: string;
  mcpServers: {
    filesystem: string[];
  };
  optionalFeatures: {
    whisper: boolean;
    scheduler: boolean;
    screenshots: boolean;
  };
}

async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                                                           ║
║              🤖 Nota Setup Wizard                         ║
║                                                           ║
║   Your Personal AI Assistant - Telegram Bot               ║
║   with Obsidian Integration                               ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

This wizard will guide you through setting up your Nota bot.
It will take approximately 5 minutes.

📋 Before you start, make sure you have:
   ✓ Created a Telegram bot with @BotFather
   ✓ Your Telegram User ID from @userinfobot
   ✓ An Obsidian vault (can be empty)
   ✓ Git Bash installed (Windows) or bash (Unix)

💡 Tip: Keep this information handy to speed up the process!

Press Ctrl+C at any time to cancel.

`);

  const prompt = new Prompt();
  const config: Config = {
    telegramBotToken: '',
    allowedUserId: '',
    claudeCodePath: '',
    obsidianVaultPath: '',
    logLevel: '1',
    mcpServers: {
      filesystem: [],
    },
    optionalFeatures: {
      whisper: false,
      scheduler: false,
      screenshots: false,
    },
  };

  try {
    // Step 1: Telegram Bot Configuration
    console.log('\n📱 Step 1: Telegram Bot Configuration');
    console.log('─'.repeat(50));
    console.log('');
    console.log('📋 How to get your Bot Token:');
    console.log('   1. Open Telegram and search for @BotFather');
    console.log('   2. Send /newbot command');
    console.log('   3. Follow prompts to create your bot');
    console.log('   4. Copy the token (format: 123456789:ABCdefGHI...)');
    console.log('');

    config.telegramBotToken = await prompt.ask({
      name: 'telegramBotToken',
      message: 'Enter your Telegram Bot Token',
      required: true,
      validate: (value) => {
        const tokenRegex = /^\d+:[A-Za-z0-9_-]+$/;
        return tokenRegex.test(value) || 'Invalid bot token format (should be: 123456789:ABC-DEF...)';
      },
    });

    console.log('');
    console.log('📋 How to get your User ID:');
    console.log('   1. In Telegram, search for @userinfobot');
    console.log('   2. Start a chat or send any message');
    console.log('   3. Copy your numeric User ID');
    console.log('');

    config.allowedUserId = await prompt.ask({
      name: 'allowedUserId',
      message: 'Enter your Telegram User ID',
      required: true,
      validate: (value) => {
        return /^\d+$/.test(value) || 'User ID must be numeric (e.g., 123456789)';
      },
    });

    // Step 2: Claude Code Path
    console.log('\n🧠 Step 2: Claude Code Configuration');
    console.log('─'.repeat(50));
    console.log('');
    console.log('📋 Finding your bash executable:');
    if (process.platform === 'win32') {
      console.log('   Common Windows locations:');
      console.log('   • C:\\Program Files\\Git\\bin\\bash.exe');
      console.log('   • C:\\Program Files (x86)\\Git\\bin\\bash.exe');
      console.log('   • D:\\Git\\bin\\bash.exe');
      console.log('');
      console.log('   To find it, run in PowerShell:');
      console.log('   > where bash');
      console.log('   or:');
      console.log('   > Get-Command bash | Select-Object -ExpandProperty Source');
    } else {
      console.log('   Usually: /bin/bash or /usr/bin/bash');
      console.log('   To verify, run: which bash');
    }
    console.log('');

    const defaultBashPath = process.platform === 'win32'
      ? 'C:\\Program Files\\Git\\bin\\bash.exe'
      : '/usr/bin/bash';

    config.claudeCodePath = await prompt.ask({
      name: 'claudeCodePath',
      message: 'Enter path to bash executable',
      default: defaultBashPath,
      required: true,
      validate: (value) => {
        return existsSync(value) || `Path does not exist: ${value}. Please check the path and try again.`;
      },
    });

    // Step 3: Obsidian Vault
    console.log('\n📝 Step 3: Obsidian Vault Configuration');
    console.log('─'.repeat(50));
    console.log('');
    console.log('📋 About Obsidian vaults:');
    console.log('   • User Vault: Your main notes (required)');
    console.log('   • Brain Vault: Bot\'s memory between sessions (recommended)');
    console.log('');
    console.log('   To create a new vault in Obsidian:');
    console.log('   1. Open Obsidian');
    console.log('   2. Click "Open another vault" → "Create new vault"');
    console.log('   3. Name it and choose location');
    console.log('   4. Copy the full path');
    console.log('');

    config.obsidianVaultPath = await prompt.ask({
      name: 'obsidianVaultPath',
      message: 'Enter path to your Obsidian vault (main notes)',
      required: true,
      validate: (value) => {
        return existsSync(value) || `Vault path does not exist: ${value}. Please create the vault first.`;
      },
    });

    console.log('');
    console.log('💡 Brain Vault (optional but recommended):');
    console.log('   A separate vault where the bot stores its memory,');
    console.log('   preferences, and learned patterns. Keeps your main');
    console.log('   vault clean and organized.');
    console.log('');

    const useBrainVault = await prompt.confirm(
      'Create/use a separate brain vault for bot memory?',
      true
    );

    if (useBrainVault) {
      config.brainVaultPath = await prompt.ask({
        name: 'brainVaultPath',
        message: 'Enter path to brain vault (or leave empty to create one)',
        default: join(dirname(config.obsidianVaultPath), 'claude'),
      });

      if (!existsSync(config.brainVaultPath)) {
        const create = await prompt.confirm(
          `Brain vault doesn't exist. Create at ${config.brainVaultPath}?`,
          true
        );
        if (create) {
          mkdirSync(config.brainVaultPath, { recursive: true });
          console.log('✅ Brain vault created!');
        }
      }
    }

    // Step 4: Optional Features
    console.log('\n⚙️  Step 4: Optional Features');
    console.log('─'.repeat(50));
    console.log('');
    console.log('📋 Optional features you can enable:');
    console.log('');

    console.log('🎤 Voice Transcription:');
    console.log('   Send voice messages to the bot and get text + response.');
    console.log('   Requires: Whisper WebUI running (github.com/jhj0517/Whispering-WebUI)');
    console.log('');

    config.optionalFeatures.whisper = await prompt.confirm(
      'Enable voice transcription?',
      false
    );

    if (config.optionalFeatures.whisper) {
      console.log('');
      config.whisperUrl = await prompt.ask({
        name: 'whisperUrl',
        message: 'Enter Whisper WebUI URL',
        default: 'http://localhost:7860',
      });
    }

    console.log('');
    console.log('⏰ Task Scheduler:');
    console.log('   Create reminders and scheduled tasks with natural language.');
    console.log('   Examples: "Remind me daily at 9am", "Every Monday at 4pm"');
    console.log('   Requires: Windows Task Scheduler or cron (Unix)');
    console.log('');

    config.optionalFeatures.scheduler = await prompt.confirm(
      'Enable task scheduler?',
      true
    );

    console.log('');
    console.log('📸 Web Screenshots:');
    console.log('   Bot can capture screenshots of websites and analyze them.');
    console.log('   Example: "Screenshot github.com/trending and summarize"');
    console.log('   Requires: Chrome or Edge browser installed');
    console.log('');

    config.optionalFeatures.screenshots = await prompt.confirm(
      'Enable screenshots?',
      true
    );

    // Step 5: MCP Filesystem Access
    console.log('\n🗂️  Step 5: Filesystem Access (Optional)');
    console.log('─'.repeat(50));
    console.log('');
    console.log('📋 Filesystem access:');
    console.log('   Allow the bot to read/write files in specific directories.');
    console.log('   Useful for: processing documents, saving attachments, etc.');
    console.log('');
    console.log('   ⚠️  Security: Only add directories you trust the bot to access.');
    console.log('   💡 Tip: You can leave this empty and add directories later.');
    console.log('');
    console.log('   Format: Comma-separated paths');
    console.log('   Example: C:\\Users\\YourName\\Desktop,C:\\Users\\YourName\\Documents');
    console.log('');

    const filesystemPaths = await prompt.ask({
      name: 'filesystemPaths',
      message: 'Directories to allow access (or leave empty to skip)',
      default: '',
    });

    if (filesystemPaths) {
      config.mcpServers.filesystem = filesystemPaths
        .split(',')
        .map((p) => p.trim())
        .filter((p) => p);
    }

    // Step 6: Log Level
    console.log('\n📊 Step 6: Logging Configuration');
    console.log('─'.repeat(50));

    const logLevels = ['0 (DEBUG)', '1 (INFO)', '2 (WARN)', '3 (ERROR)'];
    console.log('Available log levels:');
    logLevels.forEach((level, i) => console.log(`  ${i}: ${level}`));

    config.logLevel = await prompt.ask({
      name: 'logLevel',
      message: 'Select log level',
      default: '1',
      validate: (value) => {
        return /^[0-3]$/.test(value) || 'Must be 0, 1, 2, or 3';
      },
    });

    // Generate configuration files
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 Generating configuration files...');
    console.log('');

    // Generate .env
    const envContent = `# Telegram Configuration
TELEGRAM_BOT_TOKEN=${config.telegramBotToken}
ALLOWED_USER_ID=${config.allowedUserId}

# Claude Code Configuration
CLAUDE_CODE_GIT_BASH_PATH=${config.claudeCodePath}

${config.whisperUrl ? `# Whisper Configuration\nWHISPER_URL=${config.whisperUrl}\n` : ''}
# Logging
LOG_LEVEL=${config.logLevel}  # ${['DEBUG', 'INFO', 'WARN', 'ERROR'][parseInt(config.logLevel)]}
`;

    writeFileSync('.env', envContent);
    console.log('   ✅ Created .env (project root)');

    // Generate .mcp.json
    const mcpConfig: any = {
      mcpServers: {},
    };

    if (config.brainVaultPath) {
      mcpConfig.mcpServers.brain = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@mauricio.wolff/mcp-obsidian@latest', config.brainVaultPath],
      };
    }

    mcpConfig.mcpServers['user-notes'] = {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@mauricio.wolff/mcp-obsidian@latest', config.obsidianVaultPath],
    };

    if (config.mcpServers.filesystem.length > 0) {
      mcpConfig.mcpServers.filesystem = {
        type: 'stdio',
        command: 'npx',
        args: [
          '-y',
          '@modelcontextprotocol/server-filesystem',
          ...config.mcpServers.filesystem,
        ],
      };
    }

    if (config.optionalFeatures.screenshots) {
      mcpConfig.mcpServers.puppeteer = {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-puppeteer'],
        env: {
          PUPPETEER_LAUNCH_OPTIONS: '{"headless":true}',
        },
      };
    }

    mcpConfig.mcpServers.memory = {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-memory'],
      env: {
        MEMORY_FILE_PATH: join(process.cwd(), 'code', 'memory.jsonl'),
      },
    };

    writeFileSync(
      join('code', '.mcp.json'),
      JSON.stringify(mcpConfig, null, 2)
    );
    console.log('   ✅ Created code/.mcp.json');
    console.log('');
    console.log('   MCP servers configured:');
    if (config.brainVaultPath) {
      console.log('   • brain - Bot memory vault');
    }
    console.log('   • user-notes - Your Obsidian vault');
    if (config.mcpServers.filesystem.length > 0) {
      console.log('   • filesystem - File access');
    }
    if (config.optionalFeatures.screenshots) {
      console.log('   • puppeteer - Web screenshots');
    }
    console.log('   • memory - Conversation context');

    // Install dependencies
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 Installing dependencies...');
    console.log('   This may take a minute...');
    console.log('');
    try {
      execSync('npm install', { cwd: 'code', stdio: 'inherit' });
      console.log('');
      console.log('✅ Dependencies installed successfully!');
    } catch (error) {
      console.log('');
      console.log('⚠️  Failed to install dependencies automatically.');
      console.log('   Please run manually:');
      console.log('   $ cd code');
      console.log('   $ npm install');
    }

    // Success message
    console.log(`
╔═══════════════════════════════════════╗
║   ✅ Setup Complete!                  ║
╚═══════════════════════════════════════╝

Configuration files created:
  📄 .env (in project root)
  📄 code/.mcp.json
  📦 Dependencies installed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Next Steps:

  1. Start the bot:
     ${process.platform === 'win32' ? '> ' : '$ '}cd code
     ${process.platform === 'win32' ? '> ' : '$ '}npm run dev

  2. Open Telegram and find your bot (search for the username you created)

  3. Send /start to verify authentication

  4. Try these commands:
     /help      - See all commands
     /notatka   - Create a note
     /szukaj    - Search your notes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${config.optionalFeatures.whisper ? `
⚠️  Voice Transcription Enabled:
   Start Whisper WebUI before using voice messages:
   URL: ${config.whisperUrl}
` : ''}${config.optionalFeatures.scheduler ? `
⚠️  Task Scheduler Enabled:
   Bot can create scheduled tasks/reminders.
   Uses ${process.platform === 'win32' ? 'Windows Task Scheduler' : 'cron'}.
` : ''}${config.optionalFeatures.screenshots ? `
✅ Screenshots Enabled:
   Bot can capture and analyze websites.
   Try: "Screenshot github.com/trending"
` : ''}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📖 For more information:
   • Full documentation: README.md
   • Architecture details: ARCHITECTURE.md
   • Issues/Support: github.com/MikolajKopec/Nota/issues

Enjoy your personal AI assistant! 🤖
`);
  } catch (error) {
    console.log('\n');
    console.log('╔═══════════════════════════════════════════════════════════╗');
    console.log('║   ❌ Setup Failed                                         ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
    console.log('');
    console.error('Error:', error instanceof Error ? error.message : error);
    console.log('');
    console.log('💡 Troubleshooting tips:');
    console.log('   • Check that all paths exist and are accessible');
    console.log('   • Verify you have write permissions in this directory');
    console.log('   • Ensure Node.js 18+ is installed: node --version');
    console.log('   • Try running as administrator (Windows)');
    console.log('');
    console.log('📖 For help:');
    console.log('   • See README.md for manual setup instructions');
    console.log('   • Check troubleshooting section in README.md');
    console.log('   • Report issues: github.com/MikolajKopec/Nota/issues');
    console.log('');
    process.exit(1);
  } finally {
    prompt.close();
  }
}

main();
