/**
 * Generates guidance and shell commands for changes that REQUIRE developer review:
 * - Unused dependencies (npm uninstall)
 * - Large asset compression
 * - Monster component decomposition
 */
export function generateApprovalGuidance(auditResult) {
  const { issues } = auditResult;
  const guidance = [];

  const unusedDeps = issues.filter(i => i.type === "production" && i.status === "Confirmed Unused");
  if (unusedDeps.length > 0) {
    const pkgNames = unusedDeps.map(d => d.name).join(" ");
    guidance.push({
      action: "Remove Confirmed Unused Dependencies",
      risk: "Medium",
      command: `npm uninstall ${pkgNames}`,
      explanation: `These packages are never imported in your project. Removing them saves disk space and installation time. Verify they are not needed dynamically before executing.`,
    });
  }

  const oversizedAssets = issues.filter(i => i.type === "oversized-asset");
  if (oversizedAssets.length > 0) {
    guidance.push({
      action: "Compress Oversized Media Assets",
      risk: "Low",
      items: oversizedAssets.map(a => `${a.file} (${a.sizeKB} KB)`),
      explanation: `Convert high-resolution assets to WebP/AVIF using sharp or an image compression pipeline.`,
    });
  }

  return guidance;
}
