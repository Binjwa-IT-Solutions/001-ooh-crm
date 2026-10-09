# Media Octus CRM — Python Chatbot Integration Guide

This document details the architectural design, implementation, configuration, and operation of the Python AI Chatbot integration into the existing Media Octus project.

---

## 1. Architecture Overview

The chatbot is integrated using a secure 3-tier gateway pattern. The browser/frontend never communicates directly with the Python AI service; instead, all interactions flow through the Media Octus Express backend.

```
┌─────────────────────────────────────────────────────────────┐
│                   Media Octus Frontend                      │
│                  Next.js 16 (Port 3000)                     │
│            [Floating AI Launcher & Chat Panel]              │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ HTTP Request (Bearer JWT / session)
                               │ (proxied via Next.js rewrite /api/*)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Media Octus Node.js Backend                 │
│                 Express 5 + TS (Port 5000)                  │
│       [chatbot.routes.ts -> controller -> service]          │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               │ Internal HTTP Request (Timeout Guarded)
                               │ POST /api/chat
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Python Chatbot AI Service                   │
│                   Flask (Port 8000)                         │
│            [app.py -> ask_employee_assistant]               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│            Existing Assistant Logic & Tools                 │
│        (MongoDB CRM Data, OpenRouter / DeepSeek AI)         │
└─────────────────────────────────────────────────────────────┘
```

### Key Architectural Tenets:
1. **Zero Direct Python Access from Browser**: Prevents exposing internal ports, secrets, or raw AI exceptions.
2. **Non-Invasive Integration**: The existing Media Octus CRM business logic, routes, and database schemas remain completely untouched.
3. **Session Persistence**: Sessions are isolated using unique `sessionId` identifiers, ensuring context is preserved across page navigation within a browser session.
4. **Resilient Error Isolation**: If the Python service experiences downtime or timeouts, the Node.js backend handles it gracefully with HTTP 503 / 504 and returns friendly error messages without crashing.

---

## 2. Frontend Implementation

### Location and Structure
The frontend components are located in:
`frontend/src/shared/chatbot/`
- `ChatbotWidget.tsx` — Main floating launcher and interactive chat overlay panel.
- `MarkdownRenderer.tsx` — Custom parser rendering Markdown text, bullet lists, numbered items, tables, and analytical chart images.
- `chatbot-api.ts` — API client handling communication with the Node.js backend.

### Mounting Point
The chatbot is mounted inside `frontend/src/app/layout.tsx` within the global `<AuthProvider>`:
```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          {children}
          <ChatbotWidget />
        </AuthProvider>
      </body>
    </html>
  );
}
```
Because it is mounted at the root layout level, it persists seamlessly across all CRM pages (`/dashboard`, `/leads`, `/campaigns`, `/attendance`, etc.) without re-mounting or losing conversation history.

### Floating Launcher (IMAGE 1 Specification)
- **Position**: Fixed at `bottom-6 right-6` (`z-50`).
- **Styling**: Media Octus theme branding (`#6E1D1D` crimson background, `#882424` hover state, smooth scale animations).
- **Badge/Pill**: "Ask Octus AI" with an active pulsing status indicator dot.
- **Accessibility**: ARIA labels and keyboard accessible.

### Chat Panel (IMAGE 2 Specification)
- **Dimensions**: Compact overlay panel (`w-[420px]`, `h-[600px]`, max viewport constrained, responsive on mobile).
- **Header**: Features Octus AI branding, online status dot, user CRM role badge, a conversation reset button (`RefreshCw`), and a close button (`X`).
- **Message List**: Supports user speech bubbles (crimson `#6E1D1D`) and AI assistant bubbles (clean card with markdown table rendering and chart downloads).
- **Starters**: Includes 4 quick-action chips for first-time or reset sessions ("Check my leave balance", "Who reports to me?", "Show recent activity logs", "What permissions does my role have?").
- **Typing Indicator**: Animated 3-dot pulse displaying "Octus AI is typing...".
- **Input Area**: Textarea with Enter-to-send (Shift+Enter for newline), loading spinner, and duplicate submission prevention.

---

## 3. Node.js Backend Implementation

### Dedicated Module
Located in `backend/src/modules/chatbot/`:
- `chatbot.validator.ts` — Zod schema validating incoming payloads (`message` length between 1 and 4000 characters, optional `sessionId`).
- `chatbot.service.ts` — Bridges to Python using `fetch` with `AbortSignal.timeout(60000)`. Sanitizes error responses and handles connection failures.
- `chatbot.controller.ts` — Receives Express requests, resolves user context from `req.ctx?.user` (if authenticated), and dispatches responses.
- `chatbot.routes.ts` — Registers routes with an `optionalAuth` middleware. If a valid JWT Bearer token is passed, user ID and CRM role are injected; if unauthenticated, the user proceeds as a guest without 401 errors.

