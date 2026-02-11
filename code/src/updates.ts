import { exec } from "child_process";
import { promisify } from "util";
import { resolve } from "path";
import { logger } from "./logger.js";

const execAsync = promisify(exec);
const PROJECT_ROOT = resolve(process.cwd());

export interface UpdateInfo {
  hasUpdates: boolean;
  gitBehindBy?: number;
  gitAheadBy?: number;
  currentBranch?: string;
  remoteBranch?: string;
  error?: string;
}

/**
 * Check for available updates from git remote
 */
export async function checkForUpdates(): Promise<UpdateInfo> {
  try {
    const gitInfo = await checkGitUpdates();

    if (gitInfo.hasUpdates) {
      logger.info("updates", "Updates available", {
        behindBy: gitInfo.gitBehindBy,
      });
    } else {
      logger.debug("updates", "No updates available");
    }

    return gitInfo;
  } catch (err) {
    logger.error("updates", "Failed to check for updates", {
      error: (err as Error).message,
    });
    return {
      hasUpdates: false,
      error: (err as Error).message,
    };
  }
}

/**
 * Check for git updates from remote
 */
async function checkGitUpdates(): Promise<UpdateInfo> {
  try {
    // Fetch latest from remote
    await execAsync("git fetch origin --quiet");

    // Get current branch
    const { stdout: branchOutput } = await execAsync(
      "git rev-parse --abbrev-ref HEAD"
    );
    const currentBranch = branchOutput.trim();

    // Get remote tracking branch
    const { stdout: remoteOutput } = await execAsync(
      `git rev-parse --abbrev-ref ${currentBranch}@{upstream}`
    );
    const remoteBranch = remoteOutput.trim();

    // Check if local is behind remote
    const { stdout: behindOutput } = await execAsync(
      `git rev-list --count HEAD..${remoteBranch}`
    );
    const behindBy = parseInt(behindOutput.trim(), 10);

    // Check if local is ahead of remote
    const { stdout: aheadOutput } = await execAsync(
      `git rev-list --count ${remoteBranch}..HEAD`
    );
    const aheadBy = parseInt(aheadOutput.trim(), 10);

    logger.debug("updates", "Git status checked", {
      currentBranch,
      remoteBranch,
      behindBy,
      aheadBy,
    });

    return {
      hasUpdates: behindBy > 0,
      gitBehindBy: behindBy,
      gitAheadBy: aheadBy,
      currentBranch,
      remoteBranch,
    };
  } catch (err) {
    logger.warn("updates", "Failed to check git updates", {
      error: (err as Error).message,
    });
    // Not a git repo or no remote - not an error
    return { hasUpdates: false };
  }
}


/**
 * Format update info as user-friendly message
 */
export function formatUpdateMessage(info: UpdateInfo): string {
  if (info.error) {
    return `❌ Failed to check for updates: ${info.error}`;
  }

  if (!info.hasUpdates) {
    return "✅ Bot is up to date!";
  }

  if (info.gitBehindBy) {
    return (
      `🔄 **New version available!**\n\n` +
      `Branch: ${info.currentBranch}\n` +
      `Behind remote by ${info.gitBehindBy} commit${info.gitBehindBy > 1 ? "s" : ""}\n` +
      (info.gitAheadBy && info.gitAheadBy > 0
        ? `Ahead by ${info.gitAheadBy} commit${info.gitAheadBy > 1 ? "s" : ""} (unpushed changes)\n\n`
        : "\n")
    );
  }

  return "✅ Bot is up to date!";
}

/**
 * Check for updates and notify if found (for scheduled checks)
 */
export async function checkAndNotify(): Promise<{ hasUpdates: boolean; message: string }> {
  const info = await checkForUpdates();
  const message = formatUpdateMessage(info);

  return { hasUpdates: info.hasUpdates, message };
}

/**
 * Schedule bot restart after 1 minute using Windows Task Scheduler
 */
