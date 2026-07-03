import { create } from 'zustand';

interface ChatState {
  activeChannelId: string | null;
  setActiveChannelId: (channelId: string | null) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  activeChannelId: null,
  setActiveChannelId: (channelId) => set({ activeChannelId: channelId }),
}));