### Route Mounting in `app.ts`
```ts
import chatbotRoutes from './modules/chatbot/chatbot.routes.js';
import { ChatbotController } from './modules/chatbot/chatbot.controller.js';
import { asyncHandler } from './core/http/asyncHandler.js';

app.use('/api/chatbot', chatbotRoutes);
app.get('/charts/:filename', asyncHandler(ChatbotController.getChart));
```

---

## 4. Python Chatbot Service Implementation

### Entry Point & Adaptations
Located in `chatbot/app.py`:
- **Server**: Flask threaded application.
- **Port Configuration**: Defaults to port `8000` (configurable via `PORT` or `PYTHON_CHATBOT_PORT`) to prevent conflicts with Node.js on port `5000`.
- **Session Memory**: Uses in-memory `Session` objects keyed by `sessionId` or `f"{user_id}_{role}"`.
- **Domain Restriction**: Native corporate CRM assistant prompt enforcing data tables and refusing off-domain queries (recipes, trivia, general chat).
- **Charts Serving**: Serves generated analytical charts at `/charts/<filename>` and embeds download links in the output.

---

## 5. API Endpoints

### 1. Send Message
- **URL**: `POST /api/chatbot/message` (or `POST /api/chatbot/chat`)
- **Headers**:
  ```http
  Content-Type: application/json
  Authorization: Bearer <jwt-token> (optional)
  ```
- **Request Body**:
  ```json
  {
    "message": "What is my leave balance?",
    "sessionId": "octus_abc123_1710000000"
  }
  ```
- **Response Body**:
  ```json
  {
    "status": "success",
    "reply": "Your current leave balance is 12 days.",
    "response": "Your current leave balance is 12 days.",
    "sessionId": "octus_abc123_1710000000",
    "role": "employee",
    "current_employee": null
  }
  ```

### 2. Reset Session
- **URL**: `POST /api/chatbot/reset`
- **Request Body**:
  ```json
  {
    "sessionId": "octus_abc123_1710000000"
  }
  ```
- **Response Body**:
  ```json
  {
    "status": "success",
    "message": "Session context reset successfully."
  }
  ```

### 3. Health Check
- **URL**: `GET /api/chatbot/health`
- **Response Body**:
  ```json
  {
    "status": "online",
    "service": "python-chatbot",
    "details": {
      "database": "MongoDB Connected",
      "primary_model": "gemini-3.5-flash-lite",
      "fallback_model": "qwen/qwen3.8-27b",
      "status": "online"
    }
  }
  ```

### 4. Chart Image Proxy
- **URL**: `GET /api/chatbot/charts/:filename` (or `GET /charts/:filename`)
- **Response**: Binary PNG stream (`image/png`) cached with `max-age=86400`.

---

## 6. Server Ports

| Service | Port | Environment Variable | Default Value |
| :--- | :--- | :--- | :--- |
| **Frontend (Next.js)** | 3000 | `PORT` | `3000` |
| **Backend (Express)** | 5000 | `PORT` | `5000` |
| **Python Chatbot (Flask)** | 8000 | `PORT` / `PYTHON_CHATBOT_PORT` | `8000` |

---

## 7. Environment Variables

### Backend (`backend/.env`)
```env
# Existing backend configurations...
PORT=5000
MONGO_URI=mongodb://localhost:27017/media-octus-crm
JWT_SECRET=super-secret-key-for-jwt-token-media-octus-crm-2026-xyz

# Python AI Chatbot Bridge
PYTHON_CHATBOT_URL=http://127.0.0.1:8000
PYTHON_CHATBOT_TIMEOUT_MS=60000
```

### Python Chatbot (`chatbot/.env`)
```env
# AI Models & Keys
GROQ_API_KEY=...
GEMINI_API_KEY=...
OPENROUTER_API_KEY=...
GEMINI_MODEL=gemini-3.5-flash-lite
DEEPSEEK_MODEL=deepseek/deepseek-chat

# Database
MONGO_URI=mongodb://localhost:27017/media-octus-crm

# Server Port
PORT=8000
```

### Frontend (`frontend/.env.local` - Optional)
```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```
*(In local development, left empty to let Next.js rewrite proxy all `/api/*` and `/charts/*` directly to `localhost:5000`)*.

