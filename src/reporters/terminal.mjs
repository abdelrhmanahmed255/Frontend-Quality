/**
 * Formats audit findings for terminal output with ANSI colors.
 */
export function printTerminalReport(auditResult, options = {}) {
  const { project, summary, quickWins, issues } = auditResult;
  const isVerbose = options.verbose === true;

  const healthScore = Math.max(0, 100 - ((summary.p0 * 20) + (summary.p1 * 10) + (summary.p2 * 5) + (summary.p3 * 2)));
  const healthIcon = healthScore >= 80 ? "🟢" : healthScore >= 50 ? "🟡" : "🔴";

  console.log("\n=======================================================");
  console.log("       🩺 FRONTEND QUALITY AUDIT REPORT                ");
  console.log("=======================================================\n");

  console.log(`Project:   ${project.name} (${project.framework})`);
  console.log(`Audited:   ${new Date().toISOString().split("T")[0]}`);
  console.log(`Routes:    ${project.routesCount} detected`);
  console.log(`Issues:    ${summary.total} total`);
  console.log(`  - 🔴 P0 (Critical): ${summary.p0}`);
  console.log(`  - 🟠 P1 (High):     ${summary.p1}`);
  console.log(`  - 🟡 P2 (Medium):   ${summary.p2}`);
  console.log(`  - ⚪ P3 (Low):      ${summary.p3}`);
  console.log(`Health Score: ${healthScore}/100 ${healthIcon}\n`);

  if (quickWins && quickWins.length > 0) {
    console.log("⚡ QUICK WINS (High Impact, Safe to Resolve):");
    quickWins.forEach((win, idx) => {
      console.log(`  ${idx + 1}. ${win}`);
    });
    console.log("");
  }

  console.log("-------------------------------------------------------");
  console.log("DETAILED FINDINGS (Top Issues):");
  console.log("-------------------------------------------------------");

  const topIssues = isVerbose ? issues : issues.slice(0, 15);
  for (const issue of topIssues) {
    const icon = issue.severity === "P0" ? "🔴" : issue.severity === "P1" ? "🟠" : issue.severity === "P2" ? "🟡" : "⚪";
    console.log(`\n${icon} [${issue.severity}] ${issue.problem}`);
    if (issue.file) console.log(`   Location: ${issue.file}${issue.line ? `:${issue.line}` : ""}`);
    if (issue.recommendation) console.log(`   Fix:      ${issue.recommendation}`);
  }

  if (!isVerbose && issues.length > 15) {
    console.log(`\n... and ${issues.length - 15} more findings in full report.`);
  }

  console.log("\n=======================================================\n");
}
