import { createBot } from "./bot.js";

const bot = createBot();

// Graceful shutdown
function shutdown(signal: string) {
  console.log(`\n${signal} received, stopping bot...`);
  bot.stop();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

console.log("Starting Asystent bot...");
bot.start({
  drop_pending_updates: true,
  onStart: () => console.log("Bot is running! Send a message on Telegram."),
});
