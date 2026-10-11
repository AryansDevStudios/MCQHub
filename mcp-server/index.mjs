#!/usr/bin/env node

/**
 * MCQHub Model Context Protocol (MCP) Stdio Gateway
 * 
 * Provides standard JSON-RPC 2.0 stdio interface for:
 * - Claude Desktop (claude_desktop_config.json)
 * - Cursor IDE (.cursor/mcp.json)
 * - Windsurf IDE (mcp_config.json)
 * - Antigravity AI Coding Agent
 * 
 * Powered by MCQHub Edge Backend & Google Gemini 3.5 Flash Lite.
 */

import fs from 'node:fs';
import path from 'node:path';

// Automatically load workspace .env.local if present
function loadEnvFile() {
  const candidates = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), '..', '.env.local'),
  ];
  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eq = trimmed.indexOf('=');
          if (eq !== -1) {
            const k = trimmed.slice(0, eq).trim();
            const v = trimmed.slice(eq + 1).trim();
            if (!process.env[k]) {
              process.env[k] = v;
            }
          }
        }
      } catch {}
    }
  }
}
loadEnvFile();

const EDGE_MCP_URL = process.env.MCQHUB_API_URL || 'https://mcqhub.adsbackend01.workers.dev/api/mcp';
const AUTH_TOKEN = process.env.MCQHUB_AUTH_TOKEN || process.env.GEMINI_API_KEY || '';

function log(...args) {
  process.stderr.write(`[MCQHub-MCP] ${args.join(' ')}\n`);
}

// -------------------------------------------------------------
// Message Forwarding to Edge MCP Handler
// -------------------------------------------------------------
async function processRpcMessage(message) {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'MCQHub-MCP-Stdio/1.0.0',
    };
    if (AUTH_TOKEN) {
      headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
    }

    const response = await fetch(EDGE_MCP_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(message),
    });

    if (response.status === 204) {
      return null; // Notification acknowledged
    }

    if (!response.ok) {
      const errText = await response.text();
      return {
        jsonrpc: '2.0',
        id: message.id ?? null,
        error: {
          code: -32603,
          message: `MCQHub Edge Gateway returned status ${response.status}: ${errText}`,
        },
      };
    }

    return await response.json();
  } catch (networkErr) {
    return {
      jsonrpc: '2.0',
      id: message.id ?? null,
      error: {
        code: -32603,
        message: `Failed to connect to MCQHub Edge Gateway at ${EDGE_MCP_URL}: ${networkErr.message}`,
      },
    };
  }
}

function sendRpcResponse(response) {
  if (!response) return;
  const jsonString = JSON.stringify(response);
  process.stdout.write(jsonString + '\n');
}

function startStdioServer() {
  let buffer = '';
  let pendingRequests = 0;
  let isEnded = false;

  const checkExit = () => {
    if (isEnded && pendingRequests === 0) {
      process.stdin.pause();
    }
  };

  process.stdin.setEncoding('utf8');

  process.stdin.on('data', async (chunk) => {
    buffer += chunk;

    while (buffer.length > 0) {
      // 1. Content-Length framed JSON-RPC
      if (buffer.startsWith('Content-Length:')) {
        const headerEnd = buffer.indexOf('\r\n\r\n');
        if (headerEnd === -1) {
          break; // Wait for full header
        }
        const header = buffer.substring(0, headerEnd);
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (!match) {
          buffer = buffer.substring(headerEnd + 4);
          continue;
        }
        const contentLength = parseInt(match[1], 10);
        const bodyStart = headerEnd + 4;
        if (buffer.length < bodyStart + contentLength) {
          break; // Wait for full body
        }

        const bodyStr = buffer.substring(bodyStart, bodyStart + contentLength);
        buffer = buffer.substring(bodyStart + contentLength);

        pendingRequests++;
        (async () => {
          try {
            const parsed = JSON.parse(bodyStr);
            const resp = await processRpcMessage(parsed);
            sendRpcResponse(resp);
          } catch (err) {
            log(`Failed to parse framed message: ${err.message}`);
          } finally {
            pendingRequests--;
            checkExit();
          }
        })();
        continue;
      }

      // 2. Line-delimited JSON-RPC
      const newlineIndex = buffer.indexOf('\n');
      if (newlineIndex === -1) {
        break; // Wait for complete line
      }

      const line = buffer.substring(0, newlineIndex).trim();
      buffer = buffer.substring(newlineIndex + 1);

      if (!line) continue;

      pendingRequests++;
      (async () => {
        try {
          const parsed = JSON.parse(line);
          const resp = await processRpcMessage(parsed);
          sendRpcResponse(resp);
        } catch (parseErr) {
          log(`JSON Parse error for line: ${parseErr.message}`);
          sendRpcResponse({
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32700,
              message: `Parse error: ${parseErr.message}`,
            },
          });
        } finally {
          pendingRequests--;
          checkExit();
        }
      })();
    }
  });

  process.stdin.on('end', () => {
    isEnded = true;
    checkExit();
  });

  log(`MCQHub Stdio Bridge Active. Connected to: ${EDGE_MCP_URL}`);
}

async function main() {
  if (process.argv.includes('--version') || process.argv.includes('-v')) {
    process.stdout.write('MCQHub MCP Gateway v1.0.0\n');
    return;
  }

  if (process.argv.includes('--test') || process.argv.includes('-t')) {
    log(`Performing self-test against edge gateway: ${EDGE_MCP_URL}`);
    try {
      const res = await fetch(EDGE_MCP_URL);
      const data = await res.json();
      log(`Edge Gateway Status: ${data.status || 'online'} | Available Tools: ${data.toolsCount || (data.tools && data.tools.length)}`);
      process.stdout.write(JSON.stringify({ status: data.status, toolsCount: data.toolsCount, tools: (data.tools || []).map(t => t.name) }, null, 2) + '\n');
    } catch (err) {
      log(`Self-test error: ${err.message}`);
      process.exitCode = 1;
    }
    return;
  }

  startStdioServer();
}

main().catch((err) => {
  log(`Fatal error: ${err.message}`);
  process.exitCode = 1;
});
