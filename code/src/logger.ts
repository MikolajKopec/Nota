import { appendFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_FILE = resolve(__dirname, "..", "..", "bot.log");

// Ensure log file directory exists
try {
  mkdirSync(dirname(LOG_FILE), { recursive: true });
} catch {}

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LOG_LEVEL_NAMES = {
  [LogLevel.DEBUG]: "DEBUG",
  [LogLevel.INFO]: "INFO ",
  [LogLevel.WARN]: "WARN ",
  [LogLevel.ERROR]: "ERROR",
};

// Set via env or default to INFO
const CURRENT_LOG_LEVEL = parseInt(process.env.LOG_LEVEL || "1");

function formatTimestamp(): string {
  const now = new Date();
  return now.toISOString();
}

function log(level: LogLevel, module: string, message: string, data?: any): void {
  if (level < CURRENT_LOG_LEVEL) return;

  const timestamp = formatTimestamp();
  const levelName = LOG_LEVEL_NAMES[level];
  const dataStr = data ? ` ${JSON.stringify(data)}` : "";
  const logLine = `[${timestamp}] [${levelName}] [${module}] ${message}${dataStr}`;

  // Console output
  if (level === LogLevel.ERROR) {
    console.error(logLine);
  } else if (level === LogLevel.WARN) {
    console.warn(logLine);
  } else {
    console.log(logLine);
  }

  // File output
  try {
    appendFileSync(LOG_FILE, logLine + "\n");
  } catch (err) {
    console.error(`Failed to write to log file: ${err}`);
  }
}

export const logger = {
  debug: (module: string, message: string, data?: any) => log(LogLevel.DEBUG, module, message, data),
  info: (module: string, message: string, data?: any) => log(LogLevel.INFO, module, message, data),
  warn: (module: string, message: string, data?: any) => log(LogLevel.WARN, module, message, data),
  error: (module: string, message: string, data?: any) => log(LogLevel.ERROR, module, message, data),
};
