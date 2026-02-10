#!/usr/bin/env tsx
/**
 * Asystent Setup Wizard
 * Interactive configuration tool for setting up the Telegram bot
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname, tmpdir } from 'path';
import { execSync } from 'child_process';
import * as readline from 'readline';
import ora from 'ora';

// Check if Claude Code CLI is installed
function checkClaudeCLI(): boolean {
  try {
    execSync('claude --version', { stdio: 'pipe', encoding: 'utf-8' });
    return true;
  } catch {
    return false;
  }
}

// Check Node.js version
function checkNodeVersion(): { ok: boolean; version: string } {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0]);
  return {
    ok: major >= 18,
    version,
  };
}

// Get common user directories
function getCommonDirectories(): { name: string; path: string }[] {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';

  if (!homeDir) return [];

  const commonDirs = [
    { name: 'Desktop', path: join(homeDir, 'Desktop') },
    { name: 'Downloads', path: join(homeDir, 'Downloads') },
    { name: 'Documents', path: join(homeDir, 'Documents') },
    { name: 'Pictures', path: join(homeDir, 'Pictures') },
  ];

  // Return only directories that actually exist
  return commonDirs.filter(dir => existsSync(dir.path));
}

// Test if bash has Python available
function testBashPython(bashPath: string): boolean {
  try {
    const result = execSync(`"${bashPath}" -c "python --version 2>&1 || python3 --version 2>&1"`, {
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 5000
    });
    return result.includes('Python');
  } catch {
    return false;
  }
}

// Auto-detect bash path with Python support
function findBashPath(): string | null {
  const isWindows = process.platform === 'win32';

  if (isWindows) {
    // Common Windows locations for Git Bash (check these first)
    const commonPaths = [
      'D:\\Git\\bin\\bash.exe',
      'C:\\Program Files\\Git\\bin\\bash.exe',
      'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
      'C:\\Git\\bin\\bash.exe',
    ];

    // Find first bash with Python support
    for (const path of commonPaths) {
      if (existsSync(path) && testBashPython(path)) {
        return path;
      }
    }

    // Fallback: try 'where' command, but prefer bash with Python
    try {
      const result = execSync('where bash', { encoding: 'utf-8' }).trim();
      const paths = result.split('\n').map(p => p.trim()).filter(p => p);

      // First, try to find Git Bash (not WSL) with Python
      const gitBashPaths = paths.filter(p => !p.includes('Windows\\System32'));
      for (const path of gitBashPaths) {
        if (testBashPython(path)) {
          return path;
        }
      }

      // Last resort: any bash with Python (even WSL)
      for (const path of paths) {
        if (testBashPython(path)) {
          return path;
        }
      }

      // If no bash has Python, return first Git Bash anyway (user might install Python later)
      if (gitBashPaths.length > 0) {
        return gitBashPaths[0];
      }

      // Absolute last resort: any bash
      if (paths.length > 0) {
        return paths[0];
      }
    } catch (e) {
      // 'where' failed
    }
  } else {
    // Unix-like systems - try 'which bash'
    try {
      const result = execSync('which bash', { encoding: 'utf-8' }).trim();
      if (result && existsSync(result)) {
        return result;
      }
    } catch (e) {
      // 'which' failed, try common locations
    }

    // Common Unix locations
    const commonPaths = ['/usr/bin/bash', '/bin/bash', '/usr/local/bin/bash'];

    for (const path of commonPaths) {
      if (existsSync(path)) {
        return path;
      }
    }
  }

  return null;
}

// Auto-install Claude CLI if not present
async function ensureClaudeCLI(): Promise<boolean> {
  const spinner = ora('Checking Claude Code CLI...').start();

  if (checkClaudeCLI()) {
    spinner.succeed('Claude Code CLI is installed');
    return true;
  }

  spinner.text = 'Claude Code CLI not found. Installing...';

  try {
    const isWindows = process.platform === 'win32';

    if (isWindows) {
      // Windows: use npm global install
      execSync('npm install -g @anthropic-ai/claude-code', {
        stdio: 'pipe',
        encoding: 'utf-8'
      });
    } else {
      // macOS/Linux: use curl installer
      execSync('curl -fsSL https://claude.ai/install.sh | sh', {
        stdio: 'pipe',
        encoding: 'utf-8',
        shell: '/bin/bash'
      });
    }

    // Verify installation
    if (checkClaudeCLI()) {
      spinner.succeed('Claude Code CLI installed successfully');
      return true;
    } else {
      spinner.fail('Installation completed but CLI not found in PATH');
      console.log('\n⚠️  Please restart your terminal and run the wizard again.');
      return false;
    }
  } catch (error) {
    spinner.fail('Failed to install Claude Code CLI automatically');
    console.log('\n❌ Error:', (error as Error).message);
    console.log('\n📖 Please install manually:');
    console.log('   Visit: https://docs.anthropic.com/claude/docs/install-cli');
    return false;
  }
}

// Verify Telegram bot token via API call
async function verifyTelegramToken(token: string): Promise<{ valid: boolean; botName?: string; username?: string }> {
  const spinner = ora('Verifying Telegram token...').start();

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const data = await response.json();

    if (data.ok) {
      spinner.succeed(`Token valid! Bot: @${data.result.username} (${data.result.first_name})`);
      return {
        valid: true,
        botName: data.result.first_name,
        username: data.result.username
      };
    } else {
      spinner.fail('Invalid token');
      return { valid: false };
    }
  } catch (error) {
    spinner.fail('Failed to verify token');
    console.log('❌ Error:', (error as Error).message);
    return { valid: false };
  }
}

// Interactive Telegram bot creation guide
async function createTelegramBot(prompt: Prompt): Promise<string | null> {
  console.log('\n🤖 Let\'s create a new Telegram bot!\n');
  console.log('Follow these steps:');
  console.log('1. Open Telegram and search for @BotFather');
  console.log('2. Send /newbot to BotFather');
  console.log('3. Follow the prompts to choose a name and username');
  console.log('4. BotFather will give you a token (looks like: 123456:ABC-DEF...)\n');

  const openNow = await prompt.confirm('Open Telegram web to @BotFather now?', true);

  if (openNow) {
    try {
      const open = (await import('open')).default;
      await open('https://t.me/BotFather');
      console.log('✅ Opened Telegram in browser\n');
    } catch (error) {
      console.log('⚠️  Could not open browser automatically. Please open Telegram manually.\n');
    }
  }

  const hasToken = await prompt.confirm('Have you created a bot and received the token?', false);

  if (!hasToken) {
    console.log('\n⏸️  No problem! Come back when you have the token.');
    return null;
  }

  // Ask for token with validation
  let token: string | null = null;
  let attempts = 0;

  while (!token && attempts < 3) {
    const input = await prompt.ask({
      name: 'token',
      message: 'Paste your bot token',
      required: true,
      validate: (value: string) => {
        if (!value.match(/^\d+:[A-Za-z0-9_-]+$/)) {
          return 'Invalid token format. Should be like: 123456789:ABCdefGHIjklMNOpqrsTUVwxyz';
        }
        return true;
      }
    });

    const verification = await verifyTelegramToken(input);

    if (verification.valid) {
      token = input;
      console.log(`\n✅ Bot created successfully: @${verification.username}`);
    } else {
      attempts++;
      if (attempts < 3) {
        console.log(`\n❌ Token verification failed. ${3 - attempts} attempts remaining.\n`);
      }
    }
  }

  return token;
}

// Auto-get user ID by polling Telegram API
async function autoGetUserId(token: string): Promise<string | null> {
  console.log('\n👤 Getting your Telegram User ID...\n');
  console.log('📱 Please open Telegram and send any message to your bot');
  console.log('   (You can say "hello" or anything else)\n');

  const spinner = ora('Waiting for your message...').start();
  const startTime = Date.now();
  const timeout = 60000; // 60 seconds

  while (Date.now() - startTime < timeout) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/getUpdates`);
      const data = await response.json();

      if (data.ok && data.result.length > 0) {
        // Get the most recent message
        const lastUpdate = data.result[data.result.length - 1];
        const userId = lastUpdate.message?.from?.id || lastUpdate.callback_query?.from?.id;

        if (userId) {
          spinner.succeed(`Got your User ID: ${userId}`);

          // Clear the update so bot doesn't process it later
          await fetch(`https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdate.update_id + 1}`);

          return userId.toString();
        }
      }
    } catch (error) {
      // Continue polling
    }

    // Wait 2 seconds before next poll
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  spinner.fail('Timeout waiting for message');
  console.log('\n⏱️  No message received within 60 seconds.');
  return null;
}

// Post-install verification - send test message
async function verifyBot(token: string, userId: string): Promise<boolean> {
  const spinner = ora('Verifying bot can send messages...').start();

  try {
    const testMessage = '✅ Nota bot is working! Setup completed successfully.';

    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: userId,
        text: testMessage
      })
    });

    const data = await response.json();

    if (data.ok) {
      spinner.succeed('Bot verification successful! Check your Telegram.');
      return true;
    } else {
      spinner.fail('Failed to send test message');
      console.log('❌ Error:', data.description);
      return false;
    }
  } catch (error) {
    spinner.fail('Failed to verify bot');
    console.log('❌ Error:', (error as Error).message);
    return false;
  }
}

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
`);

  // Check dependencies first
  console.log('🔍 Checking dependencies...\n');

  // Check Node.js
  const nodeCheck = checkNodeVersion();
  if (nodeCheck.ok) {
    console.log(`✅ Node.js ${nodeCheck.version}`);
  } else {
    console.log(`❌ Node.js ${nodeCheck.version} - version 18+ required`);
    console.log('\n📥 Install Node.js 18+:');
    console.log('   Visit: https://nodejs.org/\n');
    process.exit(1);
  }

  // Check and auto-install Claude Code CLI
  const claudeInstalled = await ensureClaudeCLI();
  if (!claudeInstalled) {
    process.exit(1);
  }

  console.log('\n✅ All dependencies met!\n');
  console.log('─'.repeat(60));
  console.log('\nThis wizard will guide you through setting up your Nota bot.');
  console.log('It will take approximately 5 minutes.\n');
  console.log('✨ What this wizard will do:');
  console.log('   • Help you create a Telegram bot (or use existing one)');
  console.log('   • Automatically detect your User ID');
  console.log('   • Configure Obsidian vault integration');
  console.log('   • Set up optional features (Whisper, screenshots, etc.)');
  console.log('   • Verify everything works with a test message\n');
  console.log('📋 Before you start, make sure you have:');
  console.log('   ✓ An Obsidian vault (can be empty)');
  console.log('   ✓ Git Bash installed (Windows - download from git-scm.com)');
  console.log('      macOS/Linux users: bash is already installed\n');
  console.log('💡 Tip: The wizard will help you create a bot if you don\'t have one!\n');
  console.log('Press Ctrl+C at any time to cancel.\n');
  console.log('─'.repeat(60));

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

    const hasExistingBot = await prompt.confirm('Do you already have a Telegram bot token?', false);

    if (hasExistingBot) {
      console.log('');
      console.log('📋 Bot Token format: 123456789:ABCdefGHI...');
      console.log('');

      let tokenValid = false;
      let attempts = 0;

      while (!tokenValid && attempts < 3) {
        const token = await prompt.ask({
          name: 'telegramBotToken',
          message: 'Enter your Telegram Bot Token',
          required: true,
          validate: (value) => {
            const tokenRegex = /^\d+:[A-Za-z0-9_-]+$/;
            return tokenRegex.test(value) || 'Invalid bot token format (should be: 123456789:ABC-DEF...)';
          },
        });

        const verification = await verifyTelegramToken(token);

        if (verification.valid) {
          config.telegramBotToken = token;
          tokenValid = true;
        } else {
          attempts++;
          if (attempts < 3) {
            console.log(`\n❌ Token verification failed. ${3 - attempts} attempts remaining.\n`);
          } else {
            console.log('\n❌ Token verification failed 3 times. Exiting.');
            process.exit(1);
          }
        }
      }
    } else {
      const newToken = await createTelegramBot(prompt);

      if (!newToken) {
        console.log('\n❌ Could not obtain bot token. Exiting.');
        process.exit(1);
      }

      config.telegramBotToken = newToken;
    }

    console.log('');
    const autoGetId = await prompt.confirm('Automatically detect your Telegram User ID?', true);

    if (autoGetId) {
      const detectedId = await autoGetUserId(config.telegramBotToken);

      if (detectedId) {
        config.allowedUserId = detectedId;
      } else {
        console.log('\n⚠️  Auto-detection failed. Please enter manually.\n');
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
      }
    } else {
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
    }

    // Step 2: Claude Code Path
    console.log('\n🧠 Step 2: Claude Code Configuration');
    console.log('─'.repeat(50));
    console.log('');
    console.log('📋 Searching for bash executable...');

    const detectedBashPath = findBashPath();

    if (detectedBashPath) {
      const hasPython = testBashPython(detectedBashPath);
      console.log(`   ✅ Found bash at: ${detectedBashPath}`);
      if (hasPython) {
        console.log('   ✅ Python is available in this bash');
      } else {
        console.log('   ⚠️  Warning: Python not detected in this bash');
        console.log('      Task scheduler may not work without Python');
      }
      console.log('');

      const useDetected = await prompt.confirm(
        'Use this bash path?',
        hasPython  // Default to yes only if has Python
      );

      if (useDetected) {
        config.claudeCodePath = detectedBashPath;
      } else {
        console.log('');
        console.log('💡 Common locations:');
        if (process.platform === 'win32') {
          console.log('   • C:\\Program Files\\Git\\bin\\bash.exe');
          console.log('   • C:\\Program Files (x86)\\Git\\bin\\bash.exe');
        } else {
          console.log('   • /usr/bin/bash');
          console.log('   • /bin/bash');
        }
        console.log('');

        config.claudeCodePath = await prompt.ask({
          name: 'claudeCodePath',
          message: 'Enter path to bash executable',
          default: detectedBashPath,
          required: true,
          validate: (value) => {
            return existsSync(value) || `Path does not exist: ${value}`;
          },
        });
      }
    } else {
      console.log('   ⚠️  Could not auto-detect bash.');
      console.log('');
      console.log('💡 Common locations:');
      if (process.platform === 'win32') {
        console.log('   • C:\\Program Files\\Git\\bin\\bash.exe');
        console.log('   • C:\\Program Files (x86)\\Git\\bin\\bash.exe');
        console.log('');
        console.log('   To find it, run in PowerShell:');
        console.log('   > where bash');
      } else {
        console.log('   • /usr/bin/bash');
        console.log('   • /bin/bash');
        console.log('');
        console.log('   To find it, run: which bash');
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
          return existsSync(value) || `Path does not exist: ${value}`;
        },
      });
    }

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
    console.log('💡 Brain Vault (required):');
    console.log('   A separate vault where the bot stores its memory,');
    console.log('   preferences, learned patterns, and scheduled task metadata.');
    console.log('   Keeps your main vault clean and organized.');
    console.log('');
    console.log('   ⚠️  Required for: task scheduler, preferences, action history');
    console.log('');

    config.brainVaultPath = await prompt.ask({
      name: 'brainVaultPath',
      message: 'Enter path to brain vault',
      default: join(dirname(config.obsidianVaultPath), 'claude'),
      required: true,
    });

    if (!existsSync(config.brainVaultPath)) {
      const create = await prompt.confirm(
        `Brain vault doesn't exist. Create at ${config.brainVaultPath}?`,
        true
      );
      if (create) {
        mkdirSync(config.brainVaultPath, { recursive: true });
        console.log('✅ Brain vault created!');
      } else {
        console.log('❌ Brain vault is required for bot operation. Please create it manually.');
        process.exit(1);
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
    if (process.platform === 'win32') {
      console.log('   Uses: Windows Task Scheduler (schtasks)');
    } else if (process.platform === 'darwin') {
      console.log('   Uses: macOS launchd (.plist files)');
    } else {
      console.log('   Uses: Manual cron setup (Linux - not yet automated)');
    }
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

    const enableFilesystem = await prompt.confirm('Enable filesystem access?', false);

    if (enableFilesystem) {
      const commonDirs = getCommonDirectories();

      if (commonDirs.length > 0) {
        console.log('');
        console.log('📁 Common directories found:');
        commonDirs.forEach((dir, i) => {
          console.log(`   ${i + 1}. ${dir.name} - ${dir.path}`);
        });
        console.log('');

        const selection = await prompt.ask({
          name: 'commonDirs',
          message: 'Select directories (comma-separated numbers, e.g., "1,2,3" or leave empty for none)',
          default: '',
        });

        if (selection) {
          const indices = selection
            .split(',')
            .map(s => parseInt(s.trim()) - 1)
            .filter(i => i >= 0 && i < commonDirs.length);

          config.mcpServers.filesystem = indices.map(i => commonDirs[i].path);
        }
      }

      // Allow adding custom paths
      console.log('');
      const addCustom = await prompt.confirm('Add custom directories?', false);

      if (addCustom) {
        console.log('');
        console.log('📝 Enter custom paths (comma-separated):');
        console.log('   Example: C:\\Users\\YourName\\Projects,D:\\Work');
        console.log('');

        const customPaths = await prompt.ask({
          name: 'customPaths',
          message: 'Custom directories (or leave empty)',
          default: '',
        });

        if (customPaths) {
          const paths = customPaths
            .split(',')
            .map((p) => p.trim())
            .filter((p) => p);

          config.mcpServers.filesystem.push(...paths);
        }
      }

      // Show summary
      if (config.mcpServers.filesystem.length > 0) {
        console.log('');
        console.log('✅ Filesystem access enabled for:');
        config.mcpServers.filesystem.forEach(path => {
          console.log(`   • ${path}`);
        });
      }
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

    writeFileSync(join('code', '.env'), envContent);
    console.log('   ✅ Created code/.env');

    // Generate .mcp.json
    const mcpConfig: any = {
      mcpServers: {},
    };

    // Brain vault is required
    mcpConfig.mcpServers.brain = {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@mauricio.wolff/mcp-obsidian@latest', config.brainVaultPath!],
    };

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
    console.log('   • brain - Bot memory vault (required)');
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

    // Create run scripts
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📝 Creating run scripts...');
    console.log('');

    // Windows batch script
    const runBatContent = `@echo off
echo Starting Nota bot...
cd /d "%~dp0code"
npm run dev
pause
`;
    writeFileSync('run.bat', runBatContent);
    console.log('   ✅ Created run.bat (Windows)');

    // Unix shell script
    const runShContent = `#!/bin/bash
echo "Starting Nota bot..."
cd "$(dirname "$0")/code"
npm run dev
`;
    writeFileSync('run.sh', runShContent);
    try {
      execSync('chmod +x run.sh', { stdio: 'pipe' });
    } catch {
      // chmod may fail on Windows, that's OK
    }
    console.log('   ✅ Created run.sh (macOS/Linux)');

    // Success message
    console.log(`
╔═══════════════════════════════════════╗
║   ✅ Setup Complete!                  ║
╚═══════════════════════════════════════╝

Configuration files created:
  📄 code/.env
  📄 code/.mcp.json
  📦 Dependencies installed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Next Steps:

  1. Start the bot:
     ${process.platform === 'win32' ? 'Windows: Double-click run.bat' : 'macOS/Linux: ./run.sh'}
     ${process.platform === 'win32' ? 'Or in terminal: > ' : 'Or: $ '}cd code && npm run dev

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
   Uses ${process.platform === 'win32' ? 'Windows Task Scheduler (schtasks)' : process.platform === 'darwin' ? 'macOS launchd' : 'manual cron (not automated)'}.
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

    // Verify bot can send messages
    console.log('');
    console.log('🧪 Step 7: Verifying Bot Setup');
    console.log('─'.repeat(50));
    console.log('');

    const botWorks = await verifyBot(config.telegramBotToken, config.allowedUserId);

    if (botWorks) {
      console.log('\n✅ Bot verification successful!');
      console.log('   Check your Telegram - you should have received a test message.');
    } else {
      console.log('\n⚠️  Bot verification failed, but setup is complete.');
      console.log('   You can try starting the bot manually to troubleshoot.');
    }

    // Ask if user wants to start bot now
    console.log('');
    const startNow = await prompt.confirm('Would you like to start the bot now?', true);

    prompt.close();

    if (startNow) {
      console.log('\n🚀 Starting bot...\n');
      console.log('Press Ctrl+C to stop the bot at any time.\n');
      console.log('─'.repeat(60));
      console.log('');
      try {
        execSync('npm run dev', { cwd: 'code', stdio: 'inherit' });
      } catch (error) {
        // User pressed Ctrl+C or bot crashed
        console.log('\n\n👋 Bot stopped. Run again with:');
        console.log(process.platform === 'win32' ? '   run.bat' : '   ./run.sh');
      }
    }
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
