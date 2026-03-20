import { useState, useEffect, useRef, useCallback } from "react";
import { Heart, Tv, Search, X } from "lucide-react";
import { cn } from "@/libs/utils.ts";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty.tsx";
import { useDebounce } from "@/hooks/use-debounce.ts";
import type { Channel, ViewState } from "../_lib/types.ts";

type Props = {
  channels: Channel[];
  currentChannel: Channel | null;
  onSelectChannel: (channel: Channel) => void;
  favorites: string[];
  onToggleFavorite: (channelId: string) => void;
  isLoading: boolean;
  view: ViewState; // Resets search when the view changes
};

// Highlights the query match inside text
function HighlightMatch({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>;

  let parts: string[] = [];
  try {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    parts = text.split(new RegExp(`(${escaped})`, "gi"));
  } catch {
    return <>{text}</>;
  }

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-primary/25 text-primary not-italic rounded-sm">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function ChannelLogo({ name, color }: { name: string; color: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  const bgClass = `bg-[${color}]`;

  return (
    <div
      className={cn(
        "w-9 h-9 rounded-md flex items-center justify-center text-[11px] font-bold text-white shrink-0 shadow-sm",
        bgClass,
      )}
    >
      {initials}
    </div>
  );
}

export default function ChannelList({
  channels,
  currentChannel,
  onSelectChannel,
  favorites,
  onToggleFavorite,
  isLoading,
  view,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebounce(searchQuery, 180);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const prevViewRef = useRef(view);

  // Clear search whenever the view (category / favorites / all) changes
  useEffect(() => {
    if (prevViewRef.current !== view) {
      // eslint-disable-next-line
      setSearchQuery("");
      prevViewRef.current = view;
    }
  }, [view]);

  // Auto-scroll the active channel into view (after keyboard nav)
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentChannel?._id]);

  // Filter by debounced query across name, description, and channel number
  const displayChannels =
    debouncedQuery.trim() === ""
      ? channels
      : channels.filter((ch) => {
          const q = debouncedQuery.toLowerCase();
          return (
            ch.name.toLowerCase().includes(q) ||
            ch.description.toLowerCase().includes(q) ||
            String(ch.number).includes(q)
          );
        });

  // Keyboard navigation:
  //   ↑ / ↓  – switch channel immediately (TV-remote style)
  //   /       – focus the search box
  //   Esc     – clear search and blur
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const isSearchFocused = document.activeElement === searchRef.current;

      if (e.key === "Escape") {
        setSearchQuery("");
        searchRef.current?.blur();
        return;
      }

      // "/" focuses the search box (like GitHub / YouTube)
      if (e.key === "/" && !isSearchFocused) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
        return;
      }

      // Arrow keys work when search is NOT focused
      if (isSearchFocused) return;

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const currentIdx = displayChannels.findIndex(
          (ch) => ch._id === currentChannel?._id
        );
        const newIdx =
          e.key === "ArrowDown"
            ? Math.min(currentIdx + 1, displayChannels.length - 1)
            : Math.max(currentIdx - 1, 0);

        if (newIdx !== currentIdx) {
          const target = displayChannels[newIdx];
          if (target) onSelectChannel(target);
        }
      }
    },
    [displayChannels, currentChannel, onSelectChannel]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const isFiltering = debouncedQuery.trim() !== "";

  return (
    <div className="md:w-[280px] w-full shrink-0 md:h-full h-[40vh] md:border-r border-b border-border bg-card flex flex-col overflow-hidden">

      {/* Panel header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between shrink-0">
        <h2 className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">
          Channels
        </h2>
        {!isLoading && (
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {isFiltering ? (
              <>
                <span className="text-primary">{displayChannels.length}</span>
                <span className="text-muted-foreground/40"> / {channels.length}</span>
              </>
            ) : (
              channels.length
            )}
          </span>
        )}
      </div>

      {/* Search bar */}
      {!isLoading && (
        <div className="px-3 py-2 border-b border-border/50 shrink-0">
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 w-3.5 h-3.5 text-muted-foreground/35 pointer-events-none" />
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search… (press /)"
              className={cn(
                "w-full bg-muted/50 text-foreground text-[13px]",
                "pl-8 py-1.5 rounded-md border border-border/40",
                "placeholder:text-muted-foreground/30",
                "focus:outline-none focus:border-primary/40 focus:bg-muted/70",
                "transition-colors",
                searchQuery ? "pr-8" : "pr-3"
              )}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  searchRef.current?.focus();
                }}
                className="absolute right-2 text-muted-foreground/40 hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Scrollable channel list */}
      <div ref={listRef} className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-2 space-y-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton className="w-6 h-3 rounded shrink-0" />
                <Skeleton className="w-9 h-9 rounded-md shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-2.5 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : displayChannels.length === 0 ? (
          <div className="p-6">
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Tv />
                </EmptyMedia>
                <EmptyTitle>
                  {isFiltering ? "No results" : "No channels"}
                </EmptyTitle>
                <EmptyDescription>
                  {isFiltering
                    ? `Nothing matched "${debouncedQuery}"`
                    : "Nothing to show in this view"}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </div>
        ) : (
          displayChannels.map((channel) => {
            const isActive = currentChannel?._id === channel._id;
            const isFav = favorites.includes(channel._id);

            return (
              <div
                key={channel._id}
                data-active={isActive}
                onClick={() => onSelectChannel(channel)}
                className={cn(
                  "group relative flex items-center gap-3 px-3 py-2.5 cursor-pointer",
                  "border-b border-border/40 hover:bg-white/[0.04] transition-colors duration-100",
                  isActive && "bg-primary/10"
                )}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary rounded-r" />
                )}

                {/* Channel number */}
                <span className="text-[10px] text-muted-foreground/50 font-mono w-7 text-right shrink-0 tabular-nums">
                  {channel.number}
                </span>

                {/* Logo badge */}
                <ChannelLogo name={channel.name} color={channel.logoColor} />

                {/* Text info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span
                      className={cn(
                        "text-[13px] font-medium truncate leading-tight",
                        isActive ? "text-primary" : "text-foreground"
                      )}
                    >
                      <HighlightMatch text={channel.name} query={debouncedQuery} />
                    </span>
                    {channel.isLive && (
                      <span className="flex items-center gap-1 shrink-0 text-[8px] font-bold bg-red-600/90 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">
                        <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                        Live
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground/60 truncate leading-tight">
                    <HighlightMatch text={channel.description} query={debouncedQuery} />
                  </p>
                </div>

                {/* Favorite toggle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavorite(channel._id);
                  }}
                  title={isFav ? "Remove from favorites" : "Add to favorites"}
                  className={cn(
                    "shrink-0 p-1 rounded transition-all duration-150",
                    isFav
                      ? "text-yellow-400"
                      : "text-muted-foreground/40 opacity-0 group-hover:opacity-100"
                  )}
                >
                  <Heart
                    className="w-3.5 h-3.5"
                    fill={isFav ? "currentColor" : "none"}
                  />
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Keyboard shortcut hint */}
      {!isLoading && (
        <div className="px-4 py-2 border-t border-border/40 shrink-0">
          <p className="text-[9px] text-muted-foreground/25 text-center tracking-wider">
            ↑↓ switch &nbsp;·&nbsp; / search &nbsp;·&nbsp; Esc clear
          </p>
        </div>
      )}
    </div>
  );
}