---

## 8. Server Startup Commands

To run the complete system locally, open 3 terminal windows:

### Terminal 1: Python Chatbot Service
```powershell
cd 001-ooh-crm/chatbot
.\.venv\Scripts\python.exe app.py
```
*(Or on Linux/macOS: `source .venv/bin/activate && python app.py`)*

### Terminal 2: Node.js Backend Server
```powershell
cd 001-ooh-crm/backend
npm run dev
```

### Terminal 3: Media Octus Frontend
```powershell
cd 001-ooh-crm/frontend
npm run dev
```

---

## 9. Complete Request Flow

```
1. User types "Who is in my team?" and hits Enter or Send.
                │
                ▼
2. ChatbotWidget appends user message locally and triggers loading state.
                │
                ▼
3. Frontend issues HTTP POST to /api/chatbot/message (with sessionId & Bearer JWT).
                │
                ▼
4. Next.js rewrite proxy forwards /api/chatbot/message to Node.js backend (http://localhost:5000).
                │
                ▼
5. Express routes receive request -> optionalAuth validates JWT -> req.ctx.user is populated.
                │
                ▼
6. ChatbotController passes payload to ChatbotService.sendMessage().
                │
                ▼
7. ChatbotService makes HTTP POST to http://127.0.0.1:8000/api/chat with timeout protection.
                │
                ▼
8. Python Flask app receives request, retrieves user Session, and invokes ask_employee_assistant().
                │
                ▼
9. Assistant runs CRM tools against MongoDB (e.g. get_employee), formats response as a table.
                │
                ▼
10. Flask returns JSON { status: "success", reply: "...", sessionId: "..." }.
                │
                ▼
11. Node.js receives response, verifies status, and sends JSON back to frontend.
                │
                ▼
12. ChatbotWidget displays the formatted reply with Markdown tables, charts, and clears loading state.
```

---

## 10. Session Flow & Memory Handling

- A unique `sessionId` (`octus_<random>_<timestamp>`) is generated on the client and stored in `window.sessionStorage`.
- When the user chats, the `sessionId` is transmitted with every request.
- Python associates the `sessionId` with the user's active conversation history (`session.messages`).
- Navigating between pages within Media Octus does not reset the chat because `sessionStorage` keeps the session ID and cached messages intact.
- Clicking the "Reset" button (`RefreshCw`) in the chat header sends a `/api/chatbot/reset` request, which clears the assistant's memory buffer in Python and resets the client chat view.

---

## 11. Error Handling & Resilience Matrix

| Scenario | System Behavior | User Experience |
| :--- | :--- | :--- |
| **Python Service Down / Stopped** | Node.js fetch fails with `ECONNREFUSED`. Node.js catches error and returns HTTP 503 (`CHATBOT_UNAVAILABLE`). | UI displays: "AI assistant is temporarily unavailable. Please try again." with a **Retry** button. Node.js backend never crashes. |
| **Request Timeout (> 60s)** | Node.js `AbortSignal.timeout` triggers. Node.js returns HTTP 504 (`CHATBOT_TIMEOUT`). | UI displays timeout message and allows user to retry. |
| **Empty or Whitespace Message** | Node.js Zod schema rejects request with HTTP 400 (`VALIDATION_ERROR`). | Send button is disabled in UI; if bypassed, a validation error is returned without calling Python. |
| **Python Tool Exception** | Python `try/except` returns HTTP 500 JSON without exposing internal traceback. Node.js maps to HTTP 502. | UI informs user that an issue occurred and allows re-prompting. |
| **Invalid / Expired JWT Token** | `optionalAuth` middleware catches verify failure and defaults to guest session. | User can continue chatting as a general employee without authentication interruption. |

---

## 12. Production Deployment Considerations

1. **Python WSGI Server**:
   Replace Flask development server (`app.run`) with Gunicorn or Waitress in production:
   ```bash
   gunicorn -w 4 -b 127.0.0.1:8000 app:app
   ```
2. **Reverse Proxy & Firewall**:
   Ensure port 8000 is **not** exposed to the public internet. Only the Node.js backend should have internal network access to port 8000.
3. **Environment URLs**:
   In production, set:
   - `PYTHON_CHATBOT_URL=http://internal-chatbot-service:8000` in the backend environment.
   - `NEXT_PUBLIC_API_URL=https://api.crm.mediaoctus.com` in the frontend environment.
4. **Process Supervision**:
   Run both the Node.js backend and Python chatbot service under a process manager such as `pm2` or Docker containers with auto-restart policies.
