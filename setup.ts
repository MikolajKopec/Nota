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
╔═══════════════════════════════════════╗
║   🤖 Nota Setup Wizard                ║
║   Interactive configuration tool      ║
╚═══════════════════════════════════════╝
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

    config.telegramBotToken = await prompt.ask({
      name: 'telegramBotToken',
      message: 'Enter your Telegram Bot Token (from @BotFather)',
      required: true,
      validate: (value) => {
        const tokenRegex = /^\d+:[A-Za-z0-9_-]+$/;
        return tokenRegex.test(value) || 'Invalid bot token format';
      },
    });

    config.allowedUserId = await prompt.ask({
      name: 'allowedUserId',
      message: 'Enter your Telegram User ID (for authentication)',
      required: true,
      validate: (value) => {
        return /^\d+$/.test(value) || 'User ID must be numeric';
      },
    });

    // Step 2: Claude Code Path
    console.log('\n🧠 Step 2: Claude Code Configuration');
    console.log('─'.repeat(50));

    const defaultBashPath = process.platform === 'win32'
      ? 'D:\\Git\\bin\\bash.exe'
      : '/usr/bin/bash';

    config.claudeCodePath = await prompt.ask({
      name: 'claudeCodePath',
      message: 'Enter path to Git Bash executable (for Windows) or bash',
      default: defaultBashPath,
      required: true,
      validate: (value) => {
        return existsSync(value) || `Path does not exist: ${value}`;
      },
    });

    // Step 3: Obsidian Vault
    console.log('\n📝 Step 3: Obsidian Vault Configuration');
    console.log('─'.repeat(50));

    config.obsidianVaultPath = await prompt.ask({
      name: 'obsidianVaultPath',
      message: 'Enter path to your Obsidian vault (user notes)',
      required: true,
      validate: (value) => {
        return existsSync(value) || `Vault path does not exist: ${value}`;
      },
    });

    const useBrainVault = await prompt.confirm(
      'Do you want a separate "brain" vault for bot memory?',
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

    config.optionalFeatures.whisper = await prompt.confirm(
      'Enable voice transcription (requires Whisper WebUI)?',
      false
    );

    if (config.optionalFeatures.whisper) {
      config.whisperUrl = await prompt.ask({
        name: 'whisperUrl',
        message: 'Enter Whisper WebUI URL',
        default: 'http://localhost:7860',
      });
    }

    config.optionalFeatures.scheduler = await prompt.confirm(
      'Enable task scheduler (for reminders)?',
      true
    );

    config.optionalFeatures.screenshots = await prompt.confirm(
      'Enable screenshots (requires Chrome/Edge)?',
      true
    );

    // Step 5: MCP Filesystem Access
    console.log('\n🗂️  Step 5: Filesystem Access for MCP');
    console.log('─'.repeat(50));
    console.log('Add directories that the bot can access (comma-separated)');
    console.log('Example: C:\\Users\\YourName\\Desktop,C:\\Users\\YourName\\Downloads');

    const filesystemPaths = await prompt.ask({
      name: 'filesystemPaths',
      message: 'Directories to allow access (leave empty for none)',
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
    console.log('\n📝 Generating configuration files...');

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

    writeFileSync(join('code', '.env'), envContent);
    console.log('✅ Created code/.env');

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
    console.log('✅ Created code/.mcp.json');

    // Install dependencies
    console.log('\n📦 Installing dependencies...');
    try {
      execSync('npm install', { cwd: 'code', stdio: 'inherit' });
      console.log('✅ Dependencies installed!');
    } catch (error) {
      console.log('⚠️  Failed to install dependencies. Run "npm install" manually in code/ directory.');
    }

    // Success message
    console.log(`
╔═══════════════════════════════════════╗
║   ✅ Setup Complete!                  ║
╚═══════════════════════════════════════╝

Configuration files created:
  📄 code/.env
  📄 code/.mcp.json

Next steps:
  1. Review the generated configuration files
  2. Run the bot: cd code && npm run dev
  3. Send a message to your bot on Telegram!

${config.optionalFeatures.whisper ? '\n⚠️  Remember to start Whisper WebUI before using voice messages!\n' : ''}
${config.optionalFeatures.scheduler ? '\n⚠️  Task scheduler requires Windows Task Scheduler or cron setup.\n' : ''}

For more information, see README.md
`);
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  } finally {
    prompt.close();
  }
}

main();
