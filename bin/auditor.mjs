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
import { loadConfig } from "../src/config-loader.mjs";

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
const isDryRun = args.includes("--dry-run");

    const strictArg = args.find(a => a.startsWith("--strict="));
const strictMode = args.includes("--strict") ? 100 : strictArg ? parseInt(strictArg.split("=")[1], 10) : null;

const urlArg = args.find(a => a.startsWith("--url="));
const url = urlArg ? urlArg.split("=")[1] : null;

async function main() {
  try {
    const startTime = performance.now();
    const isFixMode = command === "fix";
    
    // Start spinner
    const spinnerChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    let spinIdx = 0;
    let auditResult;
    
    if (process.stdout.isTTY && format !== "json") {
      const spinInterval = setInterval(() => {
        process.stdout.write(`\r\x1b[36m${spinnerChars[spinIdx]}\x1b[0m Auditing project ${targetArg || "."}...`);
        spinIdx = (spinIdx + 1) % spinnerChars.length;
      }, 80);

      auditResult = await runFrontendAudit(targetDir, { url });
      
      clearInterval(spinInterval);
      process.stdout.write("\r\x1b[K"); // Clear the line
    } else {
      auditResult = await runFrontendAudit(targetDir, { url });
    }

    const { reporting } = await loadConfig(targetDir);
    const reportsDir = resolve(targetDir, reporting.outputDir || "audit-reports");
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
      if (isDryRun) {
        console.log("\n🧪 Dry-run mode enabled. Simulating safe automated fixes...");
      } else {
        console.log("\n🛠️ Applying safe automated fixes...");
      }
      const importIssues = auditResult.issues.filter(i => i.type === "unused-import");
      const fixStats = applySafeFixes(auditResult.issues, importIssues, { dryRun: isDryRun });
      console.log(`   ✓ Files modified:           ${fixStats.filesModified}`);
      console.log(`   ✓ Console logs removed:     ${fixStats.consoleLogsRemoved}`);
      console.log(`   ✓ Debugger breakpoints removed: ${fixStats.debuggersRemoved}`);
      console.log(`   ✓ Unused imports removed:   ${fixStats.importsRemoved || 0}`);
      if (isDryRun) {
        console.log("\n✅ Dry-run complete. No files were modified.");
      } else {
        console.log("\n✅ Safe fixes applied cleanly without breaking application logic.");
      }
    }

    const endTime = performance.now();
    console.log(`\n⏱  Audit completed in ${((endTime - startTime) / 1000).toFixed(1)}s`);

    // 4. CI/CD Strict Mode evaluation
    if (strictMode !== null) {
      const summary = auditResult.summary;
      const healthScore = Math.max(0, 100 - ((summary.p0 * 20) + (summary.p1 * 10) + (summary.p2 * 5) + (summary.p3 * 2)));
      if (healthScore < strictMode) {
        console.error(`\n❌ CI/CD Check Failed: Health score (${healthScore}/100) is below strict threshold (${strictMode}).`);
        process.exit(1);
      } else {
        console.log(`\n✅ CI/CD Check Passed: Health score (${healthScore}/100) meets strict threshold (${strictMode}).`);
      }
    }
  } catch (err) {
    console.error("Error during frontend audit:", err.message);
    process.exit(1);
  }
}

main();
