/**
 * Formats audit findings into structured JSON for CI/CD and tooling.
 */
export function formatJsonReport(auditResult) {
  return JSON.stringify(
    {
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      ...auditResult,
    },
    null,
    2
  );
}
