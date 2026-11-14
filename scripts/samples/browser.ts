/**
 * Launch Playwright's Chromium for the sample renderer. Tries the revision this Playwright
 * version expects first; if that is not installed, falls back to the newest Chromium build found
 * in the local Playwright browser cache (headless shell preferred). `SAMPLES_CHROMIUM=<path>`
 * overrides both. No network, no downloads.
 */
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser } from '@playwright/test';

/** Flags that keep rasterization stable run to run. */
const ARGS = ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb', '--hide-scrollbars', '--disable-gpu'];

function cacheDir(): string {
  if (process.env.PLAYWRIGHT_BROWSERS_PATH && process.env.PLAYWRIGHT_BROWSERS_PATH !== '0') return process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (process.platform === 'darwin') return join(homedir(), 'Library/Caches/ms-playwright');
  if (process.platform === 'win32') return join(process.env.LOCALAPPDATA ?? homedir(), 'ms-playwright');
  return join(homedir(), '.cache/ms-playwright');
}

const SHELL_EXES = [
  'chrome-headless-shell-mac-arm64/chrome-headless-shell',
  'chrome-headless-shell-mac-x64/chrome-headless-shell',
  'chrome-headless-shell-linux64/chrome-headless-shell',
  'chrome-headless-shell-win64/chrome-headless-shell.exe',
];
const FULL_EXES = [
  'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
  'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
  'chrome-linux64/chrome',
  'chrome-linux/chrome',
  'chrome-win64/chrome.exe',
  'chrome-win/chrome.exe',
];

/** Newest installed Chromium in the Playwright cache, headless shell first. */
function cachedChromium(): string | undefined {
  const dir = cacheDir();
  if (!existsSync(dir)) return undefined;
  const entries = readdirSync(dir);
  const pick = (prefix: string, exes: string[]): string | undefined => {
    const revs = entries
      .map((e) => e.match(new RegExp(`^${prefix}-(\\d+)$`)))
      .filter((m): m is RegExpMatchArray => !!m)
      .sort((a, b) => Number(b[1]) - Number(a[1]));
    for (const m of revs) for (const exe of exes) {
      const p = join(dir, m[0], exe);
      if (existsSync(p)) return p;
    }
    return undefined;
  };
  return pick('chromium_headless_shell', SHELL_EXES) ?? pick('chromium', FULL_EXES);
}

export interface Launched { browser: Browser; via: string }

export async function launchChromium(): Promise<Launched> {
  const override = process.env.SAMPLES_CHROMIUM;
  if (override) return { browser: await chromium.launch({ executablePath: override, args: ARGS }), via: `SAMPLES_CHROMIUM=${override}` };
  try {
    return { browser: await chromium.launch({ args: ARGS }), via: `@playwright/test default (${chromium.executablePath()})` };
  } catch (e) {
    const fallback = cachedChromium();
    if (!fallback) throw new Error(`No Chromium found. Run "npx playwright install chromium". Launch error: ${(e as Error).message.split('\n')[0]}`);
    return { browser: await chromium.launch({ executablePath: fallback, args: ARGS }), via: `cache fallback (${fallback})` };
  }
}
