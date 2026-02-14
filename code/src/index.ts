import { createBot } from "./bot.js";
import { logger } from "./logger.js";
import { checkForUpdates, formatUpdateMessage } from "./updates.js";
import { ALLOWED_USER_ID, PROJECT_ROOT } from "./config.js";
import { execSync } from "child_process";
import { existsSync } from "fs";
import { resolve } from "path";

function validateEnvironment(): void {
  // Check claude CLI
  try {
    execSync("claude --version", { stdio: "pipe" });
  } catch {
    logger.error("main", "claude CLI not found in PATH. Install it: npm i -g @anthropic-ai/claude-code");
    process.exit(1);
  }

  // Check .mcp.json
  const mcpPath = resolve(PROJECT_ROOT, ".mcp.json");
  if (!existsSync(mcpPath)) {
    logger.error("main", ".mcp.json not found. Run setup: npx tsx ../setup.ts", { path: mcpPath });
    process.exit(1);
  }

  // Warn if dist/trigger.js missing (scheduled tasks won't work)
  const triggerPath = resolve(PROJECT_ROOT, "dist", "trigger.js");
  if (!existsSync(triggerPath)) {
    logger.warn("main", "dist/trigger.js not found - scheduled tasks won't work. Run: npm run build");
  }
}

logger.info("main", "Starting Asystent bot", {
  platform: process.platform,
  nodeVersion: process.version,
  cwd: process.cwd()
});

validateEnvironment();

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
  },
}).catch((err) => {
  logger.error("main", "Failed to start bot", { error: err.message, stack: err.stack });
  process.exit(1);
});