export async function scheduleRestart(): Promise<void> {
  try {
    const taskName = "AsystentBotRestart_OneTime";
    const codeDir = PROJECT_ROOT;
    const logFile = resolve(PROJECT_ROOT, "..", "bot.log");

    // Calculate time 1 minute from now
    const now = new Date();
    const runTime = new Date(now.getTime() + 60 * 1000); // 1 minute from now
    const timeStr = runTime.toTimeString().slice(0, 5); // HH:MM format

    // Delete existing restart task if present
    await execAsync(
      `powershell -Command "Unregister-ScheduledTask -TaskName '${taskName}' -Confirm:$false -ErrorAction SilentlyContinue"`
    ).catch(() => {
      // Ignore errors if task doesn't exist
    });

    // Use node.exe with compiled dist/index.js (no need for tsx in PATH)
    const nodeExe = process.execPath; // Full path to node.exe
    const distIndex = resolve(codeDir, "dist", "index.js");

    // Create one-time scheduled task
    const createCmd = `powershell -Command "` +
      `$action = New-ScheduledTaskAction -Execute '${nodeExe}' -Argument '\\"${distIndex}\\"' -WorkingDirectory '${codeDir}'; ` +
      `$trigger = New-ScheduledTaskTrigger -Once -At '${timeStr}'; ` +
      `$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable; ` +
      `$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive; ` +
      `Register-ScheduledTask -TaskName '${taskName}' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'One-time bot restart after update' -Force | Out-Null` +
      `"`;

    await execAsync(createCmd);
    logger.info("updates", "Scheduled bot restart", { time: runTime.toISOString() });
  } catch (err) {
    logger.error("updates", "Failed to schedule restart", {
      error: (err as Error).message,
    });
    throw new Error(`Failed to schedule restart: ${(err as Error).message}`);
  }
}

/**
 * Apply available updates (git pull + npm run build)
 */
export async function applyUpdates(): Promise<{ success: boolean; message: string }> {
  try {
    logger.info("updates", "Starting update process");

    // Step 1: Git pull
    logger.debug("updates", "Running git pull");
    const { stdout: pullOutput, stderr: pullError } = await execAsync("git pull");
    logger.debug("updates", "Git pull output", { stdout: pullOutput, stderr: pullError });

    if (pullOutput.includes("Already up to date")) {
      logger.info("updates", "No updates to apply");
      return {
        success: true,
        message: "✅ Already up to date!",
      };
    }

    // Step 2: Install dependencies (in case new ones were added)
    logger.debug("updates", "Running npm install");
    const { stdout: installOutput } = await execAsync("npm install", {
      cwd: process.cwd(),
    });
    logger.debug("updates", "npm install output", { stdout: installOutput });

    // Step 3: Build
    logger.debug("updates", "Running npm run build");
    const { stdout: buildOutput } = await execAsync("npm run build", {
      cwd: process.cwd(),
    });
    logger.debug("updates", "Build output", { stdout: buildOutput });

    logger.info("updates", "Update applied successfully");
    return {
      success: true,
      message:
        "✅ **Update successful!**\n\n" +
        "Changes applied. Bot will restart in 3 seconds...",
    };
  } catch (err) {
    logger.error("updates", "Failed to apply updates", {
      error: (err as Error).message,
    });

    const errorMsg = (err as Error).message;

    // Check for common errors
    if (errorMsg.includes("CONFLICT")) {
      return {
        success: false,
        message:
          "❌ **Update failed - Git conflict**\n\n" +
          "Manual intervention required:\n" +
          "```\ngit status\n# Resolve conflicts\ngit pull\nnpm run build\n```",
      };
    }

    if (errorMsg.includes("uncommitted changes")) {
      return {
        success: false,
        message:
          "❌ **Update failed - Uncommitted changes**\n\n" +
          "You have local changes. Commit or stash them first:\n" +
          "```\ngit status\ngit stash\ngit pull\nnpm run build\n```",
      };
    }

    return {
      success: false,
      message: `❌ **Update failed**\n\n${errorMsg}`,
    };
  }
}
