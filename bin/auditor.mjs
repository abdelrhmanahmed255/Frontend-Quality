#!/usr/bin/env node

import { resolve } from "node:path";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import {
  runFrontendAudit,
  printTerminalReport,
  generateMarkdownReport,
  formatJsonReport,
  applySafeFixes,
} from "../src/index.mjs";

const args = process.argv.slice(2);
const command = args[0] || "audit";

if (["--help", "-h", "help"].includes(command)) {
  console.log(`
Frontend Quality Auditor (CLI)

Usage:
  frontend-auditor audit [targetDir]      Audit project and display report
  frontend-auditor suggest [targetDir]    Audit and display actionable recommendations
  frontend-auditor fix [targetDir] --safe Automatically apply non-breaking safe fixes

Options:
  --format=markdown|json|terminal         Output format (default: terminal + markdown file)
  --output=<path>                         Custom path for generated report
  --help, -h                              Show this help message
`);
  process.exit(0);
}

const targetArg = args.find(a => !a.startsWith("-") && a !== command);
const targetDir = resolve(process.cwd(), targetArg || ".");

async function main() {
  try {
    const isFixMode = command === "fix";
    const auditResult = await runFrontendAudit(targetDir);

    // 1. Output Terminal Report
    printTerminalReport(auditResult);

    // 2. Generate Markdown Report file
    const reportsDir = resolve(targetDir, "audit-reports");
    if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });

    const mdReport = generateMarkdownReport(auditResult);
    const mdPath = resolve(reportsDir, "FRONTEND_AUDIT_REPORT.md");
    writeFileSync(mdPath, mdReport, "utf-8");
    console.log(`📄 Markdown report saved to: ${mdPath}`);

    // 3. Handle Safe Fix Mode
    if (isFixMode) {
      console.log("\n🛠️ Applying safe automated fixes...");
      const fixStats = applySafeFixes(auditResult.issues);
      console.log(`   ✓ Files modified:           ${fixStats.filesModified}`);
      console.log(`   ✓ Console logs removed:     ${fixStats.consoleLogsRemoved}`);
      console.log(`   ✓ Debugger breakpoints removed: ${fixStats.debuggersRemoved}`);
      console.log("\n✅ Safe fixes applied cleanly without breaking application logic.");
    }
  } catch (err) {
    console.error("Error during frontend audit:", err.message);
    process.exit(1);
  }
}

main();
