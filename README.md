# MCQHub — Engineering-Grade AI Assessment Studio & Examination Engine

**MCQHub** is an AI-augmented educational assessment platform designed with a clean, high-density, VS Code-grade developer aesthetic. It provides a compact, distraction-free environment optimized for both desktop and mobile viewports.

---

## 🚀 Key Architectural Highlights

### 1. Google Cloud Firestore Database Layer
User accounts, credential hashes, token IDs, active sessions, saved quizzes, and exam history are persisted natively in **Google Cloud Firestore (`firebase/firestore`)**:

```
mcqhub-724e3 (Cloud Firestore)
├── system/
│   └── heuristic                    # Live heuristic ping & round-trip latency probe
└── users/{username}                 # Document per user
    ├── userId                       # Unique user ID (e.g. usr_aryansdevstudios_...)
    ├── username                     # Clean username
    ├── displayName                  # User display name
    ├── passwordHash                 # Salted credential hash
    ├── createdAt                    # Account creation timestamp
    ├── lastLogin                    # Most recent login timestamp
    ├── sessions                     # Array of active & historical session tokens
    ├── quizzes                      # Saved assessments library
    └── history                      # Chronological exam attempts with full solutions
```

- **User Differentiation & Authentication:** Lightweight, non-intrusive registration and login system with session tokens (`tok_...`).
- **Session Auditing:** Every login records a unique token ID, timestamp, and client agent to `users/{username}`.
- **Heuristic Diagnostic Request:** Performs an automated round-trip write/read probe against `/system/heuristic` to verify database health and display live millisecond latency directly in the top bar and status bar.
- **Offline / Local Fallback:** When offline or while Firestore rules are being updated in the Firebase Console, local backup persistence seamlessly takes over without interrupting user workflows.

### 2. Firestore Security Rules (`firestore.rules`)
The project includes a ready-to-deploy `firestore.rules` specification:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Development / Test mode rules (wildcard read & write):
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```
> **Firebase Console Setup:** Go to **Firebase Console > Firestore Database > Rules**, paste the snippet above, and click **Publish**.

### 3. Cloudflare Workers Edge Gateway & Model Context Protocol (MCP) Server
A complete Cloudflare Workers implementation is located in [`cloudflare-worker/`](file:///d:/MCQHub/cloudflare-worker), and a local Stdio bridge in [`mcp-server/`](file:///d:/MCQHub/mcp-server):
- **10-Tool MCP Server:** Implements standard JSON-RPC 2.0 at `https://mcqhub.adsbackend01.workers.dev/api/mcp` and via `node mcp-server/index.mjs` for Claude Desktop, Cursor, Windsurf, and Antigravity.
- **Autonomous Quiz Generation & Public Sharing:** AI generates assessments via Gemini 3.5 Flash Lite, issues an immutable **5-digit PIN**, saves directly to Firestore, and produces an interactive public URL (`https://mcqhub.pages.dev/?share=30172`).
- **User Authentication & Personal Library Dispatch:** Supports logging in, registering, and dispatching quizzes directly into student personal libraries from AI chat.
- **AI Tutor Diagnostic Review:** Objective test feedback with LaTeX mathematical derivations and study recommendations.
- **Edge Datacenter Health:** `/api/heuristic` reports real-time Cloudflare datacenter colo (e.g., `BOM`, `LHR`) and Firestore millisecond latency.

### 4. Mathematical Typesetting via KaTeX
- Native support for inline math `$E = mc^2$` and block math `$$\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}$$`.
- Inline DOM replacement prevents button overflow in multiple-choice option layouts.

---

## 🛠 Project Structure

```
d:/MCQHub
├── cloudflare-worker/               # Cloudflare Workers backend & MCP gateway
│   ├── src/index.ts                 # Gemini proxy, heuristic & MCP JSON-RPC handlers
│   └── wrangler.toml                # Cloudflare Worker deployment configuration
├── firestore.rules                  # Google Cloud Firestore security rules
├── src/
│   ├── ai/
│   │   ├── genkit.ts                # Genkit runtime & round-robin key rotation
│   │   └── flows/
│   │       ├── generate-quiz-from-topic.ts   # Quiz synthesis flow
│   │       └── summarize-quiz-results.ts    # AI diagnostic evaluation flow
│   ├── app/
│   │   ├── globals.css              # VS Code-grade theme variables & styles
│   │   ├── layout.tsx               # Server Component root layout with body suppressHydrationWarning
│   │   └── page.tsx                 # Dynamic view orchestrator
│   ├── components/
│   │   ├── Providers.tsx            # Client providers & app shell
│   │   ├── auth/
│   │   │   └── UserAuthDialog.tsx   # Auth, token session history, & Firestore heuristic tester
│   │   ├── layout/
│   │   │   ├── Header.tsx           # IDE breadcrumb navigation & status pills
│   │   │   ├── StatusBar.tsx        # Signature VS Code 24px bottom status bar
│   │   │   └── ToastContainer.tsx   # Floating alert notifications
│   │   ├── views/
│   │   │   ├── HomeView.tsx         # Assessment Studio (AI generator)
│   │   │   ├── JsonEditorView.tsx   # JSON Manifest Studio & validator
│   │   │   ├── QuizView.tsx         # Interactive exam runner with timer & notes
│   │   │   ├── ResultsView.tsx      # Donut analytics & AI tutor feedback
│   │   │   ├── LibraryView.tsx      # Saved quizzes Firestore repository
│   │   │   └── HistoryView.tsx      # Chronological attempt audit log
│   │   ├── MarkdownRenderer.tsx     # KaTeX math & markdown renderer
│   │   └── icons.tsx                # Minimalist geometric logo
│   ├── context/
│   │   └── QuizProvider.tsx         # Central state engine & Firestore sync
│   └── lib/
│       ├── firebase.ts              # Firebase client singleton initialization (Firestore db)
│       ├── firestoreDb.ts           # Firestore DB CRUD, heuristic probe, & sessions manager
│       ├── actions.ts               # Next.js Server Actions (AI generation & tutor summary)
│       ├── types.ts                 # TypeScript domain interfaces
│       └── utils.ts                 # Classname merge utilities
├── .env.local                       # Gemini & Firebase credentials
├── package.json
└── tsconfig.json
```

---

## 🏃 Running the Application

### 1. Development Server
```powershell
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 2. Production Build
```powershell
npm run build
npm start
```
