"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  MessageSquare,
  User,
  Bot,
  Calendar,
  Clock,
  RefreshCw,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConversationSummary {
  id: string;
  session_id: string | null;
  visitor_label: string;
  first_message: string;
  message_count: number;
  created_at: string;
  last_message_at: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

interface ConversationDetail {
  id: string;
  chatbot_id: string;
  session_id: string | null;
  created_at: string;
  chatbot_name: string;
  visitor_label: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatMessageTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDetailedDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function getDateGroup(dateString: string): "Today" | "Yesterday" | "Earlier" {
  const date = new Date(dateString);
  const now = new Date();

  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  if (isToday) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  if (isYesterday) return "Yesterday";

  return "Earlier";
}

// Simple markdown formatter for assistant responses
function formatMarkdownContent(raw: string) {
  if (!raw) return null;

  // Split into paragraphs / lines
  const lines = raw.split("\n");
  const elements: React.ReactNode[] = [];

  let currentList: string[] = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc pl-5 my-2 space-y-1">
          {currentList.map((item, i) => (
            <li key={i}>{formatInline(item)}</li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  const formatInline = (text: string) => {
    // Bold **text**
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
      currentList.push(trimmed.slice(2));
    } else {
      flushList();
      if (trimmed) {
        elements.push(
          <p key={`p-${idx}`} className="my-1.5 leading-relaxed">
            {formatInline(trimmed)}
          </p>
        );
      }
    }
  });

  flushList();
  return elements;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ConversationsTab({ chatbotId }: { chatbotId: string }) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingList, setLoadingList] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Selected conversation state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<ConversationDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // 1. Fetch conversations list
  async function loadConversations(pageNum = 1, isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch(`/api/chatbots/${chatbotId}/conversations?page=${pageNum}&limit=30`);
      if (res.ok) {
        const json = await res.json();
        setConversations(json.conversations);
        setTotal(json.total);
        setPage(json.page);

        // Auto-select first conversation on first load if on desktop
        if (json.conversations.length > 0 && !selectedId && typeof window !== "undefined" && window.innerWidth >= 1024) {
          setSelectedId(json.conversations[0].id);
        }
      } else {
        toast.error("Failed to load conversations");
      }
    } catch (err) {
      console.error("Error loading conversations:", err);
      toast.error("Failed to fetch conversation list");
    } finally {
      setLoadingList(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadConversations(1);
  }, [chatbotId]);

  // 2. Fetch messages when selectedId changes
  useEffect(() => {
    if (!selectedId) {
      setSelectedDetail(null);
      setMessages([]);
      return;
    }

    async function loadThread() {
      setLoadingMessages(true);
      try {
        const res = await fetch(`/api/conversations/${selectedId}/messages`);
        if (res.ok) {
          const json = await res.json();
          setSelectedDetail(json.conversation);
          setMessages(json.messages);
        } else {
          toast.error("Failed to load conversation thread");
        }
      } catch (err) {
        console.error("Error loading messages:", err);
        toast.error("Failed to fetch conversation details");
      } finally {
        setLoadingMessages(false);
      }
    }

    loadThread();
  }, [selectedId]);

  // 3. Group conversations by date
  const groupedConversations = useMemo(() => {
    const filtered = searchQuery.trim()
      ? conversations.filter(
          (c) =>
            c.visitor_label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            c.first_message.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : conversations;

    const groups: Record<"Today" | "Yesterday" | "Earlier", ConversationSummary[]> = {
      Today: [],
      Yesterday: [],
      Earlier: [],
    };

    filtered.forEach((conv) => {
      const groupKey = getDateGroup(conv.created_at);
      groups[groupKey].push(conv);
    });

    return groups;
  }, [conversations, searchQuery]);

  return (
    <div className="space-y-4">
      {/* ─── Top Bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">Conversations</h2>
            <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-primary/10 text-primary">
              {total}
            </span>
          </div>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Logged visitor chats & answers
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick search input */}
          <div className="relative w-48 sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadConversations(page, true)}
            disabled={refreshing}
            className="h-8 gap-1.5 text-xs"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", refreshing && "animate-spin")} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* ─── Main Two-Column Container ─────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-250px)] min-h-[550px]">
        {/* ─── Left Column (List) ─────────────────────────────────────── */}
        <div
          className={cn(
            "lg:col-span-5 flex flex-col h-full rounded-2xl border border-border bg-card overflow-hidden",
            // On mobile: hide list if conversation is actively viewed
            selectedId && "hidden lg:flex"
          )}
        >
          <div className="p-3 border-b border-border bg-muted/20 text-xs font-medium text-muted-foreground flex justify-between items-center">
            <span>Recent Visitor Sessions</span>
            <span>{conversations.length} loaded</span>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-4 divide-y divide-border/40">
            {loadingList ? (
              <div className="flex items-center justify-center py-20 text-xs text-muted-foreground gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 px-4 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-muted/60 flex items-center justify-center text-muted-foreground">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold">No conversations yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs">
                    Once visitors interact with your chatbot via the widget or preview, their conversations will appear here.
                  </p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button asChild size="sm" variant="outline" className="text-xs">
                    <Link href={`/dashboard/chatbots/${chatbotId}/preview`}>
                      <Sparkles className="w-3.5 h-3.5 mr-1.5 text-primary" />
                      Test in Preview
                    </Link>
                  </Button>
                  <Button asChild size="sm" className="text-xs">
                    <Link href={`/dashboard/chatbots/${chatbotId}/embed`}>
                      Get Embed Code
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              (["Today", "Yesterday", "Earlier"] as const).map((groupKey) => {
                const groupItems = groupedConversations[groupKey];
                if (!groupItems || groupItems.length === 0) return null;

                return (
                  <div key={groupKey} className="space-y-1.5 pt-2 first:pt-0">
                    <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                      {groupKey}
                    </div>

                    <div className="space-y-1">
                      {groupItems.map((conv) => {
                        const isSelected = selectedId === conv.id;

                        return (
                          <button
                            key={conv.id}
                            onClick={() => setSelectedId(conv.id)}
                            className={cn(
                              "w-full text-left p-3 rounded-xl transition-all duration-150 flex flex-col gap-1.5 group border",
                              isSelected
                                ? "bg-primary/10 border-primary/40 shadow-sm"
                                : "border-transparent hover:bg-muted/50 hover:border-border/60"
                            )}
                          >
                            <div className="flex items-center justify-between w-full">
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-semibold",
                                    isSelected
                                      ? "bg-primary text-primary-foreground"
                                      : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                                  )}
                                >
                                  <User className="w-3.5 h-3.5" />
                                </div>
                                <span className="font-semibold text-xs text-foreground">
                                  {conv.visitor_label}
                                </span>
                              </div>

                              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatRelativeTime(conv.last_message_at)}
                              </span>
                            </div>

                            {/* Message Preview */}
                            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                              "{conv.first_message}"
                            </p>

                            <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" />
                                {conv.message_count} {conv.message_count === 1 ? "message" : "messages"}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ─── Right Column (Message Thread Viewer) ──────────────────── */}
        <div
          className={cn(
            "lg:col-span-7 flex flex-col h-full rounded-2xl border border-border bg-card overflow-hidden shadow-sm",
            // On mobile: show thread only if selected
            !selectedId && "hidden lg:flex"
          )}
        >
          {selectedId ? (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-border bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Mobile Back Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedId(null)}
                    className="lg:hidden h-8 w-8 p-0"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm">
                        {selectedDetail?.visitor_label || "Conversation"}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium">
                        {messages.length} messages
                      </span>
                    </div>
                    {selectedDetail?.created_at && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Started {formatDetailedDate(selectedDetail.created_at)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right hidden sm:block">
                  <span className="text-xs font-medium text-muted-foreground">
                    Bot: {selectedDetail?.chatbot_name}
                  </span>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-muted/5">
                {loadingMessages ? (
                  <div className="flex items-center justify-center py-24 text-xs text-muted-foreground gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                    Loading conversation thread...
                  </div>
                ) : messages.length === 0 ? (
                  <div className="py-20 text-center text-xs text-muted-foreground">
                    No messages recorded in this conversation session.
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isUser = msg.role === "user";

                    return (
                      <div
                        key={msg.id || index}
                        className={cn(
                          "flex gap-3 max-w-[85%]",
                          isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                        )}
                      >
                        {/* Avatar */}
                        <div
                          className={cn(
                            "w-7 h-7 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5",
                            isUser
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted border border-border text-foreground"
                          )}
                        >
                          {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                        </div>

                        {/* Bubble */}
                        <div className="space-y-1">
                          <div
                            className={cn(
                              "p-3.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed",
                              isUser
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-card border border-border text-card-foreground rounded-bl-sm shadow-sm"
                            )}
                          >
                            {isUser ? (
                              <p className="whitespace-pre-wrap">{msg.content}</p>
                            ) : (
                              <div className="space-y-1">{formatMarkdownContent(msg.content)}</div>
                            )}
                          </div>

                          <div
                            className={cn(
                              "text-[10px] text-muted-foreground flex items-center gap-1 px-1",
                              isUser && "justify-end"
                            )}
                          >
                            <span>{isUser ? "Visitor" : "Assistant"}</span>
                            <span>•</span>
                            <span>{formatMessageTime(msg.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            /* Empty selection state */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-3 text-muted-foreground">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center">
                <MessageSquare className="w-7 h-7 text-muted-foreground/60" />
              </div>
              <div className="space-y-1 max-w-sm">
                <p className="text-sm font-semibold text-foreground">
                  Select a Conversation
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Choose a visitor session from the list on the left to read the full dialogue thread and see how the AI responded.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
