import { spawn, ChildProcess } from "child_process";
import { resolve } from "path";
import { randomUUID } from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { PROJECT_ROOT } from "./config.js";

const MCP_CONFIG = resolve(PROJECT_ROOT, ".mcp.json");

// Load system prompt from .claude/CLAUDE.md
function loadSystemPrompt(): string {
  try {
    return readFileSync(resolve(PROJECT_ROOT, ".claude", "CLAUDE.md"), "utf-8");
  } catch (err) {
    console.error("[claude] Failed to load .claude/CLAUDE.md:", (err as Error).message);
    return "Jesteś osobistym asystentem użytkownika. Odpowiadaj po polsku.";
  }
}

const SYSTEM_PROMPT = loadSystemPrompt();

const ALLOWED_TOOLS = "mcp__user-notes__*,mcp__brain__*,mcp__filesystem__*,mcp__puppeteer__*,mcp__memory__*,WebSearch,WebFetch,Bash";
const MODEL = "claude-sonnet-4-5-20250929";
const TIMEOUT_MS = 120_000;

// --- Session persistence ---

const SESSIONS_FILE = resolve(PROJECT_ROOT, "sessions.json");

interface SessionEntry {
  id: string;
  label: string;      // first message truncated to 40 chars
  startedAt: number;   // Date.now()
}

interface SessionState {
  currentSessionId: string | null;
  history: SessionEntry[];
}

function loadSessions(): SessionState {
  try {
    const data = readFileSync(SESSIONS_FILE, "utf-8");
    const parsed = JSON.parse(data) as SessionState;
    return {
      currentSessionId: parsed.currentSessionId ?? null,
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return { currentSessionId: null, history: [] };
  }
}

function saveSessions(): void {
  const state: SessionState = {
    currentSessionId,
    history: sessionHistory,
  };
  try {
    writeFileSync(SESSIONS_FILE, JSON.stringify(state, null, 2));
  } catch (err) {
    console.error("[sessions] Failed to save:", (err as Error).message);
  }
}

// Load persisted state on module init
const _loaded = loadSessions();
let currentSessionId: string | null = _loaded.currentSessionId;
const sessionHistory: SessionEntry[] = _loaded.history;

export function resetSession(): void {
  currentSessionId = null;
  saveSessions();
}

export function switchToSession(id: string): void {
  currentSessionId = id;
  saveSessions();
}

export function getSessionHistory(): SessionEntry[] {
  return [...sessionHistory];
}

export function getCurrentSessionId(): string | null {
  return currentSessionId;
}

// --- Streaming types ---

export interface StreamCallbacks {
  onText?: (textChunk: string) => void;
  onToolUse?: (toolName: string) => void;
  onComplete?: (result: StreamResult) => void;
  onError?: (error: Error) => void;
}

export interface UsageInfo {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface StreamResult {
  text: string;
  usage: UsageInfo | null;
  resumeFailed?: boolean;
}

// --- Claude CLI (original, kept for backward compat / debug) ---

function spawnClaude(args: string[], userMessage: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("claude", args, {
      cwd: PROJECT_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdin.write(userMessage);
    proc.stdin.end();

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    proc.stderr.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      if (text.trim()) console.error("[claude stderr]", text.trim());
    });

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      reject(new Error("Claude timed out after " + TIMEOUT_MS / 1000 + "s"));
    }, TIMEOUT_MS);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout.trim() || "(Claude nie zwrócił odpowiedzi)");
      } else {
        reject(new Error(`Claude exited with code ${code}: ${stderr.trim()}`));
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}

// --- Streaming spawn ---

interface SpawnStreamHandle {
  promise: Promise<StreamResult>;
  kill: () => void;
}

