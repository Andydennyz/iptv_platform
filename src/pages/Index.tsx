import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Channel, Category } from "./index/_lib/types.ts";
import type { ViewState } from "./index/_lib/types.ts";
import Sidebar from "./index/_components/Sidebar.tsx";
import ChannelList from "./index/_components/ChannelList.tsx";
import VideoPlayer from "./index/_components/VideoPlayer.tsx";
import EpgGuide from "./index/_components/EpgGuide.tsx";

const FAVORITES_KEY = "streamtv-favorites";

function loadFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function persistFavorites(ids: string[]): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
}

export default function Index() {
  const categoriesQuery = useQuery<Category[], Error>({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetch("/api/categories");
      if (!res.ok) throw new Error(`Failed to load categories: ${res.status}`);
      return (await res.json()) as Category[];
    },
  });

  const allChannelsQuery = useQuery<Channel[], Error>({
    queryKey: ["channels"],
    queryFn: async () => {
      const res = await fetch("/api/channels");
      if (!res.ok) throw new Error(`Failed to load channels: ${res.status}`);
      return (await res.json()) as Channel[];
    },
  });

  const [view, setView] = useState<ViewState>("all");
  const [currentChannel, setCurrentChannel] = useState<Channel | null>(null);
  const [favorites, setFavorites] = useState<string[]>(loadFavorites);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const initializedRef = useRef(false);

  const categories = categoriesQuery.data ?? [];
  const allChannels = allChannelsQuery.data ?? [];

  // Seed program data eagerly so the EPG is ready when the user opens it
  useEffect(() => {
    void fetch("/api/programs/seed", { method: "POST" }).catch(() => {
      /* optional seed endpoint may not exist */
    });
  }, []);

  // Auto-select first channel once channels load
  useEffect(() => {
    if (allChannels && allChannels.length > 0 && !initializedRef.current) {
      // eslint-disable-next-line
      setCurrentChannel(allChannels[0]);
      initializedRef.current = true;
    }
  }, [allChannels]);

  const filteredChannels = useMemo(() => {
    if (view === "all") return allChannels;
    if (view === "favorites") return allChannels.filter((ch) => favorites.includes(ch._id));
    return allChannels.filter((ch) => ch.categoryId === view);
  }, [allChannels, view, favorites]);

  const toggleFavorite = (channelId: string) => {
    setFavorites((prev) => {
      const next = prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId];
      persistFavorites(next);
      return next;
    });
  };

  const isLoading = categoriesQuery.isLoading || allChannelsQuery.isLoading;

  return (
    <div className="flex flex-col md:flex-row h-screen overflow-hidden bg-background select-none">
      <Sidebar
        categories={categories ?? []}
        view={view}
        onSelectView={setView}
        isLoading={isLoading}
        favoritesCount={favorites.length}
      />
      {view === "epg" ? (
        <EpgGuide
          onSelectChannel={(channel) => {
            setCurrentChannel(channel);
            setView("all");
          }}
        />
      ) : (
        <div className="flex flex-1 min-h-0 md:flex-row flex-col overflow-hidden">
          <ChannelList
            channels={filteredChannels}
            currentChannel={currentChannel}
            onSelectChannel={setCurrentChannel}
            favorites={favorites}
            onToggleFavorite={toggleFavorite}
            isLoading={isLoading}
            view={view}
          />
          <VideoPlayer channel={currentChannel} isAppLoading={isLoading} />
        </div>
      )}
    </div>
  );
}

