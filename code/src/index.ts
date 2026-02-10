import { createBot } from "./bot.js";
import { logger } from "./logger.js";
import { checkForUpdates, formatUpdateMessage } from "./updates.js";
import { ALLOWED_USER_ID } from "./config.js";

logger.info("main", "Starting Asystent bot", {
  platform: process.platform,
  nodeVersion: process.version,
  cwd: process.cwd()
});

const bot = createBot();

// Graceful shutdown
function shutdown(signal: string) {
  logger.info("main", `${signal} received, stopping bot`);
  bot.stop();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

bot.start({
  drop_pending_updates: true,
  onStart: () => {
    logger.info("main", "Bot is running! Send a message on Telegram.");
    console.log("Bot is running! Send a message on Telegram.");

    // Check for updates after bot starts
    setTimeout(async () => {
      try {
        logger.debug("main", "Checking for updates on startup");
        const info = await checkForUpdates();

        if (info.hasUpdates) {
          const message = "🔔 **Updates Available**\n\n" + formatUpdateMessage(info);
          await bot.api.sendMessage(ALLOWED_USER_ID, message, { parse_mode: "Markdown" });
          logger.info("main", "Update notification sent to user");
        } else {
          logger.debug("main", "No updates available");
        }
      } catch (err) {
        logger.error("main", "Failed to check for updates on startup", {
          error: (err as Error).message,
        });
      }
    }, 2000); // Wait 2 seconds after bot starts
  },
}).catch((err) => {
  logger.error("main", "Failed to start bot", { error: err.message, stack: err.stack });
  process.exit(1);
});
