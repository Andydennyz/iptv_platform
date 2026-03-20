import { useState, useEffect } from "react";
import {
  Tv,
  Trophy,
  Newspaper,
  Star,
  Film,
  Music2,
  LayoutGrid,
  Heart,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/libs/utils.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import type { Category, ViewState } from "../_lib/types.ts";

const ICON_MAP: Record<string, LucideIcon> = {
  Tv,
  Trophy,
  Newspaper,
  Star,
  Film,
  Music2,
};

type Props = {
  categories: Category[];
  view: ViewState;
  onSelectView: (view: ViewState) => void;
  isLoading: boolean;
  favoritesCount: number;
  isOpen?: boolean;
};

export default function Sidebar({ categories, view, onSelectView, isLoading, favoritesCount, isOpen }: Props) {
  return (
    <aside
      className={cn(
        "bg-sidebar border-sidebar-border border-r flex flex-col overflow-hidden z-30",
        "transition-transform duration-300 ease-in-out",
        "md:static md:translate-x-0 md:w-[210px] md:h-full",
        "w-[280px] h-full fixed top-0 left-0 bottom-0",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}
    >
      {/* Brand header */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center shrink-0">
            <Tv className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-bold text-sidebar-foreground leading-tight tracking-wide">
              StreamTV
            </p>
            <p className="text-[9px] text-muted-foreground leading-tight uppercase tracking-widest">
              IPTV Platform
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        <NavButton
          icon={LayoutGrid}
          label="All Channels"
          active={view === "all"}
          onClick={() => onSelectView("all")}
        />
        <NavButton
          icon={Heart}
          label="Favorites"
          active={view === "favorites"}
          onClick={() => onSelectView("favorites")}
          badge={favoritesCount > 0 ? favoritesCount : undefined}
        />
        <NavButton
          icon={CalendarDays}
          label="Guide"
          active={view === "epg"}
          onClick={() => onSelectView("epg")}
        />

        <div className="pt-3 pb-1 px-2">
          <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">
            Categories
          </p>
        </div>

        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2">
                <Skeleton className="w-4 h-4 rounded shrink-0" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))
          : categories.map((cat) => {
              const Icon = ICON_MAP[cat.icon] ?? Tv;
              return (
                <NavButton
                  key={cat._id}
                  icon={Icon}
                  label={cat.name}
                  active={view === cat._id}
                  onClick={() => onSelectView(cat._id)}
                />
              );
            })}
      </nav>

      {/* Live clock footer */}
      <div className="px-4 py-3 border-t border-sidebar-border">
        <LiveClock />
      </div>
    </aside>
  );
}

function NavButton({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-150 text-left",
        active
          ? "bg-primary/15 text-primary font-semibold"
          : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
      )}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {/* Favorites count badge */}
      {badge !== undefined && !active && (
        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center tabular-nums shrink-0">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      {active && (
        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
      )}
    </button>
  );
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="text-center">
      <p className="text-sm font-semibold text-foreground tabular-nums tracking-wider">
        {now.toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5">
        {now.toLocaleDateString([], {
          weekday: "short",
          month: "short",
          day: "numeric",
        })}
      </p>
    </div>
  );
}

