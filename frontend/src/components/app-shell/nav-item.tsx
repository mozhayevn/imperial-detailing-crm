"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type {
  NavigationBadgeTone,
  NavigationItem,
} from "@/src/types/navigation";
import { cn } from "@/src/lib/cn";

type NavItemProps = {
  item: NavigationItem;
  onNavigate?: () => void;
};

function getBadgeClass(tone?: NavigationBadgeTone) {
  switch (tone) {
    case "primary":
      return "border-[rgb(45_212_191_/_0.28)] bg-[rgb(45_212_191_/_0.1)] text-[rgb(94_234_212)]";
    case "warning":
      return "border-[rgb(251_191_36_/_0.28)] bg-[rgb(251_191_36_/_0.1)] text-[rgb(252_211_77)]";
    case "danger":
      return "border-[rgb(248_113_113_/_0.28)] bg-[rgb(248_113_113_/_0.1)] text-[rgb(252_165_165)]";
    case "success":
      return "border-[rgb(74_222_128_/_0.28)] bg-[rgb(74_222_128_/_0.1)] text-[rgb(134_239_172)]";
    default:
      return "border-[hsl(var(--border))] bg-[hsl(var(--surface-3))] text-[hsl(var(--muted-foreground))]";
  }
}

export function NavItem({ item, onNavigate }: NavItemProps) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        "group relative flex items-center justify-between overflow-hidden rounded-2xl px-3 py-2.5 text-sm transition",
        isActive
          ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[var(--shadow-glow)]"
          : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--surface-2))] hover:text-white",
        item.isFuture && "opacity-75",
      )}
    >
      {isActive ? (
        <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[hsl(var(--primary-foreground))]/45" />
      ) : null}

      <span className="min-w-0">
        <span className="block truncate font-medium">{item.title}</span>

        {item.description ? (
          <span
            className={cn(
              "mt-0.5 block truncate text-[11px]",
              isActive
                ? "text-[hsl(var(--primary-foreground))]/75"
                : "text-[hsl(var(--muted))]",
            )}
          >
            {item.description}
          </span>
        ) : null}
      </span>

      {item.badge ? (
        <span
          className={cn(
            "ml-2 shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            getBadgeClass(item.badge.tone),
          )}
        >
          {item.badge.label}
        </span>
      ) : null}
    </Link>
  );
}