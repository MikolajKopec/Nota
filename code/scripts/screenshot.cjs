const puppeteer = require("puppeteer-core");
const path = require("path");
const os = require("os");
const fs = require("fs");

const BROWSER_PATHS = [
  process.env.PROGRAMFILES + "\\Google\\Chrome\\Application\\chrome.exe",
  process.env["PROGRAMFILES(X86)"] + "\\Google\\Chrome\\Application\\chrome.exe",
  (process.env.LOCALAPPDATA || "") + "\\Google\\Chrome\\Application\\chrome.exe",
  process.env.PROGRAMFILES + "\\Microsoft\\Edge\\Application\\msedge.exe",
  process.env["PROGRAMFILES(X86)"] + "\\Microsoft\\Edge\\Application\\msedge.exe",
];

function findBrowser() {
  for (const p of BROWSER_PATHS) {
    if (p && fs.existsSync(p)) return p;
  }
  throw new Error("Chrome or Edge not found on this system");
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: node screenshot.cjs <url>");
    process.exit(1);
  }

  const normalizedUrl = url.startsWith("http") ? url : `https://${url}`;
  const screenshotDir = path.join(os.tmpdir(), "asystent-screenshots");
  fs.mkdirSync(screenshotDir, { recursive: true });
  const outPath = path.join(screenshotDir, `screenshot_${Date.now()}.png`);

  const browser = await puppeteer.launch({
    executablePath: findBrowser(),
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(normalizedUrl, { waitUntil: "networkidle0", timeout: 30000 });
    await page.screenshot({ path: outPath });
    // Print ONLY the path — bot code depends on this
    console.log(outPath);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
