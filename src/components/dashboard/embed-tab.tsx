"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Copy,
  Check,
  Code2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  BookOpen,
  Globe,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatPreview } from "@/components/dashboard/chat-preview";
import { toast } from "sonner";

interface EmbedData {
  chatbotId: string;
  chatbotName: string;
  embedCode: string;
  isReady: boolean;
  documentCount: number;
  widgetUrl: string;
  appUrl: string;
}

export function EmbedTab({ chatbotId }: { chatbotId: string }) {
  const [data, setData] = useState<EmbedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    async function fetchEmbedData() {
      try {
        const res = await fetch(`/api/chatbots/${chatbotId}/embed`);
        if (res.ok) {
          const json: EmbedData = await res.json();
          // Client-side origin fallback: if API returned localhost but user is browsing on a live domain,
          // dynamically adapt the displayed code snippet to the live domain.
          if (typeof window !== "undefined" && window.location.origin) {
            const currentOrigin = window.location.origin.replace(/\/+$/, "");
            if (
              json.appUrl?.includes("localhost") &&
              !currentOrigin.includes("localhost")
            ) {
              json.appUrl = currentOrigin;
              json.widgetUrl = `${currentOrigin}/widget.js`;
              json.embedCode = `<script\n  src="${currentOrigin}/widget.js"\n  data-chatbot-id="${json.chatbotId}"\n  async>\n</script>`;
            }
          }
          setData(json);
        } else {
          toast.error("Failed to load embed data");
        }
      } catch (err) {
        console.error("Error loading embed info:", err);
        toast.error("Failed to load embed configuration");
      } finally {
        setLoading(false);
      }
    }

    fetchEmbedData();
  }, [chatbotId]);

  const copyToClipboard = async (text: string, type: "code" | "id") => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === "code") {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
        toast.success("Embed script copied to clipboard!");
      } else {
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 2000);
        toast.success("Chatbot ID copied to clipboard!");
      }
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground text-sm">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mr-3" />
        Loading embed configuration...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Could not load embed configuration. Please refresh the page.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── 1. Readiness Banner ────────────────────────────────────────── */}
      {data.isReady ? (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-sm">Ready to Embed</p>
            <p className="text-xs text-muted-foreground">
              Your chatbot has {data.documentCount} ready document
              {data.documentCount === 1 ? "" : "s"} in its knowledge base and is
              prepared to answer visitor questions.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-4 p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-sm">No Documents in Knowledge Base</p>
              <p className="text-xs text-muted-foreground">
                Your chatbot currently has no processed documents. It will only be
                able to give generic fallback answers until knowledge documents are
                uploaded.
              </p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="flex-shrink-0">
            <Link href={`/dashboard/chatbots/${chatbotId}/knowledge`}>
              <BookOpen className="w-4 h-4 mr-1.5" />
              Add Documents
            </Link>
          </Button>
        </div>
      )}

      {/* ─── 2. Main 2-Column Layout ────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (7 cols): Embed code & Instructions */}
        <div className="lg:col-span-7 space-y-6">
          {/* Chatbot ID Pill */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card">
            <div className="space-y-0.5">
              <span className="text-xs font-medium text-muted-foreground">
                Chatbot ID
              </span>
              <p className="font-mono text-sm select-all">{data.chatbotId}</p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => copyToClipboard(data.chatbotId, "id")}
              className="gap-1.5 text-xs"
            >
              {copiedId ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-emerald-500">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy ID</span>
                </>
              )}
            </Button>
          </div>

          {/* Embed Code Snippet Block */}
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/40">
              <div className="flex items-center gap-2">
                <Code2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold">Embed Code</span>
              </div>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => copyToClipboard(data.embedCode, "code")}
                className="gap-1.5 text-xs font-medium"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-emerald-500">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Code</span>
                  </>
                )}
              </Button>
            </div>

            {/* Syntax block */}
            <div className="p-4 bg-zinc-950 font-mono text-xs overflow-x-auto text-zinc-100 leading-relaxed selection:bg-primary selection:text-white">
              <div className="text-zinc-500 mb-1">
                &lt;!-- EmbedAI Floating Chat Widget --&gt;
              </div>
              <pre className="whitespace-pre">
                <span className="text-rose-400">&lt;script</span>
                {"\n  "}
                <span className="text-emerald-400">src</span>=
                <span className="text-amber-300">"{data.widgetUrl}"</span>
                {"\n  "}
                <span className="text-emerald-400">data-chatbot-id</span>=
                <span className="text-amber-300">"{data.chatbotId}"</span>
                {"\n  "}
                <span className="text-purple-400">async</span>
                <span className="text-rose-400">&gt;</span>
                {"\n"}
                <span className="text-rose-400">&lt;/script&gt;</span>
              </pre>
            </div>

            {/* Dynamic URL notice */}
            <div className="px-4 py-2.5 bg-muted/20 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-primary" />
                Origin: <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded">{data.appUrl}</code>
              </span>
              <span className="text-[11px]">
                Configured via <code className="font-mono">NEXT_PUBLIC_APP_URL</code>
              </span>
            </div>
          </div>

          {/* Installation Instructions */}
          <div className="p-5 rounded-xl border border-border bg-card space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              How to Install on Any Website
            </h3>

            <ol className="space-y-3 text-xs text-muted-foreground list-decimal list-inside pl-1 leading-normal">
              <li>
                <strong className="text-foreground">Copy the code snippet</strong> above using the Copy Code button.
              </li>
              <li>
                <strong className="text-foreground">Open your website's template</strong> or HTML editor (WordPress, Webflow, Shopify, Framer, Wix, or plain HTML).
              </li>
              <li>
                <strong className="text-foreground">Paste before the closing tag:</strong> Place the script right before the closing{" "}
                <code className="font-mono px-1.5 py-0.5 rounded bg-muted text-foreground text-[11px]">
                  &lt;/body&gt;
                </code>{" "}
                tag.
              </li>
              <li>
                <strong className="text-foreground">Save and publish</strong> your website.
              </li>
              <li>
                <strong className="text-foreground">Test the widget:</strong> Visit your live page to see the floating chat launcher in the corner!
              </li>
            </ol>

            <div className="pt-2 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Want to test locally without building an external site?
              </span>
              <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs">
                <a href="/demo.html" target="_blank" rel="noopener noreferrer">
                  Open Live Demo
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* Right Column (5 cols): Live Widget Preview */}
        <div className="lg:col-span-5 space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Live Widget Preview
            </span>
            <span className="text-[11px] text-muted-foreground">
              Connected to knowledge base
            </span>
          </div>

          {/* Chat Preview Frame */}
          <div className="h-[580px] rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
            <ChatPreview
              chatbotId={data.chatbotId}
              chatbotName={data.chatbotName}
              welcomeMessage="Hi! How can I help you today?"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
