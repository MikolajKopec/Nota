import { exec } from "child_process";
import { promisify } from "util";
import { resolve, join } from "path";
import { writeFile, unlink, access, mkdir } from "fs/promises";
import { homedir } from "os";
import { PROJECT_ROOT } from "./config.js";
import { logger } from "./logger.js";

const execAsync = promisify(exec);

const WINDOWS_SCRIPT_NAME = "AsystentBot.bat";
const MACOS_PLIST_NAME = "com.asystent.bot.plist";

/**
 * Get platform-specific startup location
 */
function getStartupPath(): { folder: string; file: string } {
  const platform = process.platform;

  if (platform === "win32") {
    // Windows: Startup folder
    const appData = process.env.APPDATA || "";
    if (!appData) {
      throw new Error("APPDATA environment variable not found");
    }
    return {
      folder: join(appData, "Microsoft", "Windows", "Start Menu", "Programs", "Startup"),
      file: WINDOWS_SCRIPT_NAME,
    };
  } else if (platform === "darwin") {
    // macOS: LaunchAgents
    return {
      folder: join(homedir(), "Library", "LaunchAgents"),
      file: MACOS_PLIST_NAME,
    };
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
}

/**
 * Get full path to startup script/plist
 */
function getStartupScriptPath(): string {
  const { folder, file } = getStartupPath();
  return join(folder, file);
}

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
    const scriptPath = getStartupScriptPath();

    // Check if startup script exists
    await access(scriptPath);

    logger.debug("autostart", "Startup script found", { path: scriptPath });
    return {
      enabled: true,
      state: "ready",
    };
  } catch (err) {
    // File doesn't exist - autostart disabled
    logger.debug("autostart", "Startup script not found - autostart disabled");
    return { enabled: false };
  }
}

/**
 * Enable autostart - creates startup script/plist
 */
export async function enableAutostart(): Promise<void> {
  try {
    const codeDir = resolve(PROJECT_ROOT);
    const logFile = resolve(PROJECT_ROOT, "..", "bot.log");
    const { folder, file } = getStartupPath();
    const scriptPath = join(folder, file);

    // Ensure startup folder exists
    await mkdir(folder, { recursive: true });

    if (process.platform === "win32") {
      // Windows: Create batch script
      const batchScript = `@echo off
REM Asystent Bot Autostart Script
cd /d "${codeDir}"
start /min cmd /c "npx tsx src\\index.ts >> "${logFile}" 2>&1"
`;
      await writeFile(scriptPath, batchScript, "utf-8");
    } else if (process.platform === "darwin") {
      // macOS: Create launchd plist
      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.asystent.bot</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>cd "${codeDir}" && npx tsx src/index.ts >> "${logFile}" 2>&1</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>${logFile}</string>
    <key>StandardErrorPath</key>
    <string>${logFile}</string>
</dict>
</plist>`;
      await writeFile(scriptPath, plistContent, "utf-8");

      // Load the plist with launchctl
      await execAsync(`launchctl load "${scriptPath}"`);
    }

    logger.info("autostart", "Autostart enabled successfully", {
      platform: process.platform,
      scriptPath,
      codeDir,
    });
  } catch (err) {
    logger.error("autostart", "Failed to enable autostart", {
      error: (err as Error).message,
    });

    const { folder } = getStartupPath();
    throw new Error(
      `Failed to enable autostart: ${(err as Error).message}\n\n` +
      `Startup folder: ${folder}`
    );
  }
}

/**
 * Disable autostart - removes startup script/plist
 */
export async function disableAutostart(): Promise<void> {
  try {
    const scriptPath = getStartupScriptPath();

    // Check if script exists before trying to delete
    try {
      await access(scriptPath);
    } catch {
      logger.info("autostart", "Startup script doesn't exist, nothing to disable");
      return;
    }

    // Unload launchd plist on macOS
    if (process.platform === "darwin") {
      try {
        await execAsync(`launchctl unload "${scriptPath}"`);
      } catch (err) {
        // Ignore errors if plist is not loaded
        logger.debug("autostart", "launchctl unload error (may not be loaded)", {
          error: (err as Error).message,
        });
      }
    }

    // Delete startup script/plist
    await unlink(scriptPath);
    logger.info("autostart", "Autostart disabled successfully", {
      platform: process.platform,
      scriptPath,
    });
  } catch (err) {
    logger.error("autostart", "Failed to disable autostart", {
      error: (err as Error).message,
    });
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
