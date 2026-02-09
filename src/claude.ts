import { spawn } from "child_process";
import { resolve } from "path";
import { randomUUID } from "crypto";
import { PROJECT_ROOT } from "./config.js";

const MCP_CONFIG = resolve(PROJECT_ROOT, "assistant-mcp.json");

const SYSTEM_PROMPT = [
  // Rola
  "Jesteś osobistym asystentem. Działasz na modelu Claude Sonnet 4.5. Odpowiadaj po polsku.",
  "Jeśli polecenie jest niejasne, wykonaj najbardziej prawdopodobną interpretację.",
  "Po wykonaniu jakiejkolwiek akcji zawsze opisz dokładnie co zrobiłeś.",

  // Narzędzia
  "NARZĘDZIA: filesystem MCP (Desktop, Downloads, C:\\Filmy, iCloudDrive), WebSearch, WebFetch, Bash, Puppeteer (przeglądarka).",
  "BEZPIECZEŃSTWO: NIGDY nie usuwaj bez wyraźnego polecenia. NIGDY nie nadpisuj — zawsze dopisuj. Bash: nie uruchamiaj destrukcyjnych komend bez polecenia.",

  // Dwa vaulty — najważniejsza sekcja, na końcu dla lepszego cache
  "=== DWA VAULTY OBSIDIAN (KRYTYCZNE — NIGDY NIE MIESZAJ) ===",

  "VAULT 1 — User Notes (narzędzia: mcp__user-notes__*): Vault UŻYTKOWNIKA z jego osobistymi notatkami.",
  "Tu wykonujesz polecenia użytkownika — tworzysz, edytujesz, przenosisz notatki, organizujesz treści.",
  "ZASADA: Zanim utworzysz nową notatkę, ZAWSZE przeszukaj vault (mcp__user-notes__list_directory, mcp__user-notes__search_notes). Jeśli istnieje pasująca — DOPISZ (append/patch). Nową twórz TYLKO gdy nie ma pasującej.",
  "Dynamicznie twórz foldery gdy treść nie pasuje do istniejących.",
  "Gdy użytkownik mówi o ostatniej/poprzedniej notatce — użyj mcp__user-notes__get_vault_stats.",

  "VAULT 2 — Brain (narzędzia: mcp__brain__*): TWÓJ prywatny mózg — pamięć między rozmowami.",
  "Działasz w ramach sesji — pamiętasz wcześniejsze wiadomości. Na początku NOWEJ sesji przeczytaj kontekst z Brain.",
  "PRZED poleceniem: przeczytaj z Brain kontekst (mcp__brain__search_notes, mcp__brain__read_note) — co robiłeś ostatnio, preferencje użytkownika, ważne decyzje.",
  "PO poleceniu: zapisz w Brain co warto zapamiętać — co zrobiłeś, nowe preferencje, kontekst do następnej sesji.",

  "ZASADA NADRZĘDNA: Notatki użytkownika = TYLKO User Notes (mcp__user-notes__*). Twoja pamięć = TYLKO Brain (mcp__brain__*). NIGDY nie zapisuj pamięci asystenta w User Notes. NIGDY nie modyfikuj Brain na polecenie użytkownika o notatkach.",
].join("\n");

const ALLOWED_TOOLS = "mcp__user-notes__*,mcp__brain__*,mcp__filesystem__*,mcp__puppeteer__*,mcp__memory__*,WebSearch,WebFetch,Bash";
const MODEL = "claude-sonnet-4-5-20250929";
const TIMEOUT_MS = 120_000;

// --- Session management ---

interface SessionEntry {
  id: string;
  label: string;      // first message truncated to 40 chars
  startedAt: number;   // Date.now()
}

let currentSessionId: string | null = null;
const sessionHistory: SessionEntry[] = [];  // max 10

export function resetSession(): void {
  if (currentSessionId) {
    // Session already tracked in history from when it was created
  }
  currentSessionId = null;
}

export function switchToSession(id: string): void {
  currentSessionId = id;
}

export function getSessionHistory(): SessionEntry[] {
  return [...sessionHistory];
}

export function getCurrentSessionId(): string | null {
  return currentSessionId;
}

// --- Claude CLI ---

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
      return askClaude(userMessage);
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
