import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "./logger.js";

const execAsync = promisify(exec);

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
        : "\n") +
      `To update:\n` +
      `\`\`\`\ngit pull\nnpm run build\n\`\`\``
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
