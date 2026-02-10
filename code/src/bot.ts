import { Bot, Context, InlineKeyboard, InputFile } from "grammy";
import { FileFlavor, hydrateFiles } from "@grammyjs/files";
import { writeFile, unlink, readFile, readdir, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const SCREENSHOT_DIR = join(tmpdir(), "asystent-screenshots");
import { TELEGRAM_BOT_TOKEN, ALLOWED_USER_ID } from "./config.js";
import { transcribe } from "./transcribe.js";
import {
  askClaudeStream,
  debugClaude,
  resetSession,
  switchToSession,
  getSessionHistory,
} from "./claude.js";
import { logger } from "./logger.js";
import {
  getAutostartStatus,
  enableAutostart,
  disableAutostart,
} from "./autostart.js";
import { checkForUpdates, formatUpdateMessage } from "./updates.js";

type MyContext = FileFlavor<Context>;

const TELEGRAM_MSG_LIMIT = 4096;

// --- Faza 1A: Typing loop ---

function startTypingLoop(ctx: MyContext): () => void {
  let running = true;
  const send = () => {
    if (!running) return;
    ctx.replyWithChatAction("typing").catch(() => {});
  };
  send();
  const interval = setInterval(send, 4000);
  return () => {
    running = false;
    clearInterval(interval);
  };
}

// --- Faza 1B: Message splitting ---

function splitMessage(text: string): string[] {
  if (text.length <= TELEGRAM_MSG_LIMIT) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > TELEGRAM_MSG_LIMIT) {
    let splitAt = remaining.lastIndexOf("\n", TELEGRAM_MSG_LIMIT);
    if (splitAt < TELEGRAM_MSG_LIMIT * 0.3) {
      splitAt = remaining.lastIndexOf(" ", TELEGRAM_MSG_LIMIT);
    }
    if (splitAt < TELEGRAM_MSG_LIMIT * 0.3) {
      splitAt = TELEGRAM_MSG_LIMIT;
    }
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}

async function sendLongMessage(ctx: MyContext, text: string): Promise<void> {
  const chunks = splitMessage(text);
  for (const chunk of chunks) {
    try {
      await ctx.reply(chunk, { parse_mode: "Markdown" });
    } catch {
      // Fallback to plain text if Markdown parsing fails
      await ctx.reply(chunk);
    }
  }
}

// --- Faza 1C: Mutex ---

let messageQueue: Promise<void> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const task = messageQueue.then(fn, fn);
  // Update queue — swallow errors so the chain continues
  messageQueue = task.then(() => {}, () => {});
  return task;
}

// --- Screenshot fallback ---

async function findNewScreenshots(sinceMs: number): Promise<string[]> {
  try {
    const files = await readdir(SCREENSHOT_DIR);
    const results: string[] = [];
    for (const f of files) {
      if (!f.endsWith(".png")) continue;
      const fullPath = join(SCREENSHOT_DIR, f);
      const s = await stat(fullPath);
      if (s.mtimeMs >= sinceMs) {
        results.push(fullPath);
      }
    }
    logger.debug("bot", `Found ${results.length} new screenshots since ${new Date(sinceMs).toISOString()}`);
    return results;
  } catch (err) {
    logger.error("bot", "Failed to scan screenshot directory", { error: (err as Error).message });
    return [];
  }
}

// --- Response handler ---

async function handleResponse(ctx: MyContext, userMessage: string): Promise<void> {
  const startTime = Date.now();
  const toolsUsed: string[] = [];

  logger.info("bot", "Processing message", {
    userId: ctx.from?.id,
    messageLength: userMessage.length,
    preview: userMessage.slice(0, 50)
  });

  const result = await askClaudeStream(userMessage, {
    onToolUse: (toolName: string) => {
      toolsUsed.push(toolName);
      logger.info("bot", "Tool called", { tool: toolName });
    },
  });

  if (result.resumeFailed) {
    logger.warn("bot", "Session resume failed, started new session");
    await ctx.reply("(Failed to resume session — starting new one)");
  }

  const text = result.text;
  const duration = Date.now() - startTime;

  logger.info("bot", "Received response from Claude", {
    length: text.length,
    hasIMG: text.includes("[IMG:"),
    durationMs: duration,
    toolsUsed: toolsUsed.length > 0 ? toolsUsed : "none",
    usage: result.usage
  });

  if (text.includes("[IMG:")) {
    logger.debug("bot", "Extracting IMG markers from response");
    await sendResponseWithImages(ctx, text);
  } else {
    await sendLongMessage(ctx, text);

    // Fallback: send any screenshots created during this interaction
    const newScreenshots = await findNewScreenshots(startTime);
    if (newScreenshots.length > 0) {
      logger.info("bot", "Sending fallback screenshots", { count: newScreenshots.length });
      for (const imgPath of newScreenshots) {
        try {
          const buffer = await readFile(imgPath);
          logger.debug("bot", "Sending fallback screenshot", { path: imgPath, size: buffer.length });
          await ctx.replyWithPhoto(new InputFile(buffer, "screenshot.png"));
        } catch (err) {
          logger.error("bot", "Failed to send fallback screenshot", { path: imgPath, error: (err as Error).message });
        }
        unlink(imgPath).catch(() => {});
      }
    }
  }
}

