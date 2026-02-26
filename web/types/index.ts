// StoryChat TypeScript Types

export interface User {
  id: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  subscriptionTier: 'free' | 'premium';
}

export interface Story {
  id: string;
  title: string;
  genre: string;
  synopsis: string;
  coverImage: string | null;
  totalReads: number;
  chapterCount: number;
  unlockedChapterCount?: number;
  started?: boolean;
  lastMessageRead?: number;
}

export interface Character {
  id: string;
  name: string;
  avatar: string | null;
  colorTheme: string;
  isNarrator: boolean;
}

export interface Chapter {
  id: string;
  chapterNumber: number;
  title: string;
  isFree: boolean;
  unlockCost: number;
  totalReads: number;
  unlocked: boolean;
  unlockedAt?: string;
  completed: boolean;
  lastMessageRead: number;
}

export interface Message {
  id: string;
  sequenceIndex: number;
  senderType: 'CHARACTER' | 'NARRATOR';
  senderName: string;
  colorTheme: string;
  avatar: string | null;
  content: string;
  media: Media | null;
  delaySeconds: number;
}

export interface Media {
  url: string;
  type: 'image' | 'video';
}

export interface ChapterWithMessages {
  id: string;
  chapterNumber: number;
  storyTitle: string;
  totalReads: number;
  messages: Message[];
  messageCount: number;
  progress: {
    lastMessageRead: number;
    completed: boolean;
  };
}

export interface CreditTransaction {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  storyId?: string;
  chapterId?: string;
  reason?: string;
  timestamp: string;
}

export interface CreditBalance {
  balance: number;
  recentTransactions: CreditTransaction[];
}

export interface UnlockResult {
  success: boolean;
  message?: string;
  totalCost: number;
  creditsRemaining: number;
}
