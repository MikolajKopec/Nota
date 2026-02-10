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
  },
}).catch((err) => {
  logger.error("main", "Failed to start bot", { error: err.message, stack: err.stack });
  process.exit(1);
});
