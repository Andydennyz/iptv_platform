// Shared view state type for sidebar + channel filtering
export type ViewState = "all" | "favorites" | "epg" | string;

export type Category = {
  _id: string;
  name: string;
  icon: string;
};

export type Channel = {
  _id: string;
  name: string;
  description: string;
  number: number;
  categoryId: string;
  logoColor: string;
  isLive?: boolean;
  streamUrl: string;
};

export type Program = {
  _id: string;
  channelId: string;
  title: string;
  description: string;
  genre: string;
  rating: string;
  startTime: string;
  endTime: string;
};

export type EpgChannelRow = {
  channel: Channel;
  programs: Program[];
};