function spawnClaudeStream(args: string[], userMessage: string, callbacks: StreamCallbacks): SpawnStreamHandle {
  let proc: ChildProcess;
  let killed = false;

  const promise = new Promise<StreamResult>((resolvePromise, rejectPromise) => {
    proc = spawn("claude", args, {
      cwd: PROJECT_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdin!.write(userMessage);
    proc.stdin!.end();

    let lineBuffer = "";
    let fullText = "";
    let usage: UsageInfo | null = null;
    let stderr = "";

    function processLine(line: string) {
      if (!line.trim()) return;
      try {
        const parsed = JSON.parse(line);

        // stream-json wraps events: {"type":"stream_event","event":{...}}
        // But it can also emit {"type":"assistant","message":{...}} at the end
        if (parsed.type === "stream_event" && parsed.event) {
          const evt = parsed.event;

          if (evt.type === "content_block_delta" && evt.delta) {
            if (evt.delta.type === "text_delta" && evt.delta.text) {
              fullText += evt.delta.text;
              callbacks.onText?.(evt.delta.text);
            }
          } else if (evt.type === "content_block_start" && evt.content_block) {
            if (evt.content_block.type === "tool_use") {
              callbacks.onToolUse?.(evt.content_block.name || "unknown");
            }
          } else if (evt.type === "message_delta" && evt.usage) {
            usage = {
              input_tokens: evt.usage.input_tokens ?? 0,
              output_tokens: evt.usage.output_tokens ?? 0,
              cache_creation_input_tokens: evt.usage.cache_creation_input_tokens,
              cache_read_input_tokens: evt.usage.cache_read_input_tokens,
            };
          } else if (evt.type === "message_start" && evt.message?.usage) {
            // Initial usage info (input tokens)
            const u = evt.message.usage;
            usage = {
              input_tokens: u.input_tokens ?? 0,
              output_tokens: u.output_tokens ?? 0,
              cache_creation_input_tokens: u.cache_creation_input_tokens,
              cache_read_input_tokens: u.cache_read_input_tokens,
            };
          }
        } else if (parsed.type === "result") {
          // Final result message from claude CLI stream-json
          if (parsed.result) {
            fullText = parsed.result;
          }
          if (parsed.usage) {
            usage = {
              input_tokens: parsed.usage.input_tokens ?? 0,
              output_tokens: parsed.usage.output_tokens ?? 0,
              cache_creation_input_tokens: parsed.usage.cache_creation_input_tokens,
              cache_read_input_tokens: parsed.usage.cache_read_input_tokens,
            };
          }
        }
      } catch {
        // Not valid JSON, skip
      }
    }

    proc.stdout!.on("data", (chunk: Buffer) => {
      lineBuffer += chunk.toString();
      const lines = lineBuffer.split("\n");
      // Keep the last incomplete line in buffer
      lineBuffer = lines.pop() || "";
      for (const line of lines) {
        processLine(line);
      }
    });

    proc.stderr!.on("data", (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      if (text.trim()) console.error("[claude stderr]", text.trim());
    });

    const timer = setTimeout(() => {
      killed = true;
      proc.kill("SIGTERM");
      const err = new Error("Claude timed out after " + TIMEOUT_MS / 1000 + "s");
      callbacks.onError?.(err);
      rejectPromise(err);
    }, TIMEOUT_MS);

    proc.on("close", (code) => {
      clearTimeout(timer);
      if (killed) return;

      // Process any remaining data in buffer
      if (lineBuffer.trim()) {
        processLine(lineBuffer);
        lineBuffer = "";
      }

      if (code === 0) {
        const result: StreamResult = {
          text: fullText.trim() || "(Claude nie zwrócił odpowiedzi)",
          usage,
        };
        callbacks.onComplete?.(result);
        resolvePromise(result);
      } else {
        const err = new Error(`Claude exited with code ${code}: ${stderr.trim()}`);
        callbacks.onError?.(err);
        rejectPromise(err);
      }
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      const wrapped = new Error(`Failed to spawn claude: ${err.message}`);
      callbacks.onError?.(wrapped);
      rejectPromise(wrapped);
    });
  });

  return {
    promise,
    kill: () => {
      killed = true;
      proc?.kill("SIGTERM");
    },
  };
}

// --- Public API ---

export async function askClaude(userMessage: string): Promise<string> {
  if (currentSessionId === null) {
    // New session
    currentSessionId = randomUUID();

    sessionHistory.push({
      id: currentSessionId,
      label: userMessage.slice(0, 40),
      startedAt: Date.now(),
    });

    // Keep max 10 entries
    while (sessionHistory.length > 10) {
      sessionHistory.shift();
    }
    saveSessions();

    const args = [
      "-p",
      "--session-id", currentSessionId,
      "--model", MODEL,
      "--output-format", "text",
      "--mcp-config", MCP_CONFIG,
      "--strict-mcp-config",
      "--system-prompt", SYSTEM_PROMPT,
      "--allowedTools", ALLOWED_TOOLS,
    ];

    return spawnClaude(args, userMessage);
  } else {
    // Resume existing session
    const args = [
      "--resume", currentSessionId,
      "-p",
      "--model", MODEL,
      "--output-format", "text",
      "--mcp-config", MCP_CONFIG,
      "--strict-mcp-config",
      "--allowedTools", ALLOWED_TOOLS,
    ];

    try {
      return await spawnClaude(args, userMessage);
    } catch (err) {
      // Retry as new session if resume fails
      console.error("[claude] Resume failed, retrying as new session:", (err as Error).message);
      currentSessionId = null;
      saveSessions();
      return askClaude(userMessage);
    }
  }
}

export async function askClaudeStream(userMessage: string, callbacks: StreamCallbacks): Promise<StreamResult> {
  if (currentSessionId === null) {
    // New session
    currentSessionId = randomUUID();

    sessionHistory.push({
      id: currentSessionId,
      label: userMessage.slice(0, 40),
      startedAt: Date.now(),
    });

    while (sessionHistory.length > 10) {
      sessionHistory.shift();
    }
    saveSessions();

    const args = [
      "-p",
      "--verbose",
      "--session-id", currentSessionId,
      "--model", MODEL,
      "--output-format", "stream-json",
      "--include-partial-messages",
      "--mcp-config", MCP_CONFIG,
      "--strict-mcp-config",
      "--system-prompt", SYSTEM_PROMPT,
      "--allowedTools", ALLOWED_TOOLS,
    ];

    const handle = spawnClaudeStream(args, userMessage, callbacks);
    return handle.promise;
  } else {
    // Resume existing session
    const args = [
      "--resume", currentSessionId,
      "-p",
      "--verbose",
      "--model", MODEL,
      "--output-format", "stream-json",
      "--include-partial-messages",
      "--mcp-config", MCP_CONFIG,
      "--strict-mcp-config",
      "--allowedTools", ALLOWED_TOOLS,
    ];

    try {
      const handle = spawnClaudeStream(args, userMessage, callbacks);
      return await handle.promise;
    } catch (err) {
      console.error("[claude] Resume failed, retrying as new session:", (err as Error).message);
      currentSessionId = null;
      saveSessions();
      const result = await askClaudeStream(userMessage, callbacks);
      result.resumeFailed = true;
      return result;
    }
  }
}

export async function debugClaude(): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      "--model", MODEL,
      "--output-format", "json",
      "--mcp-config", MCP_CONFIG,
      "--strict-mcp-config",
      "--system-prompt", "List your available tools. Respond in JSON only. Do not call any tools.",
    ];

    const proc = spawn("claude", args, {
      cwd: PROJECT_ROOT,
      stdio: ["pipe", "pipe", "pipe"],
    });

    proc.stdin.write("List ALL your available MCP tools. Reply with a JSON array of tool names, e.g. [\"mcp__brain__read_note\",...]");
    proc.stdin.end();

    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      resolve(formatDebug(args, "TIMEOUT", stderr, ""));
    }, 30_000);

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve(formatDebug(args, `exit ${code}`, stderr, stdout));
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve(formatDebug(args, `spawn error: ${err.message}`, stderr, ""));
    });
  });
}

