import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { analyzeCodeQuality, detectHardcodedSecret } from "../src/analyzers/code-analyzer.mjs";

// Fake credentials are assembled at runtime so this file never contains a literal that
// looks like a real key (to secret scanners, or to the auditor's own self-audit).
const fake = {
  aws: "AKIA" + "Q7RZ3M2K9TXW4BLN",
  github: "ghp" + "_" + "a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8",
  stripe: "sk" + "_live_" + "4eC39HqLyjWDarjtT1zdp7dc",
  slack: "xoxb" + "-2048-1234567890-AbCdEfGhIj",
  openai: "sk-" + "proj-" + "Zk3v9QmW1xT7bN2cR5yL8pD4",
  privateKey: "-----BEGIN " + "RSA PRIVATE KEY-----",
};

test("detects provider credentials with a known prefix as P0", () => {
  for (const [name, value] of Object.entries(fake)) {
    const secret = detectHardcodedSecret(`const key = "${value}";`);
    assert.ok(secret, `expected ${name} to be detected`);
    assert.equal(secret.severity, "P0");
  }
});

test("detects credential-like assignments as P1 with medium confidence", () => {
  const secret = detectHardcodedSecret('const config = { apiKey: "' + "9f8e7d6c" + '5b4a39281706f5e4" };');
  assert.equal(secret.severity, "P1");
  assert.equal(secret.confidence, "Medium");
});

test("ignores placeholders, env lookups, and short or word-only values", () => {
  const safeLines = [
    'const apiKey = process.env.NEXT_PUBLIC_API_KEY;',
    'const apiKey = "your-api-key-goes-here";',
    'const password = "********";',
    'const secret = "abc123";',
    'const tokenLabel = "authenticationTokenName";',
    'const aws = "AKIAIOSFODNN7EXAMPLE";',
  ];
  for (const line of safeLines) {
    assert.equal(detectHardcodedSecret(line), null, line);
  }
});

test("analyzeCodeQuality reports secrets without copying them into the report", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "fqa-secrets-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "src"));
  writeFileSync(join(root, "src/api.js"), `export const client = createClient("${fake.stripe}");\n`);

  const findings = await analyzeCodeQuality(root);
  const secret = findings.find((f) => f.type === "hardcoded-secret");

  assert.ok(secret);
  assert.equal(secret.line, 1);
  assert.match(secret.problem, /Stripe secret key \(sk_l\*{8}\)/);
  assert.ok(!JSON.stringify(findings).includes(fake.stripe), "the full secret must not appear in findings");
});
