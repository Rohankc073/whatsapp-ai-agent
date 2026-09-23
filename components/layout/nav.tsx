"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, LayoutDashboard, LogOut, Megaphone, MessageCircle, MessagesSquare, Settings, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/conversations", label: "Conversations", icon: MessagesSquare },
  { href: "/broadcasts", label: "Broadcasts", icon: Megaphone },
  { href: "/rules", label: "Reply rules", icon: Workflow },
  { href: "/knowledge", label: "Knowledge", icon: BookOpen },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <MessageCircle className="size-4" />
      </div>
      <span className="text-sm font-semibold tracking-tight">WhatsApp Agent</span>
    </div>
  );
}

export function Sidebar({ email }: { email: string }) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-border bg-surface md:flex">
      <div className="px-5 py-5">
        <Brand />
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active ? "bg-primary-soft font-medium text-primary" : "text-muted hover:bg-surface-2 hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        <p className="truncate px-3 pb-2 text-xs text-muted" title={email}>
          {email}
        </p>
        <form action="/auth/signout" method="post">
          <button className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-foreground">
            <LogOut className="size-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-border bg-surface md:hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <Brand />
        <form action="/auth/signout" method="post">
          <button className="rounded-lg p-2 text-muted hover:bg-surface-2" aria-label="Sign out">
            <LogOut className="size-4" />
          </button>
        </form>
      </div>
      <nav className="flex gap-1 overflow-x-auto px-3 pb-2">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs",
              pathname.startsWith(href) ? "bg-primary-soft font-medium text-primary" : "text-muted"
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
