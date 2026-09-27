import { existsSync } from "node:fs";
import { readdir, stat, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { blankStringsAndComments } from "../utils/safe-string-search.mjs";

export async function findSourceFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  try {
    const entries = await readdir(dir);
    await Promise.all(entries.map(async (entry) => {
      if (["node_modules", ".git", ".next", "dist", "build", "coverage"].includes(entry)) return;
      const full = join(dir, entry);
      try {
        const s = await stat(full);
        if (s.isDirectory()) {
          await findSourceFiles(full, files);
        } else if (/\.(jsx?|tsx?|mjs|cjs)$/.test(entry)) {
          files.push(full);
        }
      } catch {
        // skip
      }
    }));
  } catch {
    // skip
  }
  return files;
}

// Credential formats with a distinctive prefix. A match is almost always a real leak.
const SECRET_PATTERNS = [
  { name: "AWS access key", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: "GitHub token", re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/ },
  { name: "Stripe secret key", re: /\b[sr]k_live_[0-9a-zA-Z]{24,}\b/ },
  { name: "Slack token", re: /\bxox[abprs]-[0-9A-Za-z-]{10,}/ },
  { name: "OpenAI or Anthropic API key", re: /\bsk-(?:proj|ant)-[A-Za-z0-9_-]{20,}/ },
  { name: "private key", re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY( BLOCK)?-----/ },
];

// `apiKey = "..."`-style assignments with a long, key-like literal value.
const GENERIC_SECRET_RE = /\b[\w$]*(?:api[_-]?key|secret|access[_-]?token|auth[_-]?token|password)[\w$]*["']?\s*[:=]\s*["']([A-Za-z0-9_\-+/=.]{16,})["']/i;
const PLACEHOLDER_RE = /example|your|xxxx|placeholder|changeme|dummy|sample|redacted|\*{3}/i;

// Shows just enough of the value to find it without copying the secret into reports.
function maskSecret(value) {
  return `${value.slice(0, 4)}${"*".repeat(8)}`;
}

/**
 * Returns a finding for a hardcoded credential on this line, or null.
 * @param {string} lineText
 */
export function detectHardcodedSecret(lineText) {
  for (const { name, re } of SECRET_PATTERNS) {
    const match = lineText.match(re);
    if (match && !PLACEHOLDER_RE.test(match[0])) {
      return { severity: "P0", confidence: "High", kind: name, preview: maskSecret(match[0]) };
    }
  }
  const generic = lineText.match(GENERIC_SECRET_RE);
  if (generic && !PLACEHOLDER_RE.test(generic[1]) && /\d/.test(generic[1]) && /[A-Za-z]/.test(generic[1])) {
    return { severity: "P1", confidence: "Medium", kind: "credential-like value", preview: maskSecret(generic[1]) };
  }
  return null;
}

/**
 * Scans JavaScript and TypeScript source files for code hygiene smells.
 * @param {string} rootDir
 * @returns {Array<object>}
 */
export async function analyzeCodeQuality(rootDir = process.cwd(), options = {}) {
  const maxLines = options.maxComponentLines || 300;
  const sourceFiles = await findSourceFiles(rootDir);
  const findings = [];

  await Promise.all(sourceFiles.map(async (file) => {
    const relPath = relative(rootDir, file).replace(/\\/g, "/");
    let content = "";
    try {
      content = await readFile(file, "utf-8");
    } catch {
      return;
    }

    const lines = content.split("\n");

    // 1. Monster Component Check
    if (lines.length > maxLines) {
      findings.push({
        type: "monster-component",
        severity: "P2",
        file: relPath,
        line: 1,
        confidence: "High",
        problem: `File contains ${lines.length} lines of code.`,
        recommendation: `Consider breaking down this component into smaller subcomponents or extracting business logic into custom hooks.`,
      });
    }

    // Same text with string literals and comments replaced by spaces, so code patterns
    // are only matched in actual code (line numbers and columns stay aligned).
    const codeLines = blankStringsAndComments(content).split("\n");

    // Line-by-line inspection
    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const trimmed = lineText.trim();
      const code = (codeLines[idx] || "").trim();

      // Skip commented lines
      if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) return;

      // 2. console.log / console.debug detection (skip CLI entrypoints and reporters)
      const isCliOrReporter = relPath.startsWith("bin/") || relPath.includes("reporters/");
      if (!isCliOrReporter && /\bconsole\.(log|debug|info)\(/.test(code)) {
        findings.push({
          type: "console-log",
          severity: "P3",
          file: relPath,
          line: lineNum,
          confidence: "High",
          problem: `Active console logging: '${trimmed.substring(0, 60)}...'`,
          recommendation: `Remove debugging console statements before shipping to production to avoid performance and privacy leaks.`,
        });
      }

      // 3. debugger statements
      if (/^\s*debugger\s*;?\s*$/.test(code)) {
        findings.push({
          type: "debugger",
          severity: "P1",
          file: relPath,
          line: lineNum,
          confidence: "High",
          problem: `Active debugger statement detected.`,
          recommendation: `Remove 'debugger' breakpoint before production deployment.`,
        });
      }

      // Hardcoded credentials (API keys, tokens, private keys)
      const secret = detectHardcodedSecret(lineText);
      if (secret) {
        findings.push({
          type: "hardcoded-secret",
          severity: secret.severity,
          file: relPath,
          line: lineNum,
          confidence: secret.confidence,
          problem: `Possible hardcoded ${secret.kind} (${secret.preview}).`,
          recommendation: `Move the value to a server-side environment variable and rotate it, since anything in frontend code or git history is public.`,
        });
      }

      // 4. Hardcoded localhost URLs
      if (/https?:\/\/localhost:\d+/.test(trimmed)) {
        findings.push({
          type: "hardcoded-localhost",
          severity: "P1",
          file: relPath,
          line: lineNum,
          confidence: "High",
          problem: `Hardcoded localhost URL detected: '${trimmed.substring(0, 50)}'`,
          recommendation: `Extract local URLs to environment variables (e.g. process.env.NEXT_PUBLIC_API_URL).`,
        });
      }

      // 5. Empty Click Handlers
      if (/onClick=\{(\s*\(\)\s*=>\s*\{\s*\}|\s*\(\)\s*=>\s*undefined\s*)\}/.test(code)) {
        findings.push({
          type: "empty-handler",
          severity: "P3",
          file: relPath,
          line: lineNum,
          confidence: "Medium",
          problem: `Empty onClick handler detected.`,
          recommendation: `Provide a meaningful handler or disable the button if the feature is not yet implemented.`,
        });
      }
    });
  }));

  return findings;
}
