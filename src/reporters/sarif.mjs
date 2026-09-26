import { readFileSync } from "node:fs";

const TOOL_NAME = "Frontend Quality Auditor";
const TOOL_URI = "https://github.com/abdelrhmanahmed255/Frontend-Quality";

const LEVELS = { P0: "error", P1: "error", P2: "warning", P3: "note" };

function toolVersion() {
  try {
    return JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf-8")).version;
  } catch {
    return undefined;
  }
}

// Dependency findings use `type` for production/dev, and browser findings keep the check in `status`.
function ruleIdFor(issue) {
  if (issue.category === "Dependencies") return "unused-dependency";
  if (issue.type === "browser") return issue.status || "browser";
  return issue.type || "finding";
}

function locationFor(issue) {
  const file = issue.file || (issue.category === "Dependencies" ? "package.json" : null);
  if (!file) return null;
  const physicalLocation = { artifactLocation: { uri: file } };
  if (issue.line) physicalLocation.region = { startLine: issue.line };
  return { physicalLocation };
}

/**
 * Formats audit findings as SARIF 2.1.0, the format GitHub code scanning and many
 * editors understand. Findings without a file location (browser checks) are left out,
 * because code scanning rejects results that do not point at a file.
 * @param {object} auditResult
 * @returns {string}
 */
export function formatSarifReport(auditResult) {
  const rules = new Map();
  const results = [];

  for (const issue of auditResult.issues) {
    const location = locationFor(issue);
    if (!location) continue;

    const ruleId = ruleIdFor(issue);
    if (!rules.has(ruleId)) {
      rules.set(ruleId, {
        id: ruleId,
        shortDescription: { text: ruleId.replace(/-/g, " ") },
        help: { text: issue.recommendation || "" },
        properties: { category: issue.category },
      });
    }

    results.push({
      ruleId,
      level: LEVELS[issue.severity] || "note",
      message: { text: issue.problem || ruleId },
      locations: [location],
      properties: { severity: issue.severity, confidence: issue.confidence },
    });
  }

  const sarif = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: TOOL_NAME,
            informationUri: TOOL_URI,
            version: toolVersion(),
            rules: [...rules.values()],
          },
        },
        results,
      },
    ],
  };

  return JSON.stringify(sarif, null, 2);
}
