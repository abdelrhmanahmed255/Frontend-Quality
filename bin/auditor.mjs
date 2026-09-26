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
import { generateApprovalGuidance } from "../src/fixes/approval-required.mjs";

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

const formatArg = args.find(a => a.startsWith("--format="));
const format = formatArg ? formatArg.split("=")[1] : null;

const outputArg = args.find(a => a.startsWith("--output="));
const output = outputArg ? outputArg.split("=")[1] : null;

const isVerbose = args.includes("--verbose");

async function main() {
  try {
    const startTime = performance.now();
    const isFixMode = command === "fix";
    const auditResult = await runFrontendAudit(targetDir);

    const reportsDir = resolve(targetDir, "audit-reports");
    if (!existsSync(reportsDir)) mkdirSync(reportsDir, { recursive: true });

    if (format === "json") {
      const jsonReport = formatJsonReport(auditResult);
      const jsonPath = output ? resolve(process.cwd(), output) : resolve(reportsDir, "FRONTEND_AUDIT_REPORT.json");
      writeFileSync(jsonPath, jsonReport, "utf-8");
      console.log(jsonReport);
    } else if (format === "markdown") {
      const mdReport = generateMarkdownReport(auditResult);
      const mdPath = output ? resolve(process.cwd(), output) : resolve(reportsDir, "FRONTEND_AUDIT_REPORT.md");
      writeFileSync(mdPath, mdReport, "utf-8");
      console.log(`📄 Markdown report saved to: ${mdPath}`);
    } else {
      // 1. Output Terminal Report
      printTerminalReport(auditResult, { verbose: isVerbose });

      if (command === "suggest") {
        const guidance = generateApprovalGuidance(auditResult);
        if (guidance.length > 0) {
          console.log("\n💡 Actionable Recommendations (Requires Manual Approval/Action):");
          guidance.forEach(item => {
            console.log(`\n  👉 ${item.action} [Risk: ${item.risk}]`);
            console.log(`     ${item.explanation}`);
            if (item.command) {
              console.log(`     Run: ${item.command}`);
            }
            if (item.items) {
              item.items.forEach(i => console.log(`      - ${i}`));
            }
          });
        }
      }

      // 2. Generate Markdown Report file
      const mdReport = generateMarkdownReport(auditResult);
      const mdPath = output ? resolve(process.cwd(), output) : resolve(reportsDir, "FRONTEND_AUDIT_REPORT.md");
      writeFileSync(mdPath, mdReport, "utf-8");
      console.log(`📄 Markdown report saved to: ${mdPath}`);
    }

    // 3. Handle Safe Fix Mode
    if (isFixMode) {
      console.log("\n🛠️ Applying safe automated fixes...");
      const fixStats = applySafeFixes(auditResult.issues);
      console.log(`   ✓ Files modified:           ${fixStats.filesModified}`);
      console.log(`   ✓ Console logs removed:     ${fixStats.consoleLogsRemoved}`);
      console.log(`   ✓ Debugger breakpoints removed: ${fixStats.debuggersRemoved}`);
      console.log("\n✅ Safe fixes applied cleanly without breaking application logic.");
    }

    const endTime = performance.now();
    console.log(`\n⏱  Audit completed in ${((endTime - startTime) / 1000).toFixed(1)}s`);
  } catch (err) {
    console.error("Error during frontend audit:", err.message);
    process.exit(1);
  }
}

main();
