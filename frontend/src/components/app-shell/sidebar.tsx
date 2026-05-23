import { appConfig } from "@/src/config/app";
import {
  adminNavigation,
  futureNavigation,
  mainNavigation,
} from "@/src/config/navigation";
import { NavItem } from "@/src/components/app-shell/nav-item";

type SidebarProps = {
  onNavigate?: () => void;
};

export function Sidebar({ onNavigate }: SidebarProps) {
  return (
    <aside className="flex h-full flex-col">
      <div className="border-b border-[hsl(var(--border))] px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[hsl(var(--primary))] text-sm font-black text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-glow)]">
            I
          </div>

          <div>
            <div className="text-sm font-semibold tracking-tight text-white">
              {appConfig.name}
            </div>
            <div className="text-xs text-[hsl(var(--muted))]">
              Операционная CRM
            </div>
          </div>
        </div>
      </div>

      <div className="crm-scrollbar flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-6">
          <nav className="space-y-1">
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
              Операции
            </div>

            {mainNavigation.map((item) => (
              <NavItem key={item.href} item={item} onNavigate={onNavigate} />
            ))}
          </nav>

          <nav className="space-y-1">
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
              Управление
            </div>

            {adminNavigation.map((item) => (
              <NavItem key={item.href} item={item} onNavigate={onNavigate} />
            ))}
          </nav>

          <nav className="space-y-1">
            <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[hsl(var(--muted))]">
              Будущий слой
            </div>

            {futureNavigation.map((item) => (
              <NavItem key={item.href} item={item} onNavigate={onNavigate} />
            ))}
          </nav>
        </div>
      </div>
    </aside>
  );
}