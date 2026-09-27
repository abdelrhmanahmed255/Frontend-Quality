#!/usr/bin/env node
import { createInterface } from "node:readline";
import { runAudit } from "../src/index.mjs";
import { applySafeFixes } from "../src/fixes/safe-fixes.mjs";
import { loadConfig } from "../src/config-loader.mjs";
import { join } from "node:path";

// A zero-dependency implementation of the Model Context Protocol (MCP) over stdio.
// This allows AI models (Claude Desktop, Cursor, Gemini) to natively call the auditor.

const rl = createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

const SERVER_NAME = "frontend-quality-auditor";
const SERVER_VERSION = "2.0.2";

function sendResponse(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}

function sendError(id, code, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");
}

async function handleRequest(request) {
  const { method, params, id } = request;

  try {
    if (method === "initialize") {
      return sendResponse(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
      });
    }

    if (method === "tools/list") {
      return sendResponse(id, {
        tools: [
          {
            name: "audit_frontend",
            description: "Run a frontend quality audit on a specified directory to find code smells, unused imports/deps, and asset issues.",
            inputSchema: {
              type: "object",
              properties: {
                targetDir: { type: "string", description: "Absolute path to the directory to audit." }
              },
              required: ["targetDir"]
            }
          },
          {
            name: "fix_frontend",
            description: "Automatically fix safe frontend issues like leftover console.log, debugger statements, and unused imports.",
            inputSchema: {
              type: "object",
              properties: {
                targetDir: { type: "string", description: "Absolute path to the directory to fix." }
              },
              required: ["targetDir"]
            }
          }
        ]
      });
    }

    if (method === "tools/call") {
      const toolName = params.name;
      const targetDir = params.arguments?.targetDir;

      if (!targetDir) {
        return sendError(id, -32602, "targetDir is required");
      }

      const config = await loadConfig(targetDir);

      if (toolName === "audit_frontend") {
        const result = await runAudit(targetDir, config);
        
        let report = `Frontend Audit Summary:\n`;
        report += `Health Score: ${result.summary.healthScore}/100\n`;
        report += `Issues found: ${result.summary.total} (P0: ${result.summary.p0}, P1: ${result.summary.p1}, P2: ${result.summary.p2}, P3: ${result.summary.p3})\n\n`;
        
        if (result.quickWins.length > 0) {
            report += `Quick Wins:\n- ${result.quickWins.join("\n- ")}\n\n`;
        }

        if (result.issues.length > 0) {
            report += `Top Issues:\n`;
            for (const issue of result.issues.slice(0, 10)) {
                report += `[${issue.severity}] ${issue.file}:${issue.line || ''} - ${issue.problem}\n`;
            }
            if (result.issues.length > 10) report += `...and ${result.issues.length - 10} more.\n`;
        }

        return sendResponse(id, {
          content: [{ type: "text", text: report }],
          isError: false,
        });
      }

      if (toolName === "fix_frontend") {
        const result = await runAudit(targetDir, config);
        const importIssues = result.issues.filter(i => i.type === "unused-import");
        
        const stats = applySafeFixes(result.issues, importIssues, { dryRun: false, rootDir: targetDir });
        
        let report = `Fixes Applied Successfully:\n`;
        report += `- Files modified: ${stats.filesModified}\n`;
        report += `- Console logs removed: ${stats.consoleLogsRemoved}\n`;
        report += `- Debuggers removed: ${stats.debuggersRemoved}\n`;
        report += `- Unused imports removed: ${stats.importsRemoved || 0}\n`;

        return sendResponse(id, {
          content: [{ type: "text", text: report }],
          isError: false,
        });
      }

      return sendError(id, -32601, `Unknown tool: ${toolName}`);
    }

    if (method === "ping") {
       return sendResponse(id, {});
    }

    // Ignore notifications (no id)
    if (id !== undefined) {
       sendError(id, -32601, `Method not found: ${method}`);
    }
  } catch (error) {
    if (id !== undefined) {
      sendError(id, -32000, error.message);
    }
  }
}

rl.on("line", async (line) => {
  if (!line.trim()) return;
  try {
    const request = JSON.parse(line);
    await handleRequest(request);
  } catch (e) {
    // Ignore invalid JSON per standard, or log it to stderr
    console.error("Invalid JSON:", e.message);
  }
});
