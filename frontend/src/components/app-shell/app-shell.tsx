"use client";

import { useState } from "react";
import { Sidebar } from "@/src/components/app-shell/sidebar";
import { Topbar } from "@/src/components/app-shell/topbar";
import { cn } from "@/src/lib/cn";

type AppShellProps = {
  children: React.ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_18%_12%,rgb(45_212_191_/_0.12),transparent_32rem),radial-gradient(circle_at_82%_8%,rgb(251_191_36_/_0.08),transparent_30rem)]" />

      <div className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-width)] border-r border-[hsl(var(--border))] bg-[hsl(var(--surface-1))]/92 backdrop-blur-xl lg:block">
        <Sidebar />
      </div>

      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          isSidebarOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <button
          type="button"
          aria-label="Закрыть меню"
          className={cn(
            "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity",
            isSidebarOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setIsSidebarOpen(false)}
        />

        <div
          className={cn(
            "absolute inset-y-0 left-0 w-[min(88vw,var(--sidebar-width))] border-r border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] shadow-[var(--shadow-soft)] transition-transform duration-300",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <Sidebar onNavigate={() => setIsSidebarOpen(false)} />
        </div>
      </div>

      <div className="relative z-10 min-h-screen lg:pl-[var(--sidebar-width)]">
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />

        <main className="min-h-[calc(100vh-var(--topbar-height))] px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}