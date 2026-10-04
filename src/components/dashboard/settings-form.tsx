"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface SettingsFormProps {
  chatbot: {
    id: string;
    name: string;
    description: string;
    welcome_message: string;
    system_prompt: string | null;
    theme: {
      primaryColor?: string;
      position?: string;
      headerTitle?: string;
    };
  };
}

export function SettingsForm({ chatbot }: SettingsFormProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Form state
  const [name, setName] = useState(chatbot.name);
  const [description, setDescription] = useState(chatbot.description ?? "");
  const [welcomeMessage, setWelcomeMessage] = useState(chatbot.welcome_message);
  const [systemPrompt, setSystemPrompt] = useState(chatbot.system_prompt ?? "");
  const [primaryColor, setPrimaryColor] = useState(
    chatbot.theme?.primaryColor ?? "#6366f1"
  );
  const [position, setPosition] = useState(
    chatbot.theme?.position ?? "bottom-right"
  );
  const [headerTitle, setHeaderTitle] = useState(
    chatbot.theme?.headerTitle ?? ""
  );

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Chatbot name is required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/chatbots/${chatbot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          welcomeMessage,
          systemPrompt,
          theme: { primaryColor, position, headerTitle },
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        toast.error(d.error ?? "Failed to save settings.");
      } else {
        toast.success("Settings saved!");
        router.refresh();
      }
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/chatbots/${chatbot.id}`, {
        method: "DELETE",
      });

      if (!res.ok && res.status !== 204) {
        toast.error("Failed to delete chatbot.");
        return;
      }

      toast.success("Chatbot deleted.");
      router.push("/dashboard");
      router.refresh();
    } catch {
      toast.error("Something went wrong.");
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSave} className="max-w-2xl space-y-8">
        {/* ── Basic Settings ── */}
        <section className="space-y-5">
          <div>
            <h2 className="text-base font-semibold">Basic Settings</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Configure the core information for your chatbot.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-border bg-card space-y-5">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                Chatbot Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                disabled={saving}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={300}
                rows={3}
                className="resize-none"
                disabled={saving}
              />
            </div>

            {/* Welcome Message */}
            <div className="space-y-2">
              <Label htmlFor="welcomeMessage">Welcome Message</Label>
              <Textarea
                id="welcomeMessage"
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                rows={2}
                className="resize-none"
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                The first message visitors see in the chat widget.
              </p>
            </div>

            {/* System Prompt */}
            <div className="space-y-2">
              <Label htmlFor="systemPrompt">System Prompt</Label>
              <Textarea
                id="systemPrompt"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={5}
                className="resize-none font-mono text-xs"
                placeholder="You are a helpful AI assistant for [Company]. Answer questions based only on the provided documents..."
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                Instructions that shape the AI's behavior and persona.
              </p>
            </div>
          </div>
        </section>

        {/* ── Appearance ── */}
        <section className="space-y-5">
          <div>
            <h2 className="text-base font-semibold">Appearance</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Customize how the chat widget looks on your website.
            </p>
          </div>

          <div className="p-5 rounded-xl border border-border bg-card space-y-5">
            {/* Primary color */}
            <div className="space-y-2">
              <Label htmlFor="primaryColor">Primary Color</Label>
              <div className="flex items-center gap-3">
                <input
                  id="primaryColor"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  disabled={saving}
                  className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent p-0.5"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-32 font-mono text-sm"
                  maxLength={7}
                  disabled={saving}
                />
              </div>
            </div>

            {/* Header title */}
            <div className="space-y-2">
              <Label htmlFor="headerTitle">Widget Header Title</Label>
              <Input
                id="headerTitle"
                value={headerTitle}
                onChange={(e) => setHeaderTitle(e.target.value)}
                placeholder="e.g. Customer Support"
                disabled={saving}
              />
            </div>

            {/* Position */}
            <div className="space-y-2">
              <Label>Chat Position</Label>
              <div className="flex gap-2">
                {["bottom-right", "bottom-left"].map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setPosition(pos)}
                    disabled={saving}
                    className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                      position === pos
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    {pos === "bottom-right" ? "Bottom Right" : "Bottom Left"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Save button */}
        <Button
          type="submit"
          disabled={saving}
          id="save-settings-btn"
          className="min-w-36"
        >
          {saving ? (
            <>
              <Loader2 className="mr-2 w-4 h-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </form>

      {/* ── Danger Zone ── */}
      <div className="max-w-2xl mt-10 rounded-xl border border-destructive/40 bg-destructive/5 p-5 space-y-3">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="w-4 h-4" />
          <h2 className="text-base font-semibold">Danger Zone</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Permanently delete this chatbot, all its documents, and all
          conversation history. This action cannot be undone.
        </p>
        <Button
          variant="destructive"
          onClick={() => setShowDeleteDialog(true)}
          id="delete-chatbot-btn"
        >
          <Trash2 className="mr-2 w-4 h-4" />
          Delete Chatbot
        </Button>
      </div>

      {/* ── Delete Confirmation Dialog ── */}
      {showDeleteDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div className="bg-card border border-destructive/40 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl space-y-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h3
                  id="delete-dialog-title"
                  className="font-semibold text-base"
                >
                  Delete Chatbot?
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  This will permanently delete this chatbot, all its documents,
                  and all conversation history. This cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleting}
                id="cancel-delete-btn"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleting}
                id="confirm-delete-btn"
              >
                {deleting ? (
                  <>
                    <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                    Deleting…
                  </>
                ) : (
                  "Delete Permanently"
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
