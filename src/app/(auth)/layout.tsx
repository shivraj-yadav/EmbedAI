import Link from "next/link";
import { Bot } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Minimal auth navbar */}
      <nav className="px-6 py-4 border-b border-border/50">
        <Link href="/" className="flex items-center gap-2 w-fit">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight">EmbedAI</span>
        </Link>
      </nav>

      {/* Centered card area */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        {children}
      </main>
    </div>
  );
}
