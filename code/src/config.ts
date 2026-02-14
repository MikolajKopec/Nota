import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = resolve(__dirname, "..");

config({ path: resolve(PROJECT_ROOT, ".env") });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env variable: ${name}`);
    process.exit(1);
  }
  return value;
}

export const TELEGRAM_BOT_TOKEN = required("TELEGRAM_BOT_TOKEN");
export const ALLOWED_USER_ID = Number(required("ALLOWED_USER_ID"));
export const WHISPER_URL = process.env.WHISPER_URL || "http://localhost:7860";
export const WHISPER_LANGUAGE = process.env.WHISPER_LANGUAGE || "auto";
