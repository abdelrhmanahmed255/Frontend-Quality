/**
 * Generates a GitHub-flavored Markdown report of the audit results.
 * @param {object} auditResult
 * @returns {string}
 */
export function generateMarkdownReport(auditResult) {
  const { project, summary, quickWins, issues, routes } = auditResult;
  const dateStr = new Date().toISOString().split("T")[0];

  let md = `# 🩺 Frontend Quality Audit Report\n\n`;
  md += `**Project:** ${project.name}  \n`;
  md += `**Framework:** ${project.framework}  \n`;
  md += `**Audit Date:** ${dateStr}  \n\n`;

  md += `## 📊 Executive Summary\n\n`;
  md += `| Total Issues | 🔴 P0 Critical | 🟠 P1 High | 🟡 P2 Medium | ⚪ P3 Low |\n`;
  md += `|:---:|:---:|:---:|:---:|:---:|\n`;
  md += `| **${summary.total}** | **${summary.p0}** | **${summary.p1}** | **${summary.p2}** | **${summary.p3}** |\n\n`;

  if (quickWins && quickWins.length > 0) {
    md += `## ⚡ Quick Wins\n\n`;
    quickWins.forEach((win, idx) => {
      md += `${idx + 1}. **${win}**\n`;
    });
    md += `\n`;
  }

  if (routes && routes.length > 0) {
    md += `## 🗺️ Discovered Routes (${routes.length})\n\n`;
    md += `\`\`\`text\n${routes.slice(0, 20).join("\n")}${routes.length > 20 ? "\n..." : ""}\n\`\`\`\n\n`;
  }

  md += `## 🔍 Detailed Findings\n\n`;

  const categories = ["Code Quality", "Dependencies", "Assets", "Responsive", "Accessibility", "UX"];
  for (const cat of categories) {
    const catIssues = issues.filter(i => i.category === cat || i.type?.includes(cat.toLowerCase()));
    if (catIssues.length === 0) continue;

    md += `### ${cat} (${catIssues.length})\n\n`;
    md += `| Severity | Finding | Location | Recommended Action |\n`;
    md += `|:---:|:---|:---|:---|\n`;

    for (const issue of catIssues) {
      const loc = issue.file ? `\`${issue.file}${issue.line ? `:${issue.line}` : ""}\`` : "Project-wide";
      md += `| **${issue.severity}** | ${issue.problem} | ${loc} | ${issue.recommendation} |\n`;
    }
    md += `\n`;
  }

  md += `\n---\n*Report generated automatically by [Frontend Quality Auditor](https://github.com/abdelrhmanahmed255/Frontend-Quality)*\n`;
  return md;
}
