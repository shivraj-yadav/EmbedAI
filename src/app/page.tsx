import Link from "next/link";
import { Bot, FileText, Code2, Zap, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: FileText,
    title: "Upload Your Documents",
    description:
      "Support for PDF, TXT, and DOCX files. Your knowledge base is built automatically.",
  },
  {
    icon: Zap,
    title: "AI-Powered Answers",
    description:
      "Retrieval-Augmented Generation (RAG) ensures accurate, grounded responses every time.",
  },
  {
    icon: Code2,
    title: "One-Line Embed",
    description:
      "Copy a single script tag and your chatbot is live on any website instantly.",
  },
];

export default function LandingPage() {
  return (
    <main className="flex-1 flex flex-col">
      {/* ── Navbar ── */}
      <nav className="border-b border-border/50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg tracking-tight">
              EmbedAI
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">
                Get Started
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="flex-1 flex flex-col items-center justify-center px-6 py-24 text-center">
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-6">
          {/* Badge */}
          <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-muted/50 text-muted-foreground text-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI chatbots from your documents — in minutes</span>
          </div>

          {/* Heading */}
          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight">
            Turn your docs into an{" "}
            <span className="text-primary">AI chatbot</span>
          </h1>

          {/* Subheading */}
          <p className="text-xl text-muted-foreground max-w-xl leading-relaxed">
            Upload your PDFs, policies, and FAQs. EmbedAI builds a smart
            chatbot you can embed on any website with one line of code.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <Button size="lg" asChild>
              <Link href="/signup">
                Create Your Chatbot
                <ArrowRight className="ml-2 w-4 h-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="px-6 py-20 border-t border-border/50">
        <div className="max-w-5xl mx-auto">
          <p className="text-center text-sm text-muted-foreground uppercase tracking-widest font-medium mb-12">
            Everything you need
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
            {features.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="flex flex-col gap-3 p-6 rounded-2xl border border-border bg-card hover:border-primary/30 transition-colors duration-200"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h2 className="font-semibold text-base">{title}</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/50 px-6 py-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4" />
            <span>EmbedAI</span>
          </div>
          <span>© {new Date().getFullYear()} EmbedAI</span>
        </div>
      </footer>
    </main>
  );
}
