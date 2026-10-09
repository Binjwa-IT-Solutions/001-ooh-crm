// static/app.js - Media Octus CRM AI Assistant Frontend Controller

document.addEventListener("DOMContentLoaded", () => {
  // State
  let currentUser = null;
  let allUsers = [];

  // DOM Elements
  const userSelect = document.getElementById("user-select");
  const userNameEl = document.getElementById("user-name");
  const userDeptEl = document.getElementById("user-dept");
  const userAvatarEl = document.getElementById("user-avatar");
  const roleBadgeEl = document.getElementById("role-badge");
  const topbarUserEl = document.getElementById("topbar-user");
  const topbarRoleEl = document.getElementById("topbar-role");
  const toolsCountBadge = document.getElementById("tools-count-badge");
  const toolsListEl = document.getElementById("tools-list");
  const chatMessagesEl = document.getElementById("chat-messages");
  const welcomeHeroEl = document.getElementById("welcome-hero");
  const quickPromptsEl = document.getElementById("quick-prompts");
  const userInput = document.getElementById("user-input");
  const sendButton = document.getElementById("send-button");
  const typingIndicator = document.getElementById("typing-indicator");
  const btnNewChat = document.getElementById("btn-new-chat");
  const focusPill = document.getElementById("current-employee-pill");
  const focusNameEl = document.getElementById("focus-emp-name");

  // Role tailored quick prompts
  const ROLE_PROMPTS = {
    admin: [
      "Show all employees in tabular form",
      "Show recent system audit activity",
      "Show company finance summary",
      "List all sites and hoardings"
    ],
    manager: [
      "Who reports to me?",
      "Show active marketing campaigns",
      "Check pending leave requests for my team",
      "Show client quotations"
    ],
    hr: [
      "Show employee performance summary",
      "Show company pending leave requests",
      "Check leave balance of Sakshi",
      "Check attendance of Sana for today"
    ],
    finance: [
      "Show company finance summary",
      "What is the CTC of Sana?",
      "Show client quotations",
      "List all purchase orders"
    ],
    ops: [
      "Show sites and hoardings",
      "Show active marketing campaigns",
      "What are my tasks?",
      "List all vendor records"
    ],
    sales_agent: [
      "Show sales leads",
      "Show client quotations",
      "What are my tasks?",
      "Check my attendance for today"
    ],
    employee: [
      "Check my leave balance",
      "What are my tasks?",
      "Check my attendance for today",
      "Who is my manager?"
    ]
  };

  // 1. Fetch Users
  async function loadUsers() {
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.status === "success" && data.users.length > 0) {
        allUsers = data.users;
        userSelect.innerHTML = "";

        // Default to Admin or first user
        let defaultIdx = 0;
        allUsers.forEach((u, i) => {
          const opt = document.createElement("option");
          opt.value = u.id;
          opt.textContent = `${u.name} — ${formatRole(u.role)} (${u.department})`;
          userSelect.appendChild(opt);

          if (u.role === "admin" && defaultIdx === 0) {
            defaultIdx = i;
          }
        });

        userSelect.selectedIndex = defaultIdx;
        switchUser(allUsers[defaultIdx]);
      }
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  }

  function formatRole(role) {
    if (!role) return "Employee";
    return role.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase());
  }

  // 2. Switch User
  async function switchUser(user) {
    currentUser = user;
    userNameEl.textContent = user.name;
    userDeptEl.textContent = `${user.department} • ${user.designation || formatRole(user.role)}`;
    
    // Avatar initials
    const initials = user.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
    userAvatarEl.textContent = initials;

    // Badges
    roleBadgeEl.textContent = formatRole(user.role);
    topbarUserEl.textContent = user.name;
    topbarRoleEl.textContent = formatRole(user.role);

    // Fetch and render permitted tools
    loadTools(user.role);

    // Update Quick Prompts
    renderQuickPrompts(user.role);
  }

  // 3. Load Permitted Tools
  async function loadTools(role) {
    try {
      const res = await fetch(`/api/tools?role=${encodeURIComponent(role)}`);
      const data = await res.json();
      if (data.status === "success") {
        toolsCountBadge.textContent = data.count;
        toolsListEl.innerHTML = "";
        data.tools.forEach(t => {
          const item = document.createElement("div");
          item.className = "tool-item";
          item.textContent = t;
          toolsListEl.appendChild(item);
        });
      }
    } catch (err) {
      console.error("Failed to load tools:", err);
    }
  }

  // 4. Render Quick Prompts
  function renderQuickPrompts(role) {
    quickPromptsEl.innerHTML = "";
    const key = role.toLowerCase().replace(" ", "_");
    const prompts = ROLE_PROMPTS[key] || ROLE_PROMPTS["employee"];

    prompts.forEach(p => {
      const chip = document.createElement("button");
      chip.className = "prompt-chip";
      chip.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
        <span>${p}</span>
      `;
      chip.addEventListener("click", () => {
        userInput.value = p;
        sendMessage();
      });
      quickPromptsEl.appendChild(chip);
    });
  }

  // 5. Send Message
  async function sendMessage() {
    const text = userInput.value.trim();
    if (!text || !currentUser) return;

    // Hide welcome hero on first message
    if (welcomeHeroEl) {
      welcomeHeroEl.style.display = "none";
    }

    // Append User Message
    appendMessage("user", text, currentUser.name);
    userInput.value = "";
    userInput.style.height = "auto";
    sendButton.disabled = true;

    // Show Typing Indicator
    typingIndicator.style.display = "flex";
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          user_id: currentUser.id,
          role: currentUser.role,
          name: currentUser.name
        })
      });

      const data = await res.json();
      typingIndicator.style.display = "none";

      if (data.status === "success") {
        appendMessage("assistant", data.response, "Media Octus Assistant");
        
        // Focus pill
        if (data.current_employee) {
          focusPill.style.display = "flex";
          focusNameEl.textContent = data.current_employee;
        }
      } else {
        appendMessage("assistant", `⚠️ ${data.message || "An error occurred."}`, "System");
      }
    } catch (err) {
      typingIndicator.style.display = "none";
      appendMessage("assistant", "⚠️ Server connection failed. Please check backend status.", "System");
    } finally {
      sendButton.disabled = false;
      userInput.focus();
    }
  }

  // 6. Append Message to Thread
  function appendMessage(sender, rawContent, displayName) {
    const row = document.createElement("div");
    row.className = `message-row ${sender}-row`;

    const avatar = document.createElement("div");
    avatar.className = `msg-avatar ${sender}-av`;
    avatar.textContent = sender === "user" ? displayName[0].toUpperCase() : "AI";

    const box = document.createElement("div");
    box.className = "msg-content-box";

    const meta = document.createElement("div");
    meta.className = "msg-meta";
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    meta.innerHTML = `<span><strong>${displayName}</strong></span> <span>•</span> <span>${time}</span>`;

    const body = document.createElement("div");
    body.className = "msg-body";

    if (sender === "assistant") {
      // Parse markdown tables and text
      let html = marked.parse(rawContent);
      
      // Wrap all <table> elements in .table-wrapper for responsive horizontal scrolling
      html = html.replace(/<table>/g, '<div class="table-wrapper"><table>').replace(/<\/table>/g, '</table></div>');
      body.innerHTML = html;
    } else {
      body.textContent = rawContent;
    }

    box.appendChild(meta);
    box.appendChild(body);

    row.appendChild(avatar);
    row.appendChild(box);

    chatMessagesEl.appendChild(row);
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  // 7. Event Listeners
  userSelect.addEventListener("change", (e) => {
    const selected = allUsers.find(u => u.id === e.target.value);
    if (selected) {
      switchUser(selected);
      // Reset session on user switch
      fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: selected.id, role: selected.role, name: selected.name })
      });
      focusPill.style.display = "none";
      clearChatMessages();
    }
  });

  sendButton.addEventListener("click", sendMessage);

  userInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  userInput.addEventListener("input", () => {
    userInput.style.height = "auto";
    userInput.style.height = Math.min(userInput.scrollHeight, 140) + "px";
  });

  btnNewChat.addEventListener("click", async () => {
    if (!currentUser) return;
    try {
      await fetch("/api/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: currentUser.id,
          role: currentUser.role,
          name: currentUser.name
        })
      });
    } catch (e) {
      console.warn("Reset error:", e);
    }
    focusPill.style.display = "none";
    clearChatMessages();
  });

  function clearChatMessages() {
    chatMessagesEl.innerHTML = "";
    if (welcomeHeroEl) {
      welcomeHeroEl.style.display = "block";
      chatMessagesEl.appendChild(welcomeHeroEl);
    }
  }

  // Initialize
  loadUsers();
});
