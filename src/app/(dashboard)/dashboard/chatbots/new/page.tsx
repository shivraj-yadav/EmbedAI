"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Bot } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function NewChatbotPage() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const welcomeMessage = formData.get("welcomeMessage") as string;

    // Client-side validation
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "Chatbot name is required.";
    if (name.trim().length > 100) newErrors.name = "Name must be under 100 characters.";
    if (description.trim().length > 300)
      newErrors.description = "Description must be under 300 characters.";
    if (!welcomeMessage.trim())
      newErrors.welcomeMessage = "Welcome message is required.";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setPending(true);
    try {
      const res = await fetch("/api/chatbots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, welcomeMessage }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Failed to create chatbot.");
        return;
      }

      toast.success("Chatbot created!");
      router.push(`/dashboard/chatbots/${data.id}/knowledge`);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="px-6 py-8 max-w-2xl mx-auto w-full">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Create Chatbot</h1>
          <p className="text-sm text-muted-foreground">
            Set up your AI chatbot in seconds
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">
            Chatbot Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            name="name"
            placeholder="e.g. Customer Support Bot"
            disabled={pending}
            aria-describedby="name-error"
            maxLength={100}
          />
          {errors.name && (
            <p id="name-error" className="text-xs text-destructive">
              {errors.name}
            </p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="description">
            Description{" "}
            <span className="text-muted-foreground text-xs">(optional)</span>
          </Label>
          <Textarea
            id="description"
            name="description"
            placeholder="e.g. Answers questions about our products and services"
            disabled={pending}
            rows={3}
            maxLength={300}
            className="resize-none"
            aria-describedby="description-error"
          />
          {errors.description && (
            <p id="description-error" className="text-xs text-destructive">
              {errors.description}
            </p>
          )}
        </div>

        {/* Welcome Message */}
        <div className="space-y-2">
          <Label htmlFor="welcomeMessage">
            Welcome Message <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="welcomeMessage"
            name="welcomeMessage"
            defaultValue="Hi! How can I help you?"
            placeholder="Hi! How can I help you?"
            disabled={pending}
            rows={2}
            className="resize-none"
            aria-describedby="welcome-error"
          />
          <p className="text-xs text-muted-foreground">
            This is the first message visitors see when they open your chatbot.
          </p>
          {errors.welcomeMessage && (
            <p id="welcome-error" className="text-xs text-destructive">
              {errors.welcomeMessage}
            </p>
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={pending} className="flex-1 sm:flex-none sm:min-w-40">
            {pending ? (
              <>
                <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create Chatbot"
            )}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard">Cancel</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