// --- Faza 4: Image output ---

async function sendResponseWithImages(ctx: MyContext, text: string): Promise<void> {
  const imgRegex = /\[IMG:(.*?)\]/g;
  const paths: string[] = [];
  let match;
  while ((match = imgRegex.exec(text)) !== null) {
    paths.push(match[1]);
  }

  // Strip image markers from text
  const cleanText = text.replace(/\[IMG:.*?\]/g, "").trim();

  // Send text
  if (cleanText) {
    await sendLongMessage(ctx, cleanText);
  }

  logger.info("bot", "Sending response with images", { imageCount: paths.length });

  // Send images
  for (const imgPath of paths) {
    try {
      logger.debug("bot", "Reading image file", { path: imgPath });
      const buffer = await readFile(imgPath);
      logger.debug("bot", "Sending image", { path: imgPath, size: buffer.length });
      await ctx.replyWithPhoto(new InputFile(buffer, "screenshot.png"));
      logger.info("bot", "Image sent successfully", { path: imgPath });
      unlink(imgPath).catch(() => {});
    } catch (err) {
      logger.error("bot", "Failed to send image", { path: imgPath, error: (err as Error).message });
      await ctx.reply(`\u26a0\ufe0f Failed to send image: ${imgPath}`);
    }
  }
}

// --- Helpers ---

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

