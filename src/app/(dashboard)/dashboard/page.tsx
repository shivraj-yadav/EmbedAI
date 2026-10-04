import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Bot } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch user profile name from public.users
  const { data: profile } = await supabase
    .from("users")
    .select("name")
    .eq("id", user.id)
    .single();

  const displayName = profile?.name ?? user.email ?? "there";

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-6 px-4">
      <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center">
        <Bot className="w-6 h-6 text-primary-foreground" />
      </div>
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Welcome, {displayName} 👋</h1>
        <p className="text-muted-foreground">
          Dashboard is coming in Module 2. Authentication is working!
        </p>
      </div>
    </div>
  );
}