function formatDebug(args: string[], status: string, stderr: string, stdout: string): string {
  let cost = "?";
  let duration = "?";
  let apiDuration = "?";
  let turns = "?";
  let tokens = "?";
  let tools = "?";
  try {
    const json = JSON.parse(stdout);
    cost = json.total_cost_usd != null ? `$${json.total_cost_usd.toFixed(4)}` : "?";
    duration = json.duration_ms != null ? `${json.duration_ms}ms` : "?";
    apiDuration = json.duration_api_ms != null ? `${json.duration_api_ms}ms` : "?";
    turns = json.num_turns != null ? String(json.num_turns) : "?";
    const u = json.usage;
    if (u) {
      tokens = `in=${u.input_tokens} out=${u.output_tokens} cache_create=${u.cache_creation_input_tokens} cache_read=${u.cache_read_input_tokens}`;
    }
    const resultText = json.result || "";
    tools = resultText.length > 1500 ? resultText.slice(0, 1500) + "…" : resultText;
  } catch {}

  const lines = [
    `🔧 DEBUG — claude -p`,
    ``,
    `Status: ${status}`,
    `Model (requested): ${MODEL}`,
    `Cost: ${cost}`,
    `Duration: ${duration} (API: ${apiDuration})`,
    `Turns: ${turns}`,
    `Tokens: ${tokens}`,
    `CWD: ${PROJECT_ROOT}`,
    ``,
    `Available tools:`,
    tools,
    ``,
    `Stderr:`,
    stderr.trim().slice(0, 500) || "(empty)",
  ];
  return lines.join("\n");
}
