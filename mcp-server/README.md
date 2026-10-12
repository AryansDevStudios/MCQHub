# 🚀 MCQHub Model Context Protocol (MCP) Server

The **MCQHub MCP Server** provides a standardized [Model Context Protocol](https://modelcontextprotocol.io/) gateway allowing AI coding assistants and LLMs (**Claude Desktop, Cursor, Windsurf, Antigravity, ChatGPT/Claude via MCP**) to interact directly with **MCQHub**.

---

## 🔐 Zero-Password Authentication (Personalized Secret Link)

Instead of exposing your username and password to an AI in chat prompts, MCQHub generates a **Personal Secret MCP Endpoint**:

```
https://mcqhub.adsbackend01.workers.dev/{your_secret_mcp_token}/mcp
```

### How to Get Your Personal Link:
1. Open [MCQHub](https://mcqhub.web.app) and sign in (or register).
2. Click your account in the top bar to open **Account & Settings**.
3. Select the **AI MCP** tab.
4. Copy your private endpoint or one-click copy the configuration for **Cursor**, **Claude Desktop**, or **Windsurf**.
5. You can **regenerate / rotate** your secret token at any time with a single click.

### Benefits of the Secret Link:
- **Zero Passwords in Chat**: You never have to type your password into an AI prompt.
- **Automatic Account Mapping**: Any quiz generated or imported by your AI is automatically credited to your username and saved directly into your personal MCQHub library.
- **Cross-Device Instant Sync**: Open MCQHub on your phone or PC, and the AI-generated quiz is already waiting in your **Library** (`/library`).

---

## 🌐 Public / Guest Endpoint (Open Use)

For unauthenticated quizzes, testing, or guest assessments:
- **Public URL**: `https://mcqhub.adsbackend01.workers.dev/api/mcp`
- Anyone can generate quizzes, query assessments by 5-digit PIN, evaluate results, and inspect edge datacenter status.
- **Registration**: User registration is exclusively done through the website UI and is excluded from the AI prompt interface for security.

---

## 🛠️ Configuration for AI Clients

### 1. Cursor IDE (`.cursor/mcp.json`)
Add the following to `.cursor/mcp.json` (replace with your private MCP URL from the website):

```json
{
  "mcpServers": {
    "mcqhub": {
      "command": "node",
      "args": ["d:/MCQHub/mcp-server/index.mjs"],
      "env": {
        "MCQHUB_API_URL": "https://mcqhub.adsbackend01.workers.dev/mcp_YOUR_SECRET_TOKEN/mcp"
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
        "MCQHUB_API_URL": "https://mcqhub.adsbackend01.workers.dev/mcp_YOUR_SECRET_TOKEN/mcp"
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
      "args": ["d:/MCQHub/mcp-server/index.mjs"],
      "env": {
        "MCQHUB_API_URL": "https://mcqhub.adsbackend01.workers.dev/mcp_YOUR_SECRET_TOKEN/mcp"
      }
    }
  }
}
```

### 4. Direct Remote HTTP
If connecting a cloud client or HTTP client directly:
- **Personal Auth Endpoint**: `https://mcqhub.adsbackend01.workers.dev/{secret_token}/mcp`
- **Public Guest Endpoint**: `https://mcqhub.adsbackend01.workers.dev/api/mcp`
- **Method**: `POST`
- **Headers**: `Content-Type: application/json`

---

## 🧰 Available MCP Tools

| Tool Name | Description | Key Arguments |
|:---|:---|:---|
| `generate_and_share_quiz` | Generates a quiz with Gemini 3.5 Flash Lite, assigns a 5-digit PIN, creates a public interactive link, and automatically saves to user library when authenticated. | `topic`, `questionCount`, `difficulty`, `quizStyle`, `context`, `authorUsername`, `saveToUserLibrary` |
| `create_custom_quiz` | Publishes handcrafted questions with a 5-digit PIN and public link without AI generation. | `title`, `questions`, `authorUsername`, `saveToUserLibrary` |
| `get_quiz_by_share_code` | Looks up any quiz on MCQHub by its 5-digit numeric share code. | `shareCode` (e.g. `"30172"`) |
| `get_user_library` | Fetches all saved quizzes from your personal library (defaults to authenticated account). | `username` (optional) |
| `save_quiz_to_library` | Imports a quiz by share code or payload into your library. | `shareCode` or `quiz`, `username` (optional) |
| `get_user_history` | Fetches quiz attempts, scores, and in-progress unsubmitted exam state. | `username` (optional) |
| `analyze_quiz_results` | Generates AI Tutor feedback with LaTeX formulas and study advice. | `quizTitle`, `score`, `total`, `questions`, `userAnswers` |
| `get_system_status` | Returns Cloudflare edge datacenter (colo), Firestore latency, and Gemini model. | *(none)* |
| `login_user` | Optional fallback credential login (only visible on public guest endpoints). | `username`, `password` |

---

## 💬 Example Natural Prompts

When connected via your secret MCP link, simply instruct your AI naturally:

- **Generate directly into your library:**
  > *"Generate a 5-question conceptual quiz on Class 10 Light Reflection and Refraction and give me the share PIN and public link."*
  *(The AI generates the test, assigns a 5-digit PIN like `30172`, and it's already in your library!)*

- **Inspect your library:**
  > *"What quizzes do I have saved in my MCQHub library?"*

- **Import an existing assessment:**
  > *"Save assessment PIN 30172 into my library."*

- **Diagnose performance:**
  > *"Review my recent exam results and give me study recommendations with LaTeX math."*
