"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface ChatbotTabsProps {
  chatbotId: string;
}

const tabs = [
  { label: "Overview",      href: (id: string) => `/dashboard/chatbots/${id}` },
  { label: "Knowledge",     href: (id: string) => `/dashboard/chatbots/${id}/knowledge` },
  { label: "Preview",       href: (id: string) => `/dashboard/chatbots/${id}/preview` },
  { label: "Settings",      href: (id: string) => `/dashboard/chatbots/${id}/settings` },
  { label: "Conversations", href: (id: string) => `/dashboard/chatbots/${id}/conversations` },
  { label: "Embed",         href: (id: string) => `/dashboard/chatbots/${id}/embed` },
];

export function ChatbotTabs({ chatbotId }: ChatbotTabsProps) {
  const pathname = usePathname();

  return (
    <div className="border-b border-border overflow-x-auto">
      <nav
        className="flex min-w-max"
        aria-label="Chatbot sections"
        role="tablist"
      >
        {tabs.map(({ label, href }) => {
          const to = href(chatbotId);
          // Exact match for Overview, startsWith for the rest
          const isActive =
            label === "Overview" ? pathname === to : pathname.startsWith(to);

          return (
            <Link
              key={label}
              href={to}
              role="tab"
              aria-selected={isActive}
              className={cn(
                "px-5 py-3.5 text-sm font-medium border-b-2 transition-all duration-150 whitespace-nowrap",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
