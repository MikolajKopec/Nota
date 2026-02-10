import { exec } from "child_process";
import { promisify } from "util";
import { resolve } from "path";
import { PROJECT_ROOT } from "./config.js";
import { logger } from "./logger.js";

const execAsync = promisify(exec);

const TASK_NAME = "AsystentBotAutostart";

export interface AutostartStatus {
  enabled: boolean;
  state?: "ready" | "running" | "disabled";
  lastRun?: Date;
  nextRun?: Date;
}

/**
 * Check if autostart is enabled and get its status
 */
export async function getAutostartStatus(): Promise<AutostartStatus> {
  try {
    // Check if task exists
    const { stdout } = await execAsync(
      `powershell -Command "Get-ScheduledTask -TaskName '${TASK_NAME}' -ErrorAction SilentlyContinue | ConvertTo-Json"`
    );

    if (!stdout.trim()) {
      logger.debug("autostart", "Task not found");
      return { enabled: false };
    }

    const task = JSON.parse(stdout);
    const state = task.State?.toLowerCase() || "unknown";

    logger.debug("autostart", "Task status retrieved", { state });

    return {
      enabled: true,
      state: state === "ready" ? "ready" : state === "running" ? "running" : "disabled",
    };
  } catch (err) {
    logger.error("autostart", "Failed to get status", { error: (err as Error).message });
    return { enabled: false };
  }
}

/**
 * Enable autostart - creates scheduled task that runs bot at system startup
 */
export async function enableAutostart(): Promise<void> {
  try {
    const codeDir = resolve(PROJECT_ROOT);
    const logFile = resolve(PROJECT_ROOT, "..", "bot.log");

    // Use npx tsx to run the bot
    const command = `cmd.exe`;
    const args = `/c cd /d "${codeDir}" && npx tsx src\\index.ts >> "${logFile}" 2>&1`;

    // Create task using schtasks
    const createCmd = `powershell -Command "` +
      `$action = New-ScheduledTaskAction -Execute '${command}' -Argument '${args}' -WorkingDirectory '${codeDir}'; ` +
      `$trigger = New-ScheduledTaskTrigger -AtStartup; ` +
      `$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1); ` +
      `$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited; ` +
      `Register-ScheduledTask -TaskName '${TASK_NAME}' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Asystent Telegram bot - starts automatically on system startup' -Force | Out-Null` +
      `"`;

    await execAsync(createCmd);
    logger.info("autostart", "Autostart enabled successfully");
  } catch (err) {
    logger.error("autostart", "Failed to enable autostart", { error: (err as Error).message });
    throw new Error(`Failed to enable autostart: ${(err as Error).message}`);
  }
}

/**
 * Disable autostart - removes scheduled task
 */
export async function disableAutostart(): Promise<void> {
  try {
    await execAsync(
      `powershell -Command "Unregister-ScheduledTask -TaskName '${TASK_NAME}' -Confirm:$false -ErrorAction SilentlyContinue"`
    );
    logger.info("autostart", "Autostart disabled successfully");
  } catch (err) {
    logger.error("autostart", "Failed to disable autostart", { error: (err as Error).message });
    throw new Error(`Failed to disable autostart: ${(err as Error).message}`);
  }
}

/**
 * Ensure autostart is enabled on first run
 * Safe to call multiple times - only enables if not already enabled
 */
export async function ensureAutostartEnabled(): Promise<void> {
  try {
    const status = await getAutostartStatus();

    if (!status.enabled) {
      logger.info("autostart", "Autostart not configured, enabling by default");
      await enableAutostart();
      logger.info("autostart", "✓ Autostart enabled (will start bot on system startup)");
    } else {
      logger.debug("autostart", "Autostart already configured", { state: status.state });
    }
  } catch (err) {
    // Don't fail bot startup if autostart setup fails
    logger.warn("autostart", "Failed to setup autostart", { error: (err as Error).message });
  }
}
