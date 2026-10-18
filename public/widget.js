(function () {
  "use strict";

  // Prevent multiple initializations
  if (window.__embedai_widget_loaded__) return;
  window.__embedai_widget_loaded__ = true;

  // 1. Locate script and configuration
  const currentScript =
    document.currentScript ||
    document.querySelector("script[data-chatbot-id]");

  if (!currentScript) {
    console.error("[EmbedAI] Unable to find <script data-chatbot-id=\"...\"> tag.");
    return;
  }

  const chatbotId = currentScript.getAttribute("data-chatbot-id");
  if (!chatbotId) {
    console.error("[EmbedAI] Missing data-chatbot-id attribute on script tag.");
    return;
  }

  // Derive base URL dynamically:
  // 1. Check explicit data-api-url or data-base-url attribute
  // 2. Derive from the script's own src URL (works in production Vercel/CDN)
  // 3. Fallback to current window origin
  let baseUrl = "";
  const explicitUrl =
    currentScript.getAttribute("data-api-url") ||
    currentScript.getAttribute("data-base-url");

  if (explicitUrl) {
    baseUrl = explicitUrl.replace(/\/$/, "");
  } else {
    try {
      const scriptSrc = currentScript.src || currentScript.getAttribute("src");
      if (scriptSrc && (scriptSrc.startsWith("http://") || scriptSrc.startsWith("https://"))) {
        baseUrl = new URL(scriptSrc).origin;
      } else if (scriptSrc && scriptSrc.startsWith("//")) {
        baseUrl = window.location.protocol + scriptSrc.split("/")[2];
      } else {
        baseUrl = window.location.origin;
      }
    } catch {
      baseUrl = window.location.origin;
    }
  }

  // Session storage keys
  const SESSION_KEY = `embedai_session_${chatbotId}`;

  // Simple Markdown parser for formatting bold, code, lists, linebreaks
  function renderMarkdown(raw) {
    if (!raw) return "";
    let html = raw
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Code blocks ```code```
    html = html.replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>");
    // Inline code `code`
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
    // Bold **text**
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    // Italic *text*
    html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    // Bullet lists - item
    html = html.replace(/^\s*-\s+(.*)$/gm, "<li>$1</li>");
    html = html.replace(/(<li>[\s\S]*?<\/li>)/g, "<ul>$1</ul>");
    // Clean redundant nested ul
    html = html.replace(/<\/ul>\s*<ul>/g, "");
    // Line breaks
    html = html.replace(/\n/g, "<br>");

    return html;
  }

  // Initialize widget
  async function initWidget() {
    let config = {
      id: chatbotId,
      name: "Assistant",
      welcomeMessage: "Hi there! How can I help you today?",
      theme: {
        primaryColor: "#2563eb",
        position: "bottom-right",
        headerTitle: "Assistant",
      },
    };

    try {
      const res = await fetch(`${baseUrl}/api/widget/${chatbotId}`);
      if (res.ok) {
        config = await res.json();
      }
    } catch (err) {
      console.warn("[EmbedAI] Using fallback configuration:", err);
    }

    const primaryColor = config.theme?.primaryColor || "#2563eb";
    const isBottomLeft = config.theme?.position === "bottom-left";
    const headerTitle = config.theme?.headerTitle || config.name || "Assistant";
    const welcomeMessage = config.welcomeMessage || "Hi! How can I help you today?";

    // 2. Create Shadow Root
    const container = document.createElement("div");
    container.id = "embedai-widget-container";
    document.body.appendChild(container);

    const shadow = container.attachShadow({ mode: "open" });

    // 3. Inject CSS and Markup
    shadow.innerHTML = `
      <style>
        :host {
          all: initial;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 14px;
          line-height: 1.5;
          color: #1f2937;
          -webkit-font-smoothing: antialiased;
        }

        * {
          box-sizing: border-box;
        }

        /* Launcher Bubble */
        .ea-bubble {
          position: fixed;
          bottom: 24px;
          ${isBottomLeft ? "left: 24px;" : "right: 24px;"}
          width: 58px;
          height: 58px;
          border-radius: 50%;
          background: ${primaryColor};
          color: #ffffff;
          box-shadow: 0 4px 18px rgba(0, 0, 0, 0.22);
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease;
          z-index: 2147483647;
          border: none;
          outline: none;
          padding: 0;
        }

        .ea-bubble:hover {
          transform: scale(1.08);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
        }

        .ea-bubble:active {
          transform: scale(0.95);
        }

        .ea-bubble svg {
          width: 26px;
          height: 26px;
          fill: currentColor;
          transition: transform 0.2s ease, opacity 0.2s ease;
        }

        .ea-bubble .ea-icon-close {
          display: none;
        }

        .ea-bubble.ea-open .ea-icon-chat {
          display: none;
        }

        .ea-bubble.ea-open .ea-icon-close {
          display: block;
        }

        /* Chat Panel */
        .ea-panel {
          position: fixed;
          bottom: 96px;
          ${isBottomLeft ? "left: 24px;" : "right: 24px;"}
          width: 380px;
          height: 560px;
          max-width: calc(100vw - 32px);
          max-height: calc(100vh - 120px);
          background: #ffffff;
          border-radius: 20px;
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.16), 0 2px 10px rgba(0, 0, 0, 0.08);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          z-index: 2147483646;
          border: 1px solid rgba(0, 0, 0, 0.08);
          opacity: 0;
          visibility: hidden;
          transform: translateY(18px) scale(0.96);
          transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.22s;
        }

        .ea-panel.ea-visible {
          opacity: 1;
          visibility: visible;
          transform: translateY(0) scale(1);
        }

        /* Mobile full screen */
        @media (max-width: 480px) {
          .ea-panel {
            top: 0;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            max-width: 100vw !important;
            max-height: 100vh !important;
            border-radius: 0 !important;
            border: none !important;
          }
          .ea-bubble {
            bottom: 16px;
            ${isBottomLeft ? "left: 16px;" : "right: 16px;"}
          }
        }

        /* Header */
        .ea-header {
          background: ${primaryColor};
          color: #ffffff;
          padding: 16px 20px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .ea-header-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ea-avatar {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
          font-weight: 600;
          font-size: 15px;
          flex-shrink: 0;
        }

        .ea-title-wrap {
          display: flex;
          flex-direction: column;
        }

        .ea-title {
          font-weight: 600;
          font-size: 15px;
          line-height: 1.2;
          color: #ffffff;
        }

        .ea-status {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.85);
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 2px;
        }

        .ea-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #10b981;
          display: inline-block;
        }

        .ea-header-actions {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ea-btn-icon {
          background: transparent;
          border: none;
          color: #ffffff;
          cursor: pointer;
          opacity: 0.85;
          padding: 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.15s, background-color 0.15s;
        }

        .ea-btn-icon:hover {
          opacity: 1;
          background: rgba(255, 255, 255, 0.15);
        }

        /* Message list */
        .ea-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          background: #f9fafb;
        }

        .ea-msg {
          display: flex;
          flex-direction: column;
          max-width: 82%;
          word-break: break-word;
          animation: eaFadeIn 0.2s ease-out;
        }

        @keyframes eaFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .ea-msg-user {
          align-self: flex-end;
        }

        .ea-msg-bot {
          align-self: flex-start;
        }

        .ea-bubble-text {
          padding: 10px 14px;
          border-radius: 16px;
          font-size: 13.5px;
          line-height: 1.45;
        }

        .ea-msg-user .ea-bubble-text {
          background: ${primaryColor};
          color: #ffffff;
          border-bottom-right-radius: 4px;
        }

        .ea-msg-bot .ea-bubble-text {
          background: #ffffff;
          color: #1f2937;
          border: 1px solid #e5e7eb;
          border-bottom-left-radius: 4px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

        .ea-msg-bot pre {
          background: #f3f4f6;
          padding: 8px 10px;
          border-radius: 8px;
          overflow-x: auto;
          font-size: 12px;
          margin: 6px 0;
        }

        .ea-msg-bot code {
          background: #f3f4f6;
          padding: 2px 4px;
          border-radius: 4px;
          font-size: 12px;
          font-family: monospace;
        }

        .ea-msg-bot ul {
          margin: 4px 0;
          padding-left: 20px;
        }

        /* Typing Dots */
        .ea-typing {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 10px 14px;
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 16px;
          border-bottom-left-radius: 4px;
          width: fit-content;
        }

        .ea-typing-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #9ca3af;
          animation: eaBounce 1.2s infinite ease-in-out;
        }

        .ea-typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .ea-typing-dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes eaBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }

        /* Error state */
        .ea-error-msg {
          color: #dc2626;
          background: #fef2f2;
          border: 1px solid #fecaca;
          padding: 8px 12px;
          border-radius: 10px;
          font-size: 12.5px;
          margin-top: 4px;
        }

        .ea-retry-btn {
          background: transparent;
          border: none;
          color: #dc2626;
          font-weight: 600;
          text-decoration: underline;
          cursor: pointer;
          margin-left: 6px;
          padding: 0;
          font-size: 12.5px;
        }

        /* Input Container */
        .ea-input-container {
          padding: 12px 14px;
          background: #ffffff;
          border-top: 1px solid #e5e7eb;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ea-input {
          flex: 1;
          border: 1px solid #d1d5db;
          border-radius: 20px;
          padding: 9px 14px;
          font-size: 13.5px;
          outline: none;
          resize: none;
          height: 38px;
          max-height: 100px;
          font-family: inherit;
          color: #1f2937;
          background: #ffffff;
          transition: border-color 0.15s;
        }

        .ea-input:focus {
          border-color: ${primaryColor};
        }

        .ea-send-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: ${primaryColor};
          color: #ffffff;
          border: none;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.1s;
          flex-shrink: 0;
        }

        .ea-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }

        .ea-send-btn:not(:disabled):active {
          transform: scale(0.92);
        }

        .ea-send-btn svg {
          width: 17px;
          height: 17px;
          fill: currentColor;
          margin-left: 2px;
        }

        /* Branding Footer */
        .ea-branding {
          padding: 6px 12px 8px;
          text-align: center;
          font-size: 10.5px;
          color: #9ca3af;
          background: #ffffff;
          border-top: 1px solid #f3f4f6;
        }

        .ea-branding a {
          color: #6b7280;
          text-decoration: none;
          font-weight: 500;
        }

        .ea-branding a:hover {
          text-decoration: underline;
        }
      </style>

      <!-- Floating Bubble -->
      <button class="ea-bubble" id="eaBubble" aria-label="Open chat" title="Chat with us">
        <svg class="ea-icon-chat" viewBox="0 0 24 24">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
        <svg class="ea-icon-close" viewBox="0 0 24 24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>

      <!-- Chat Panel -->
      <div class="ea-panel" id="eaPanel" role="dialog" aria-label="Chat window">
        <!-- Header -->
        <div class="ea-header">
          <div class="ea-header-info">
            <div class="ea-avatar">${headerTitle.slice(0, 1).toUpperCase()}</div>
            <div class="ea-title-wrap">
              <span class="ea-title">${headerTitle}</span>
              <span class="ea-status">
                <span class="ea-status-dot"></span> Online
              </span>
            </div>
          </div>
          <div class="ea-header-actions">
            <button class="ea-btn-icon" id="eaResetBtn" title="New conversation" aria-label="Reset chat">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
              </svg>
            </button>
            <button class="ea-btn-icon" id="eaCloseBtn" title="Close" aria-label="Close chat">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Messages Area -->
        <div class="ea-messages" id="eaMessages" aria-live="polite"></div>

        <!-- Input Area -->
        <div class="ea-input-container">
          <input
            type="text"
            class="ea-input"
            id="eaInput"
            placeholder="Type your message..."
            autocomplete="off"
          />
          <button class="ea-send-btn" id="eaSendBtn" title="Send" disabled>
            <svg viewBox="0 0 24 24">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>

        <!-- Branding -->
        <div class="ea-branding">
          Powered by <a href="${baseUrl}" target="_blank" rel="noopener">EmbedAI</a>
        </div>
      </div>
    `;

    // 4. Element references
    const bubble = shadow.getElementById("eaBubble");
    const panel = shadow.getElementById("eaPanel");
    const closeBtn = shadow.getElementById("eaCloseBtn");
    const resetBtn = shadow.getElementById("eaResetBtn");
    const messagesEl = shadow.getElementById("eaMessages");
    const input = shadow.getElementById("eaInput");
    const sendBtn = shadow.getElementById("eaSendBtn");

    let conversationId = null;
    let isStreaming = false;
    let lastUserMessage = "";

    // 5. Restore or Initialize Session
    function restoreSession() {
      try {
        const saved = sessionStorage.getItem(SESSION_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          conversationId = parsed.conversationId || null;
          if (Array.isArray(parsed.messages) && parsed.messages.length > 0) {
            messagesEl.innerHTML = "";
            parsed.messages.forEach((m) => appendMessage(m.role, m.content, false));
            scrollToBottom();
            return;
          }
        }
      } catch {}

      // Default welcome message
      messagesEl.innerHTML = "";
      appendMessage("assistant", welcomeMessage, false);
      saveSession();
    }

    function saveSession() {
      try {
        const msgs = [];
        messagesEl.querySelectorAll(".ea-msg").forEach((el) => {
          const role = el.classList.contains("ea-msg-user") ? "user" : "assistant";
          const raw = el.dataset.raw || el.querySelector(".ea-bubble-text")?.textContent || "";
          msgs.push({ role, content: raw });
        });
        sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify({ conversationId, messages: msgs })
        );
      } catch {}
    }

    function scrollToBottom() {
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function appendMessage(role, content, shouldScroll = true) {
      const msgDiv = document.createElement("div");
      msgDiv.className = `ea-msg ${role === "user" ? "ea-msg-user" : "ea-msg-bot"}`;
      msgDiv.dataset.raw = content;

      const bubbleText = document.createElement("div");
      bubbleText.className = "ea-bubble-text";
      bubbleText.innerHTML = renderMarkdown(content);
      msgDiv.appendChild(bubbleText);

      messagesEl.appendChild(msgDiv);
      if (shouldScroll) scrollToBottom();
      return msgDiv;
    }

    function showTypingIndicator() {
      const typingDiv = document.createElement("div");
      typingDiv.className = "ea-typing";
      typingDiv.id = "eaTyping";
      typingDiv.innerHTML = `
        <span class="ea-typing-dot"></span>
        <span class="ea-typing-dot"></span>
        <span class="ea-typing-dot"></span>
      `;
      messagesEl.appendChild(typingDiv);
      scrollToBottom();
    }

    function removeTypingIndicator() {
      const typing = shadow.getElementById("eaTyping");
      if (typing) typing.remove();
    }

    // Toggle Chat
    function toggleChat() {
      const isOpen = panel.classList.contains("ea-visible");
      if (isOpen) {
        panel.classList.remove("ea-visible");
        bubble.classList.remove("ea-open");
      } else {
        panel.classList.add("ea-visible");
        bubble.classList.add("ea-open");
        setTimeout(() => input.focus(), 220);
      }
    }

    // Reset Chat
    function resetChat() {
      if (isStreaming) return;
      conversationId = null;
      try {
        sessionStorage.removeItem(SESSION_KEY);
      } catch {}
      messagesEl.innerHTML = "";
      appendMessage("assistant", welcomeMessage);
      saveSession();
    }

    // Send Message
    async function sendMessage(textToSend) {
      const text = (textToSend || input.value).trim();
      if (!text || isStreaming) return;

      lastUserMessage = text;
      input.value = "";
      sendBtn.disabled = true;
      isStreaming = true;

      // 1. Append user message
      appendMessage("user", text);
      showTypingIndicator();

      try {
        const res = await fetch(`${baseUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chatbotId,
            conversationId,
            message: text,
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        // Header check for conversation id
        const convHeader = res.headers.get("X-Conversation-Id");
        if (convHeader && !conversationId) conversationId = convHeader;

        removeTypingIndicator();

        // 2. Prepare streaming bot message container
        const botMsgDiv = document.createElement("div");
        botMsgDiv.className = "ea-msg ea-msg-bot";
        const bubbleText = document.createElement("div");
        bubbleText.className = "ea-bubble-text";
        botMsgDiv.appendChild(bubbleText);
        messagesEl.appendChild(botMsgDiv);

        let accumulated = "";

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const data = JSON.parse(jsonStr);
              if (data.conversationId && !conversationId) {
                conversationId = data.conversationId;
              }
              if (data.token) {
                accumulated += data.token;
                bubbleText.innerHTML = renderMarkdown(accumulated);
                scrollToBottom();
              }
            } catch {}
          }
        }

        botMsgDiv.dataset.raw = accumulated;
        saveSession();
      } catch (err) {
        removeTypingIndicator();
        console.error("[EmbedAI] Chat error:", err);

        const errorDiv = document.createElement("div");
        errorDiv.className = "ea-error-msg";
        errorDiv.innerHTML = `
          Something went wrong. Please try again.
          <button class="ea-retry-btn" id="eaRetryBtn">Retry</button>
        `;
        messagesEl.appendChild(errorDiv);
        scrollToBottom();

        const retryBtn = errorDiv.querySelector("#eaRetryBtn");
        if (retryBtn) {
          retryBtn.addEventListener("click", () => {
            errorDiv.remove();
            sendMessage(lastUserMessage);
          });
        }
      } finally {
        isStreaming = false;
        input.disabled = false;
        sendBtn.disabled = !input.value.trim();
        input.focus();
      }
    }

    // Event listeners
    bubble.addEventListener("click", toggleChat);
    closeBtn.addEventListener("click", toggleChat);
    resetBtn.addEventListener("click", resetChat);

    input.addEventListener("input", () => {
      sendBtn.disabled = !input.value.trim() || isStreaming;
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    sendBtn.addEventListener("click", () => sendMessage());

    // Initialize state
    restoreSession();
  }

  // Run when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initWidget);
  } else {
    initWidget();
  }
})();
