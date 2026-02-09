import { Bot, Context, InlineKeyboard } from "grammy";
import { FileFlavor, hydrateFiles } from "@grammyjs/files";
import { TELEGRAM_BOT_TOKEN, ALLOWED_USER_ID } from "./config.js";
import { transcribe } from "./transcribe.js";
import { askClaude, debugClaude, resetSession, switchToSession, getSessionHistory } from "./claude.js";

type MyContext = FileFlavor<Context>;

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "teraz";
  if (minutes < 60) return `${minutes}min temu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h temu`;
  const days = Math.floor(hours / 24);
  return `${days}d temu`;
}

export function createBot(): Bot<MyContext> {
  const bot = new Bot<MyContext>(TELEGRAM_BOT_TOKEN);

  bot.api.config.use(hydrateFiles(bot.token));

  // Auth middleware — ignore messages from strangers
  bot.use(async (ctx, next) => {
    if (ctx.from?.id !== ALLOWED_USER_ID) {
      console.log(`Ignored message from user ${ctx.from?.id}`);
      return;
    }
    await next();
  });

  // /start command
  bot.command("start", async (ctx) => {
    resetSession();
    await ctx.reply("Cześć! Wyślij mi wiadomość tekstową lub głosową, a zarządzę Twoją kryptą Obsidian.");
  });

  // /new — reset session
  bot.command("new", async (ctx) => {
    resetSession();
    await ctx.reply("Nowa sesja. Następna wiadomość rozpocznie nową rozmowę.");
  });

  // /rewind — show inline keyboard with recent sessions
  bot.command("rewind", async (ctx) => {
    const history = getSessionHistory();
    if (history.length === 0) {
      await ctx.reply("Brak poprzednich sesji.");
      return;
    }

    const keyboard = new InlineKeyboard();
    // Show last 5 sessions, newest first
    const recent = history.slice(-5).reverse();
    for (const entry of recent) {
      keyboard.text(`${entry.label} (${timeAgo(entry.startedAt)})`, `session:${entry.id}`).row();
    }

    await ctx.reply("Wybierz sesję do przywrócenia:", { reply_markup: keyboard });
  });

  // Callback query handler for session selection
  bot.callbackQuery(/^session:/, async (ctx) => {
    const id = ctx.callbackQuery.data.replace("session:", "");
    const history = getSessionHistory();
    const entry = history.find((e) => e.id === id);

    if (!entry) {
      await ctx.answerCallbackQuery("Sesja nie znaleziona.");
      return;
    }

    switchToSession(id);
    await ctx.answerCallbackQuery("Przywrócono sesję");
    await ctx.editMessageText(`Przywrócono sesję: ${entry.label}`);
  });

  // /test — debug diagnostics
  bot.command("test", async (ctx) => {
    await ctx.reply("⏳ Running diagnostics...");
    try {
      const report = await debugClaude();
      await ctx.reply(report);
    } catch (err) {
      await ctx.reply(`Debug error: ${(err as Error).message}`);
    }
  });

  // Voice messages → transcribe → Claude
  bot.on("message:voice", async (ctx) => {
    await ctx.replyWithChatAction("typing");

    try {
      // Download the voice file
      const file = await ctx.getFile();
      const buffer = await downloadFile(file.file_path!, bot.token);

      console.log(`Transcribing voice (${ctx.msg.voice.duration}s)...`);
      await ctx.replyWithChatAction("typing");
      const text = await transcribe(buffer, "voice.ogg");
      console.log(`Transcription: "${text}"`);

      // Send transcription to Claude
      await ctx.replyWithChatAction("typing");
      const response = await askClaude(text);
      await ctx.reply(response);
    } catch (err) {
      console.error("Voice handling error:", err);
      await ctx.reply(`Błąd: ${(err as Error).message}`);
    }
  });

  // Text messages → Claude
  bot.on("message:text", async (ctx) => {
    await ctx.replyWithChatAction("typing");

    try {
      console.log(`Text: "${ctx.msg.text}"`);
      const response = await askClaude(ctx.msg.text);
      await ctx.reply(response);
    } catch (err) {
      console.error("Text handling error:", err);
      await ctx.reply(`Błąd: ${(err as Error).message}`);
    }
  });

  return bot;
}

async function downloadFile(filePath: string, token: string): Promise<Buffer> {
  const url = `https://api.telegram.org/file/bot${token}/${filePath}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download file: ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