async function downloadFile(filePath: string, token: string): Promise<Buffer> {
  const url = `https://api.telegram.org/file/bot${token}/${filePath}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download file: ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// --- Bot creation ---

export function createBot(): Bot<MyContext> {
  const bot = new Bot<MyContext>(TELEGRAM_BOT_TOKEN);

  bot.api.config.use(hydrateFiles(bot.token));

  // Auth middleware — ignore messages from strangers
  bot.use(async (ctx, next) => {
    if (ctx.from?.id !== ALLOWED_USER_ID) {
      logger.warn("bot", "Unauthorized access attempt", { userId: ctx.from?.id, username: ctx.from?.username });
      return;
    }
    await next();
  });

  // /start command
  bot.command("start", async (ctx) => {
    logger.info("bot", "Command: /start");
    resetSession();
    await ctx.reply("Hello! Send me a text or voice message, and I'll manage your Obsidian vault.");
  });

  // /new — reset session
  bot.command("new", async (ctx) => {
    logger.info("bot", "Command: /new");
    resetSession();
    await ctx.reply("New session. Next message will start a new conversation.");
  });

  // /rewind — show inline keyboard with recent sessions
  bot.command("rewind", async (ctx) => {
    const history = getSessionHistory();
    if (history.length === 0) {
      await ctx.reply("No previous sessions.");
      return;
    }

    const keyboard = new InlineKeyboard();
    const recent = history.slice(-5).reverse();
    for (const entry of recent) {
      keyboard.text(`${entry.label} (${timeAgo(entry.startedAt)})`, `session:${entry.id}`).row();
    }

    await ctx.reply("Select a session to resume:", { reply_markup: keyboard });
  });

  // Callback query handler for session selection
  bot.callbackQuery(/^session:/, async (ctx) => {
    const id = ctx.callbackQuery.data.replace("session:", "");
    const history = getSessionHistory();
    const entry = history.find((e) => e.id === id);

    if (!entry) {
      await ctx.answerCallbackQuery("Session not found.");
      return;
    }

    switchToSession(id);
    await ctx.answerCallbackQuery("Session resumed");
    await ctx.editMessageText(`Resumed session: ${entry.label}`);
  });

  // /tasks — manage scheduled tasks
  bot.command("tasks", async (ctx) => {
    logger.info("bot", "Command: /tasks");
    await enqueue(async () => {
      const stopTyping = startTypingLoop(ctx);
      try {
        const startMs = Date.now();
        const result = await askClaudeStream(
          "Show all active scheduled tasks from brain/Asystent/scheduled-tasks.md. For each task display: name, schedule, description, status. Add instructions on how user can manage them (disable, enable, delete).",
          {}
        );

        stopTyping();
        await handleResponse(ctx, result.text, startMs);

        logger.info("bot", "Tasks command completed", {
          durationMs: Date.now() - startMs,
          textLength: result.text.length
        });
      } catch (err) {
        stopTyping();
        logger.error("bot", "Error in /tasks command", { error: (err as Error).message });
        await ctx.reply(`❌ Error: ${(err as Error).message}`);
      }
    });
  });

  // /test — debug diagnostics
  bot.command("test", async (ctx) => {
    await ctx.reply("\u23f3 Running diagnostics...");
    try {
      const report = await debugClaude();
      await ctx.reply(report);
    } catch (err) {
      await ctx.reply(`Debug error: ${(err as Error).message}`);
    }
  });

  // /help — show available commands
  bot.command("help", async (ctx) => {
    logger.info("bot", "Command: /help");
    const helpText = `🤖 Nota - Your intelligent note companion

📝 COMMANDS:
/note <text> - Save a note
/search <query> - Search notes
/summary - Summarize recent notes
/tasks - Manage scheduled tasks
/autostart - Bot autostart settings
/updates - Check for updates
/new - New session
/rewind - Resume previous session
/help - This message

💬 MESSAGES:
• Text - Chat with assistant
• Voice - Whisper transcription
• Photo - Image analysis

🎨 SKILLS (16):

📄 Documents:
• docx - Word documents
• pdf - PDF processing
• pptx - PowerPoint presentations
• xlsx - Excel spreadsheets

🎨 Graphics:
• canvas-design - Posters and graphics
• algorithmic-art - Generative art
• slack-gif-creator - Animated GIFs
• theme-factory - HTML themes

💻 Web & Development:
• frontend-design - React + Tailwind
• web-artifacts-builder - HTML dashboards
• webapp-testing - Playwright tests

🔧 Meta & Tools:
• mcp-builder - Create MCP servers
• skill-creator - Create skills
• brand-guidelines - Anthropic branding
• internal-comms - Internal communications
• doc-coauthoring - Document collaboration

Examples:
"Draw a BELIEVE poster"
"Create a budget spreadsheet"
"Help me create a skill"`;

    await ctx.reply(helpText);
  });

  // /autostart — manage bot autostart on system startup
  bot.command("autostart", async (ctx) => {
    logger.info("bot", "Command: /autostart");

    const args = ctx.match?.trim().toLowerCase();

    try {
      if (!args || args === "status") {
        // Show status
        const status = await getAutostartStatus();

        if (status.enabled) {
          const stateEmoji = status.state === "ready" ? "✅" : status.state === "running" ? "🟢" : "⚠️";
          await ctx.reply(
            `${stateEmoji} Autostart: **ENABLED**\n` +
            `State: ${status.state || "unknown"}\n\n` +
            `Bot will start automatically when system boots.\n\n` +
            `Commands:\n` +
            `/autostart disable - Turn off autostart\n` +
            `/autostart status - Show this status`,
            { parse_mode: "Markdown" }
          );
        } else {
          await ctx.reply(
            `❌ Autostart: **DISABLED**\n\n` +
            `Bot will NOT start automatically on system boot.\n\n` +
            `Commands:\n` +
            `/autostart enable - Turn on autostart\n` +
            `/autostart status - Show this status`,
            { parse_mode: "Markdown" }
          );
        }
      } else if (args === "enable") {
        // Enable autostart
        await ctx.reply("⏳ Enabling autostart...");
        await enableAutostart();
        await ctx.reply("✅ Autostart enabled! Bot will start automatically on system boot.");
        logger.info("bot", "Autostart enabled via command");
      } else if (args === "disable") {
        // Disable autostart
        await ctx.reply("⏳ Disabling autostart...");
        await disableAutostart();
        await ctx.reply("❌ Autostart disabled. Bot will not start automatically.");
        logger.info("bot", "Autostart disabled via command");
      } else {
        await ctx.reply(
          "Usage:\n" +
          "/autostart - Show status\n" +
          "/autostart enable - Enable autostart\n" +
          "/autostart disable - Disable autostart"
        );
      }
    } catch (err) {
      logger.error("bot", "Error in /autostart command", { error: (err as Error).message });
      const errorMsg = (err as Error).message;

      // Format multiline error messages
      if (errorMsg.includes("\n")) {
        await ctx.reply(`❌ ${errorMsg}`);
      } else {
        await ctx.reply(`❌ Error: ${errorMsg}`);
      }
    }
  });

  // /updates — check for available updates
  bot.command("updates", async (ctx) => {
    logger.info("bot", "Command: /updates");

    try {
      await ctx.reply("🔍 Checking for updates...");

      const info = await checkForUpdates();
      const message = formatUpdateMessage(info);

      await ctx.reply(message, { parse_mode: "Markdown" });

      if (info.hasUpdates) {
        logger.info("bot", "Updates found", {
          behindBy: info.gitBehindBy,
        });
      }
    } catch (err) {
      logger.error("bot", "Error in /updates command", { error: (err as Error).message });
      await ctx.reply(`❌ Error checking updates: ${(err as Error).message}`);
    }
  });

  // --- Faza 5: Telegram commands (BEFORE message:text!) ---

  bot.command("note", async (ctx) => {
    const text = ctx.match;
    if (!text) {
      await ctx.reply("Usage: /note <text>");
      return;
    }
    await enqueue(async () => {
      const stopTyping = startTypingLoop(ctx);
      try {
        await handleResponse(ctx, `Save note in User Notes vault: ${text}`);
      } finally {
        stopTyping();
      }
    });
  });

  bot.command("search", async (ctx) => {
    const query = ctx.match;
    if (!query) {
      await ctx.reply("Usage: /search <query>");
      return;
    }
    await enqueue(async () => {
      const stopTyping = startTypingLoop(ctx);
      try {
        await handleResponse(ctx, `Search User Notes vault for: ${query}. Show found results.`);
      } finally {
        stopTyping();
      }
    });
  });

  bot.command("summary", async (ctx) => {
    await enqueue(async () => {
      const stopTyping = startTypingLoop(ctx);
      try {
        await handleResponse(ctx, "Read recent notes from User Notes and summarize what happened.");
      } finally {
        stopTyping();
      }
    });
  });

  // Voice messages → transcribe → Claude (streaming)
  bot.on("message:voice", async (ctx) => {
    await enqueue(async () => {
      const stopTyping = startTypingLoop(ctx);
      try {
        const file = await ctx.getFile();
        const buffer = await downloadFile(file.file_path!, bot.token);

        console.log(`Transcribing voice (${ctx.msg.voice.duration}s)...`);
        const text = await transcribe(buffer, "voice.ogg");
        console.log(`Transcription: "${text}"`);

        await handleResponse(ctx, text);
      } catch (err) {
        console.error("Voice handling error:", err);
        await ctx.reply(`Error: ${(err as Error).message}`);
      } finally {
        stopTyping();
      }
    });
  });

  // --- Faza 3: Photo input ---
  bot.on("message:photo", async (ctx) => {
    await enqueue(async () => {
      const stopTyping = startTypingLoop(ctx);
      try {
        // Get largest photo (last in array)
        const photos = ctx.msg.photo;
        const largest = photos[photos.length - 1];
        const file = await ctx.api.getFile(largest.file_id);
        const buffer = await downloadFile(file.file_path!, bot.token);

        // Save to temp file
        const tmpPath = join(tmpdir(), `asystent_photo_${ctx.msg.message_id}.jpg`);
        await writeFile(tmpPath, buffer);

        // Build prompt
        const caption = ctx.msg.caption || "";
        const prompt = caption
          ? `${caption}\n\nZdj\u0119cie zapisane w: ${tmpPath}`
          : `Przeanalizuj zdj\u0119cie zapisane w: ${tmpPath}`;

        console.log(`Photo received, saved to ${tmpPath}`);
        await handleResponse(ctx, prompt);

        // Cleanup
        unlink(tmpPath).catch(() => {});
      } catch (err) {
        console.error("Photo handling error:", err);
        await ctx.reply(`Error: ${(err as Error).message}`);
      } finally {
        stopTyping();
      }
    });
  });

  // Text messages → Claude (streaming) — MUST be last!
  bot.on("message:text", async (ctx) => {
    await enqueue(async () => {
      const stopTyping = startTypingLoop(ctx);
      try {
        console.log(`Text: "${ctx.msg.text}"`);
        await handleResponse(ctx, ctx.msg.text);
      } catch (err) {
        console.error("Text handling error:", err);
        await ctx.reply(`Error: ${(err as Error).message}`);
      } finally {
        stopTyping();
      }
    });
  });

  return bot;
}
