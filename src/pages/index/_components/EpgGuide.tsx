import { useEffect, useRef, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Channel, Program, EpgChannelRow } from "../_lib/types.ts";
import { cn } from "@/libs/utils.ts";
import { motion, AnimatePresence } from "motion/react";
import { CalendarDays, Clock, Tv, X, Play } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Button } from "@/components/ui/button.tsx";

// ─── Layout constants ─────────────────────────────────────────────────────────
const PX_PER_MINUTE = 4;
const SLOT_MINUTES = 30;
const SLOT_WIDTH = SLOT_MINUTES * PX_PER_MINUTE; // 120px per 30-min slot
const CHANNEL_COL_WIDTH = 168;
const ROW_HEIGHT = 68;
const HEADER_HEIGHT = 40;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeToX(time: Date, origin: Date): number {
  return ((time.getTime() - origin.getTime()) / 60000) * PX_PER_MINUTE;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatTime(new Date(startTime))} – ${formatTime(new Date(endTime))}`;
}

function formatDuration(startTime: string, endTime: string): string {
  const mins = (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000;
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// Color map: genre → tailwind classes (dark-themed)
const GENRE_COLORS: Record<string, string> = {
  News: "bg-blue-950/70 border-blue-700/40 text-blue-200",
  Business: "bg-blue-950/70 border-blue-700/40 text-blue-200",
  Weather: "bg-sky-950/70 border-sky-700/40 text-sky-200",
  Sports: "bg-emerald-950/70 border-emerald-700/40 text-emerald-200",
  Football: "bg-emerald-950/70 border-emerald-700/40 text-emerald-200",
  Basketball: "bg-green-950/70 border-green-700/40 text-green-200",
  Soccer: "bg-teal-950/70 border-teal-700/40 text-teal-200",
  Tennis: "bg-cyan-950/70 border-cyan-700/40 text-cyan-200",
  Motorsport: "bg-orange-950/70 border-orange-700/40 text-orange-200",
  Golf: "bg-lime-950/70 border-lime-700/40 text-lime-200",
  Boxing: "bg-red-950/70 border-red-700/40 text-red-200",
  Olympics: "bg-yellow-950/70 border-yellow-700/40 text-yellow-200",
  Action: "bg-red-950/70 border-red-700/40 text-red-200",
  Classic: "bg-amber-950/70 border-amber-700/40 text-amber-200",
  "Sci-Fi": "bg-violet-950/70 border-violet-700/40 text-violet-200",
  Drama: "bg-purple-950/70 border-purple-700/40 text-purple-200",
  Comedy: "bg-yellow-950/70 border-yellow-700/40 text-yellow-200",
  Thriller: "bg-slate-900/70 border-slate-600/40 text-slate-200",
  Independent: "bg-neutral-900/70 border-neutral-600/40 text-neutral-200",
  Animation: "bg-pink-950/70 border-pink-700/40 text-pink-200",
  Concert: "bg-rose-950/70 border-rose-700/40 text-rose-200",
  Pop: "bg-fuchsia-950/70 border-fuchsia-700/40 text-fuchsia-200",
  Retro: "bg-amber-950/70 border-amber-700/40 text-amber-200",
  Music: "bg-rose-950/70 border-rose-700/40 text-rose-200",
  Acoustic: "bg-teal-950/70 border-teal-700/40 text-teal-200",
  Electronic: "bg-cyan-950/70 border-cyan-700/40 text-cyan-200",
  Festival: "bg-fuchsia-950/70 border-fuchsia-700/40 text-fuchsia-200",
  "Hip-Hop": "bg-orange-950/70 border-orange-700/40 text-orange-200",
  Talk: "bg-indigo-950/70 border-indigo-700/40 text-indigo-200",
  Entertainment: "bg-rose-950/70 border-rose-700/40 text-rose-200",
  Reality: "bg-pink-950/70 border-pink-700/40 text-pink-200",
  Awards: "bg-yellow-950/70 border-yellow-700/40 text-yellow-200",
  Variety: "bg-orange-950/70 border-orange-700/40 text-orange-200",
  Technology: "bg-cyan-950/70 border-cyan-700/40 text-cyan-200",
  General: "bg-zinc-900/70 border-zinc-700/40 text-zinc-300",
};

function getGenreColor(genre: string): string {
  return GENRE_COLORS[genre] ?? GENRE_COLORS["General"];
}

function cssSafeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}

// ─── Channel logo badge ───────────────────────────────────────────────────────
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
        "w-8 h-8 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0",
        bgClass,
      )}
    >
      {initials}
    </div>
  );
}

// ─── Main EpgGuide component ──────────────────────────────────────────────────
type Props = {
  onSelectChannel: (channel: Channel) => void;
};

export default function EpgGuide({ onSelectChannel }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const [selectedProgram, setSelectedProgram] = useState<{ program: Program; channel: Channel } | null>(null);

  // Tick every minute for the live "now" line
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Fixed window: computed once on mount (2 h before now, 6 h after)
  const [windowStart] = useState(() => {
    const d = new Date();
    d.setHours(d.getHours() - 2, 0, 0, 0);
    return d;
  });
  const windowEnd = useMemo(
    () => new Date(windowStart.getTime() + 8 * 60 * 60 * 1000),
    [windowStart],
  );

  const epgDataQuery = useQuery<EpgChannelRow[], Error>({
    queryKey: ["programs", windowStart.toISOString(), windowEnd.toISOString()],
    queryFn: async () => {
      const res = await fetch(
        `/api/programs?windowStart=${encodeURIComponent(windowStart.toISOString())}&windowEnd=${encodeURIComponent(windowEnd.toISOString())}`,
      );
      if (!res.ok) {
        throw new Error(`Failed to load EPG programs: ${res.status}`);
      }
      const data = (await res.json()) as EpgChannelRow[];
      return data;
    },
    staleTime: 30_000,
  });

  const epgData = epgDataQuery.data ?? [];
  const totalGridWidth = timeToX(windowEnd, windowStart);
  const nowX = timeToX(now, windowStart);

  // Time slot labels (every 30 min)
  const timeSlots = useMemo(() => {
    const slots: Date[] = [];
    const cursor = new Date(windowStart);
    while (cursor < windowEnd) {
      slots.push(new Date(cursor));
      cursor.setMinutes(cursor.getMinutes() + SLOT_MINUTES);
    }
    return slots;
  }, [windowStart, windowEnd]);

  // Auto-scroll to center "now" line on load
  useEffect(() => {
    if (!epgData || !scrollRef.current) return;
    const viewportWidth = scrollRef.current.clientWidth - CHANNEL_COL_WIDTH;
    scrollRef.current.scrollLeft = Math.max(0, nowX - viewportWidth / 3);
  }, [epgData, nowX]);

  function scrollToNow() {
    if (!scrollRef.current) return;
    const viewportWidth = scrollRef.current.clientWidth - CHANNEL_COL_WIDTH;
    scrollRef.current.scrollTo({ left: Math.max(0, nowX - viewportWidth / 3), behavior: "smooth" });
  }

  const nowStr = now.toISOString();

  const dynamicStyles = useMemo(() => {
    let css = `
      .epg-guide .epg-grid-inner { min-width: ${CHANNEL_COL_WIDTH + totalGridWidth}px; }
      .epg-guide .epg-header-row { height: ${HEADER_HEIGHT}px; }
      .epg-guide .epg-header-left { width: ${CHANNEL_COL_WIDTH}px; }
      .epg-guide .epg-time-track { width: ${totalGridWidth}px; }
      .epg-guide .epg-now-line { left: ${nowX}px; }
      .epg-guide .epg-row-height { height: ${ROW_HEIGHT}px; }
      .epg-guide .epg-row-timeline { width: ${totalGridWidth}px; height: ${ROW_HEIGHT}px; }
      .epg-guide .epg-channel-column { width: ${CHANNEL_COL_WIDTH}px; }
    `;

    timeSlots.forEach((slot, i) => {
      css += `.epg-guide .time-slot-${i} { left: ${timeToX(slot, windowStart)}px; width: ${SLOT_WIDTH}px; }\n`;
      css += `.epg-guide .time-slot-divider-${i} { left: ${timeToX(slot, windowStart)}px; }\n`;
    });

    if (epgData) {
      epgData.forEach(({ channel, programs }) => {
        const channelId = cssSafeId(channel._id);
        programs.forEach((prog) => {
          const progId = cssSafeId(prog._id);
          const left = timeToX(new Date(prog.startTime), windowStart);
          const right = timeToX(new Date(prog.endTime), windowStart);
          const width = Math.max(0, right - left - 2);
          const progress =
            prog.startTime <= nowStr && prog.endTime > nowStr
              ? (now.getTime() - new Date(prog.startTime).getTime()) /
                (new Date(prog.endTime).getTime() - new Date(prog.startTime).getTime())
              : 0;

          css += `.epg-guide .prog-${channelId}-${progId} { left: ${Math.max(0, left)}px; width: ${width}px; }\n`;
          css += `.epg-guide .prog-progress-${channelId}-${progId} { width: ${Math.min(100, Math.max(0, progress * 100))}%; }\n`;
        });
      });
    }

    return css;
  }, [timeSlots, windowStart, totalGridWidth, nowX, epgData, nowStr, now]);

  return (
    <div className="epg-guide flex-1 flex flex-col bg-background overflow-hidden min-w-0">
      {/* ── Header ── */}
      <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0 bg-card">
        <div className="flex items-center gap-2.5">
          <CalendarDays className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Program Guide</h2>
          <span className="text-[11px] text-muted-foreground">
            {now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
          </span>
        </div>
        <button
          onClick={scrollToNow}
          className="flex items-center gap-1.5 text-[11px] text-primary/70 hover:text-primary transition-colors px-3 py-1.5 rounded-md hover:bg-primary/10"
        >
          <Clock className="w-3.5 h-3.5" />
          Jump to Now
        </button>
      </div>

      {/* ── EPG Grid ── */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        <style>{dynamicStyles}</style>
        <div className="epg-grid-inner">

          {/* Sticky time-label header row */}
          <div
            className="epg-header-row sticky top-0 z-20 flex bg-card border-b border-border"
          >
            {/* Top-left corner (sticky on both axes) */}
            <div
              className="epg-header-left sticky left-0 z-30 bg-card border-r border-border shrink-0"
            />
            {/* Time labels */}
            <div className="relative flex-1 epg-time-track">
              {timeSlots.map((slot, i) => (
                <div
                  key={slot.toISOString()}
                  className={cn(
                    "absolute flex items-center pl-2.5 text-[10px] text-muted-foreground/60 font-mono border-l border-border/30 h-[40px]",
                    `time-slot-${i}`,
                  )}
                >
                  {formatTime(slot)}
                </div>
              ))}
              {/* Now marker tick in header */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary/70 z-10 epg-now-line"
              >
                <div className="absolute -top-0 -left-[3px] w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-primary/70" />
              </div>
            </div>
          </div>

          {/* Loading skeletons */}
          {epgData === undefined && (
            <div>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex border-b border-border/20 epg-row-height">
                  <div
                    className="sticky left-0 z-10 bg-card border-r border-border shrink-0 flex items-center gap-2.5 px-3 epg-channel-column"
                  >
                    <Skeleton className="w-8 h-8 rounded-md shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-2.5 w-1/2" />
                    </div>
                  </div>
                  <div
                    className="relative shrink-0 flex items-center gap-2 px-2 epg-row-timeline"
                  >
                    {[200, 120, 240, 160, 180].map((w, j) => (
                      <Skeleton key={j} className={`h-[48px] rounded-md shrink-0 w-[${w}px]`} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Channel rows */}
          {epgData?.map(({ channel, programs }) => (
            <div key={channel._id} className="flex border-b border-border/20 epg-row-height">

              {/* Sticky channel name column */}
              <button
                onClick={() => onSelectChannel(channel)}
                className="sticky left-0 z-10 bg-card border-r border-border shrink-0 flex items-center gap-2.5 px-3 hover:bg-white/[0.04] transition-colors cursor-pointer epg-channel-column"
              >
                <ChannelLogo name={channel.name} color={channel.logoColor} />
                <div className="min-w-0 text-left">
                  <p className="text-[12px] font-medium text-foreground truncate leading-tight">{channel.name}</p>
                  <p className="text-[10px] text-muted-foreground/50 font-mono">CH {channel.number}</p>
                </div>
              </button>

              {/* Program timeline */}
              <div
                className="relative shrink-0 epg-row-timeline"
              >
                {/* Vertical slot dividers */}
                {timeSlots.map((slot, i) => (
                  <div
                    key={slot.toISOString()}
                    className={`absolute top-0 bottom-0 w-px bg-border/15 time-slot-divider-${i}`}
                  />
                ))}

                {/* Now line in this row */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-primary/40 z-[5] pointer-events-none epg-now-line"
                />

                {/* Program blocks */}
                {programs.map((prog) => {
                  const left = timeToX(new Date(prog.startTime), windowStart);
                  const right = timeToX(new Date(prog.endTime), windowStart);
                  const width = right - left - 2;
                  if (width <= 8) return null;

                  const isPast = prog.endTime < nowStr;
                  const isCurrent = prog.startTime <= nowStr && prog.endTime > nowStr;
                  const isSelected = selectedProgram?.program._id === prog._id;

                  const progress = isCurrent
                    ? (now.getTime() - new Date(prog.startTime).getTime()) /
                      (new Date(prog.endTime).getTime() - new Date(prog.startTime).getTime())
                    : 0;

                  return (
                    <button
                      key={prog._id}
                      onClick={() => setSelectedProgram(isSelected ? null : { program: prog, channel })}
                      className={cn(
                        "absolute top-1.5 bottom-1.5 rounded-md border overflow-hidden",
                        "flex flex-col justify-start px-2 py-1.5 text-left transition-all duration-100",
                        getGenreColor(prog.genre),
                        isPast && "opacity-30",
                        isCurrent && "border-l-2 border-l-primary/70",
                        isSelected && "ring-1 ring-primary ring-offset-0",
                        !isPast && "hover:brightness-125",
                        `prog-${cssSafeId(channel._id)}-${cssSafeId(prog._id)}`,
                      )}
                    >
                      {/* Progress bar for currently airing */}
                      {isCurrent && (
                        <div
                          className={`absolute bottom-0 left-0 h-0.5 bg-primary/60 rounded-full prog-progress-${cssSafeId(channel._id)}-${cssSafeId(prog._id)}`}
                        />
                      )}
                      <p className="text-[11px] font-semibold leading-tight truncate">{prog.title}</p>
                      {width > 100 && (
                        <p className="text-[9px] opacity-50 mt-0.5 truncate font-mono">
                          {formatTime(new Date(prog.startTime))}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Empty state – no programs seeded yet */}
          {epgData.length === 0 && (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Tv className="w-12 h-12 text-muted-foreground/20" />
              <p className="text-muted-foreground/40 text-sm">No program data available</p>
            </div>
          )}

        </div>
      </div>

      {/* ── Selected Program Detail Panel ── */}
      <AnimatePresence>
        {selectedProgram && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="shrink-0 border-t border-border bg-card px-5 py-4"
          >
            <div className="flex items-start gap-4">
              {/* Genre color bar */}
              <div
                className={cn(
                  "w-1 self-stretch rounded-full shrink-0",
                  "bg-primary/60",
                )}
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-primary/60">
                    {selectedProgram.program.genre}
                  </span>
                  {selectedProgram.program.startTime <= nowStr && selectedProgram.program.endTime > nowStr && (
                    <span className="flex items-center gap-1 text-[8px] font-bold bg-red-600/90 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">
                      <span className="w-1 h-1 rounded-full bg-white animate-pulse" />
                      On Now
                    </span>
                  )}
                </div>
                <h3 className="text-base font-bold text-foreground leading-tight mb-1 truncate">
                  {selectedProgram.program.title}
                </h3>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60 mb-2">
                  <span>{selectedProgram.channel.name} · CH {selectedProgram.channel.number}</span>
                  <span>·</span>
                  <span>{formatTimeRange(selectedProgram.program.startTime, selectedProgram.program.endTime)}</span>
                  <span>·</span>
                  <span>{formatDuration(selectedProgram.program.startTime, selectedProgram.program.endTime)}</span>
                </div>
                <p className="text-[12px] text-muted-foreground/70 leading-relaxed line-clamp-2">
                  {selectedProgram.program.description}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0 pt-1">
                <Button
                  size="sm"
                  onClick={() => {
                    onSelectChannel(selectedProgram.channel);
                    setSelectedProgram(null);
                  }}
                  className="gap-1.5 text-xs h-8"
                >
                  <Play className="w-3 h-3" />
                  Watch
                </Button>
                <button
                  onClick={() => setSelectedProgram(null)}
                  className="text-muted-foreground/40 hover:text-foreground transition-colors p-1"
                  aria-label="Close program details"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

