# 🚀 MCQHub Model Context Protocol (MCP) Server

The **MCQHub MCP Server** provides a standardized [Model Context Protocol](https://modelcontextprotocol.io/) gateway allowing AI coding assistants and LLMs (**Claude Desktop, Cursor, Windsurf, Antigravity, ChatGPT/Claude via MCP**) to interact directly with **MCQHub**.

Any connected AI agent can:
- **Generate & Share Quizzes**: Generate exam-grade multiple-choice assessments with Gemini 3.5 Flash Lite, complete with KaTeX math (`$E=mc^2$`), step-by-step explanations, an immutable **5-digit share PIN** (e.g., `30172`), and an interactive public URL (`https://mcqhub.pages.dev/?share=30172`).
- **Authenticate Users**: Log in or register user accounts directly from chat.
- **Manage User Libraries**: Dispatch quizzes directly into personal user libraries or retrieve saved quizzes.
- **Track Learning History**: View past scores, completed attempts, and resume unsubmitted quizzes.
- **AI Tutor Assessment Review**: Run diagnostic evaluations with Markdown and LaTeX feedback.
- **Edge Diagnostic Health**: Check real-time Cloudflare edge datacenter status, latency, and Firestore health.

---

## ⚡ Architecture & Dual Transport

MCQHub provides two seamless ways to connect:

1. **Remote Edge HTTP MCP Endpoint (Cloudflare Worker)**
   - **URL**: `https://mcqhub.adsbackend01.workers.dev/api/mcp`
   - Supports standard HTTP POST JSON-RPC 2.0 (`initialize`, `ping`, `tools/list`, `tools/call`).
   - Supports GET for live health and capabilities inspection.
   - Zero installation required.

2. **Local Stdio MCP Bridge (Node.js)**
   - **Script**: `mcp-server/index.mjs`
   - Zero external npm dependencies.
   - Works with all standard MCP desktop clients (Claude Desktop, Cursor, Windsurf, Antigravity).

---

## 🛠️ Configuration for AI Clients

### 1. Cursor IDE (`.cursor/mcp.json`)
Add the following to `.cursor/mcp.json` in your workspace or global Cursor settings:

```json
{
  "mcpServers": {
    "mcqhub": {
      "command": "node",
      "args": ["d:/MCQHub/mcp-server/index.mjs"],
      "env": {
        "MCQHUB_API_URL": "https://mcqhub.adsbackend01.workers.dev/api/mcp"
      }
    }
  }
}
```

### 2. Claude Desktop (`claude_desktop_config.json`)
Open `%APPDATA%\Claude\claude_desktop_config.json` (Windows) or `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "mcqhub": {
      "command": "node",
      "args": ["d:/MCQHub/mcp-server/index.mjs"],
      "env": {
        "MCQHUB_API_URL": "https://mcqhub.adsbackend01.workers.dev/api/mcp"
      }
    }
  }
}
```

### 3. Windsurf IDE (`mcp_config.json`)
In `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "mcqhub": {
      "command": "node",
      "args": ["d:/MCQHub/mcp-server/index.mjs"]
    }
  }
}
```

### 4. Direct HTTP / Remote Client
If your MCP client supports SSE or HTTP JSON-RPC 2.0 endpoints:
- **Endpoint**: `https://mcqhub.adsbackend01.workers.dev/api/mcp`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`

---

## 🧰 Available MCP Tools (10 Total)

| Tool Name | Description | Key Arguments |
|:---|:---|:---|
| `generate_and_share_quiz` | Generates a quiz with Gemini 3.5 Flash Lite, saves it with a 5-digit PIN, creates a public interactive link, and optionally saves to user library. | `topic`, `questionCount`, `difficulty`, `quizStyle`, `context`, `authorUsername`, `saveToUserLibrary` |
| `create_custom_quiz` | Publishes handcrafted questions with a 5-digit PIN and public link without AI generation. | `title`, `questions`, `authorUsername`, `saveToUserLibrary` |
| `get_quiz_by_share_code` | Looks up any quiz on MCQHub by its 5-digit numeric share code. | `shareCode` (e.g. `"30172"`) |
| `login_user` | Authenticates an existing user account and returns profile credentials. | `username`, `password` |
| `register_user` | Registers a new student account on the Firestore database. | `username`, `password`, `displayName` |
| `get_user_library` | Fetches all saved quizzes from a student's personal library. | `username` |
| `save_quiz_to_library` | Imports a quiz by share code or payload into a user's library. | `username`, `shareCode` or `quiz` |
| `get_user_history` | Fetches quiz attempts, scores, and in-progress unsubmitted exam state. | `username` |
| `analyze_quiz_results` | Generates AI Tutor feedback with LaTeX formulas and study advice. | `quizTitle`, `score`, `total`, `questions`, `userAnswers` |
| `get_system_status` | Returns Cloudflare edge datacenter, Firestore ping latency, and Gemini model. | *(none)* |

---

## 💬 Example AI Prompts

Once configured, you can instruct your AI assistant naturally:

- **Generate & Share:**
  > *"Generate a 5-question conceptual quiz on Class 10 Light Reflection and Refraction using MCQHub, give me the 5-digit share PIN, and give me the direct public link to attempt it."*

- **Save to User Library:**
  > *"Log me in as `mcp_test_user` and generate a Hard problem-solving quiz on Calculus Integrals. Save it directly to my library so I can open it on my phone."*

- **Import Quiz:**
  > *"Import the quiz with share PIN 30172 into my account library."*

- **Review Results:**
  > *"Analyze my performance on the Optics test where I scored 2/3. Use LaTeX for any formulas."*

---

## 🧪 Testing the Bridge Locally

Run the self-test flag to confirm connectivity to the edge Cloudflare Worker:

```bash
node mcp-server/index.mjs --test
```

Output:
```json
{
  "status": "online",
  "toolsCount": 10,
  "tools": [
    "generate_and_share_quiz",
    "create_custom_quiz",
    "get_quiz_by_share_code",
    "login_user",
    "register_user",
    "get_user_library",
    "save_quiz_to_library",
    "get_user_history",
    "analyze_quiz_results",
    "get_system_status"
  ]
}
```
