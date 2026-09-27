#!/usr/bin/env node

import { resolve } from "node:path";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import {
  runFrontendAudit,
  printTerminalReport,
  generateMarkdownReport,
  formatJsonReport,
  formatSarifReport,
  applySafeFixes,
} from "../src/index.mjs";
import { generateApprovalGuidance } from "../src/fixes/approval-required.mjs";
import { loadConfig } from "../src/config-loader.mjs";

const args = process.argv.slice(2);
const COMMANDS = ["audit", "suggest", "fix"];

// Returns the value of a --name=value option. Only the first "=" separates the name from the
// value, so values like --url=http://localhost:3000/?tab=a stay intact.
function optionValue(name) {
  const prefix = `--${name}=`;
  const arg = args.find(a => a.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : null;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

// The command is optional: `frontend-auditor ./my-app` audits ./my-app.
const positional = args.filter(a => !a.startsWith("-"));
const command = COMMANDS.includes(positional[0]) ? positional.shift() : "audit";

if (args.includes("--help") || args.includes("-h") || positional[0] === "help") {
  console.log(`
Frontend Quality Auditor (CLI)

Usage:
  frontend-auditor audit [targetDir]      Audit project and display report
  frontend-auditor suggest [targetDir]    Audit and display actionable recommendations
  frontend-auditor fix [targetDir] --safe Automatically apply non-breaking safe fixes

Options:
  --format=markdown|json|sarif|terminal   Output format (default: terminal + markdown file)
  --output=<path>                         Custom path for generated report
  --verbose                               Show every finding in the terminal report
  --url=<url>                             Also run the Playwright browser audit against a running app
  --strict[=<score>]                      Exit with code 1 if the health score is below <score> (default 100)
  --dry-run                               With fix: show what would change without writing files
  --help, -h                              Show this help message

CI:
  --fail-on=P0|P1|P2|P3                   Exit with code 1 if any finding is at this severity or worse
`);
  process.exit(0);
}

const targetArg = positional[0];
const targetDir = resolve(process.cwd(), targetArg || ".");
if (!existsSync(targetDir)) {
  fail(`Unknown command or directory '${targetArg}'. Run 'frontend-auditor --help' for usage.`);
}

const format = optionValue("format");
const output = optionValue("output");

const isVerbose = args.includes("--verbose");
const isDryRun = args.includes("--dry-run");

const strictValue = optionValue("strict");
const strictMode = args.includes("--strict") ? 100 : strictValue !== null ? Number(strictValue) : null;
if (strictMode !== null && !(strictMode >= 0 && strictMode <= 100)) {
  fail(`Invalid --strict value '${strictValue}'. Use a health score between 0 and 100.`);
}

const url = optionValue("url");

const SEVERITIES = ["P0", "P1", "P2", "P3"];
const failOnArg = args.find(a => a.startsWith("--fail-on="));
const failOn = failOnArg ? failOnArg.split("=")[1].toUpperCase() : null;
if (failOn !== null && !SEVERITIES.includes(failOn)) {
  console.error(`Invalid --fail-on value '${failOn}'. Use one of: ${SEVERITIES.join(", ")}.`);
  process.exit(1);
}

async function main() {
  try {
    const startTime = performance.now();
    const isFixMode = command === "fix";
    // With --format=json, stdout carries only the JSON report; status messages go to stderr.
    const log = format === "json" ? console.error : console.log;
    
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
    } else if (format === "sarif") {
      const sarifReport = formatSarifReport(auditResult);
      const sarifPath = output ? resolve(process.cwd(), output) : resolve(reportsDir, "FRONTEND_AUDIT_REPORT.sarif");
      writeFileSync(sarifPath, sarifReport, "utf-8");
      console.log(`📄 SARIF report saved to: ${sarifPath}`);
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
        log("\n🧪 Dry-run mode enabled. Simulating safe automated fixes...");
      } else {
        log("\n🛠️ Applying safe automated fixes...");
      }
      const importIssues = auditResult.issues.filter(i => i.type === "unused-import");
        const fixStats = applySafeFixes(auditResult.issues, importIssues, { dryRun: isDryRun, rootDir: targetDir });
        log(`   ✓ Files modified:           ${fixStats.filesModified}`);
        log(`   ✓ Console logs removed:     ${fixStats.consoleLogsRemoved}`);
        log(`   ✓ Debugger breakpoints removed: ${fixStats.debuggersRemoved}`);
        log(`   ✓ Unused imports removed:   ${fixStats.importsRemoved || 0}`);
      if (isDryRun) {
        log("\n✅ Dry-run complete. No files were modified.");
      } else {
        log("\n✅ Safe fixes applied cleanly without breaking application logic.");
      }
    }

    const endTime = performance.now();
    log(`\n⏱  Audit completed in ${((endTime - startTime) / 1000).toFixed(1)}s`);

    // 4. CI/CD Strict Mode evaluation
    if (strictMode !== null) {
      const summary = auditResult.summary;
      const healthScore = Math.max(0, 100 - ((summary.p0 * 20) + (summary.p1 * 10) + (summary.p2 * 5) + (summary.p3 * 2)));
      if (healthScore < strictMode) {
        console.error(`\n❌ CI/CD Check Failed: Health score (${healthScore}/100) is below strict threshold (${strictMode}).`);
        process.exit(1);
      } else {
        log(`\n✅ CI/CD Check Passed: Health score (${healthScore}/100) meets strict threshold (${strictMode}).`);
      }
    }

    // 5. Severity gate: fail when any finding is at or above the requested severity
    if (failOn !== null) {
      const maxRank = SEVERITIES.indexOf(failOn);
      const blocking = auditResult.issues.filter(i => SEVERITIES.indexOf(i.severity) !== -1 && SEVERITIES.indexOf(i.severity) <= maxRank);
      if (blocking.length > 0) {
        const counts = SEVERITIES.slice(0, maxRank + 1)
          .map(s => `${blocking.filter(i => i.severity === s).length} ${s}`)
          .join(", ");
        console.error(`\n❌ Severity gate failed: ${blocking.length} finding(s) at ${failOn} or worse (${counts}).`);
        process.exit(1);
      }
    }
  } catch (err) {
    console.error("Error during frontend audit:", err.message);
    process.exit(1);
  }
}

main();
