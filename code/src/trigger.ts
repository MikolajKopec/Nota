#!/usr/bin/env node
/**
 * Standalone trigger for scheduled bot prompts
 * Usage: node dist/trigger.js "Your prompt here"
 *
 * This script allows scheduled tasks to invoke the bot with a prompt,
 * as if the user sent a message. The bot processes it using claude -p
 * and sends the response via Telegram.
 */

import { Bot, InputFile } from "grammy";
import { askClaudeStream, StreamCallbacks } from "./claude.js";
import { TELEGRAM_BOT_TOKEN, ALLOWED_USER_ID } from "./config.js";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { logger } from "./logger.js";

const bot = new Bot(TELEGRAM_BOT_TOKEN);

async function sendResponse(text: string): Promise<void> {
  // Extract [IMG:path] markers
  const imgRegex = /\[IMG:([^\]]+)\]/g;
  const images: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = imgRegex.exec(text)) !== null) {
    images.push(match[1]);
  }

  // Remove [IMG:...] markers from text
  const cleanText = text.replace(imgRegex, "").trim();

  // Send images first
  for (const imgPath of images) {
    try {
      await bot.api.sendPhoto(ALLOWED_USER_ID, new InputFile(imgPath));
    } catch (err) {
      console.error(`Failed to send image ${imgPath}:`, err);
    }
  }

  // Send text (split if needed)
  if (cleanText) {
    const chunks = splitMessage(cleanText);
    for (const chunk of chunks) {
      await bot.api.sendMessage(ALLOWED_USER_ID, chunk);
    }
  }
}

function splitMessage(text: string, maxLength = 4096): string[] {
  if (text.length <= maxLength) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to split on newline
    let splitIndex = remaining.lastIndexOf("\n", maxLength);
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      // No good newline, try space
      splitIndex = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      // No good split point, hard cut
      splitIndex = maxLength;
    }

    chunks.push(remaining.slice(0, splitIndex));
    remaining = remaining.slice(splitIndex).trimStart();
  }

  return chunks;
}

async function main() {
  const prompt = process.argv[2];

  if (!prompt) {
    logger.error("trigger", "No prompt provided");
    console.error("Usage: node trigger.js \"Your prompt here\"");
    process.exit(1);
  }

  logger.info("trigger", "Starting trigger execution", { prompt: prompt.slice(0, 100) });

  let fullText = "";
  const startTime = Date.now();

  const callbacks: StreamCallbacks = {
    onText: (chunk) => {
      fullText += chunk;
    },
    onComplete: async (result) => {
      const duration = Date.now() - startTime;
      logger.info("trigger", "Claude processing completed", {
        duration,
        textLength: fullText.length,
        usage: result.usage
      });

      try {
        logger.debug("trigger", "Sending response to Telegram");
        await sendResponse(fullText || result.text);

        // Check for screenshot fallback (same as bot.ts)
        const screenshotDir = join(tmpdir(), "asystent-screenshots");
        try {
          const files = await fs.readdir(screenshotDir);
          const recentPngs = files
            .filter((f) => f.endsWith(".png"))
            .map((f) => ({
              name: f,
              path: join(screenshotDir, f),
              time: parseInt(f.match(/screenshot_(\d+)/)?.[1] || "0"),
            }))
            .filter((f) => Date.now() - f.time < 60_000) // Last 60s
            .sort((a, b) => b.time - a.time);

          if (recentPngs.length > 0) {
            logger.info("trigger", "Found fallback screenshots", { count: recentPngs.length });
          }

          for (const png of recentPngs) {
            if (!fullText.includes(png.path)) {
              logger.debug("trigger", "Sending fallback screenshot", { path: png.name });
              await bot.api.sendPhoto(ALLOWED_USER_ID, new InputFile(png.path));
            }
          }
        } catch (err) {
          logger.error("trigger", "Failed to check for screenshots", { error: (err as Error).message });
        }

        logger.info("trigger", "Trigger execution completed successfully");
        process.exit(0);
      } catch (err) {
        logger.error("trigger", "Failed to send response", { error: (err as Error).message, stack: (err as Error).stack });
        process.exit(1);
      }
    },
    onError: async (err) => {
      logger.error("trigger", "Claude processing error", { error: err.message, stack: err.stack });
      try {
        await bot.api.sendMessage(ALLOWED_USER_ID, `❌ Trigger error: ${err.message}`);
      } catch {}
      process.exit(1);
    },
  };

  try {
    logger.debug("trigger", "Calling askClaudeStream");
    await askClaudeStream(prompt, callbacks);
  } catch (err) {
    logger.error("trigger", "Fatal error", { error: (err as Error).message, stack: (err as Error).stack });
    process.exit(1);
  }
}

main();
