"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Send, Bot, User, Loader2, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  error?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uniqueId() {
  return Math.random().toString(36).slice(2);
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200",
        isUser && "flex-row-reverse"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
      >
        {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-tr-sm"
            : message.error
            ? "bg-destructive/10 text-destructive border border-destructive/20 rounded-tl-sm"
            : "bg-muted text-foreground rounded-tl-sm"
        )}
      >
        {message.streaming && !message.content ? (
          // Thinking dots animation
          <div className="flex items-center gap-1 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
          </div>
        ) : (
          <span className="whitespace-pre-wrap">
            {message.content}
            {message.streaming && (
              <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 animate-pulse align-middle" />
            )}
          </span>
        )}

        {message.error && (
          <div className="flex items-center gap-1.5 mt-1 text-xs opacity-70">
            <AlertTriangle className="w-3 h-3" />
            <span>Something went wrong. Please try again.</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chat Preview ─────────────────────────────────────────────────────────────

export function ChatPreview({
  chatbotId,
  chatbotName,
  welcomeMessage,
}: {
  chatbotId: string;
  chatbotName: string;
  welcomeMessage: string;
}) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: welcomeMessage,
    },
  ]);
  const [input, setInput] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [isStreaming, setIsStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    inputRef.current?.focus();

    // Add user message
    const userMsgId = uniqueId();
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, role: "user", content: text },
    ]);

    // Add placeholder assistant message (streaming)
    const assistantMsgId = uniqueId();
    setMessages((prev) => [
      ...prev,
      { id: assistantMsgId, role: "assistant", content: "", streaming: true },
    ]);

    setIsStreaming(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatbotId,
          conversationId,
          message: text,
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const parsed = JSON.parse(jsonStr);

            if (parsed.conversationId) {
              setConversationId(parsed.conversationId);
            }

            if (parsed.token) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId
                    ? { ...m, content: m.content + parsed.token }
                    : m
                )
              );
            }
          } catch {
            // skip malformed chunk
          }
        }
      }

      // Also check X-Conversation-Id header
      const convHeader = res.headers.get("X-Conversation-Id");
      if (convHeader && !conversationId) setConversationId(convHeader);

      // Mark streaming done
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, streaming: false } : m
        )
      );
    } catch (err) {
      console.error("Chat error:", err);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content: "Something went wrong. Please try again.",
                streaming: false,
                error: true,
              }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, chatbotId, conversationId]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function resetConversation() {
    setConversationId(undefined);
    setMessages([{ id: "welcome", role: "assistant", content: welcomeMessage }]);
    setInput("");
    inputRef.current?.focus();
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold">Chat Preview</h2>
          <p className="text-xs text-muted-foreground">
            Test your chatbot's RAG responses in real time
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={resetConversation}
          className="gap-1.5 h-8 text-xs"
          id="reset-conversation-btn"
        >
          <RefreshCw className="w-3 h-3" />
          New Chat
        </Button>
      </div>

      {/* Chat window */}
      <div className="flex flex-col rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
        {/* Chat header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border bg-muted/30">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium leading-none">{chatbotName}</p>
            <p className="text-xs text-emerald-500 mt-0.5 flex items-center gap-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Online
            </p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[400px] max-h-[500px]">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about your knowledge base..."
              disabled={isStreaming}
              rows={1}
              id="chat-input"
              className={cn(
                "flex-1 resize-none rounded-xl bg-muted/50 border border-border px-3.5 py-2.5 text-sm",
                "placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50",
                "min-h-[40px] max-h-[120px] leading-relaxed transition-colors",
                isStreaming && "opacity-60 cursor-not-allowed"
              )}
              style={{ height: "auto" }}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = "auto";
                t.style.height = Math.min(t.scrollHeight, 120) + "px";
              }}
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isStreaming}
              size="icon"
              className="h-10 w-10 rounded-xl flex-shrink-0"
              id="send-message-btn"
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground mt-2 text-center">
            Press <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">Enter</kbd> to send
            &nbsp;·&nbsp; <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px]">Shift+Enter</kbd> for new line
          </p>
        </div>
      </div>
    </div>
  );
}
