'use client';

import { useRouter } from 'next/navigation';
import { Story } from '@/types';

interface StoryCardProps {
  story: Story;
  onClick?: () => void;
}

const genreColors: Record<string, string> = {
  THRILLER: '#ef4444',
  ROMANCE: '#ec4899',
  SCIFI: '#06b6d4',
  DRAMA: '#f59e0b',
  MYSTERY: '#8b5cf6',
};

const genreLabels: Record<string, string> = {
  THRILLER: 'Thriller',
  ROMANCE: 'Romance',
  SCIFI: 'Sci-Fi',
  DRAMA: 'Drama',
  MYSTERY: 'Mystery',
};

export function StoryCard({ story, onClick }: StoryCardProps) {
  const router = useRouter();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      router.push(`/story/${story.id}`);
    }
  };

  const genreColor = genreColors[story.genre] || '#6366f1';

  return (
    <div
      onClick={handleClick}
      className="group cursor-pointer bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
    >
      {/* Cover image */}
      <div className="relative aspect-[3/4] bg-gradient-to-br from-card to-muted overflow-hidden">
        {story.coverImage ? (
          <img
            src={story.coverImage}
            alt={story.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-secondary/20">
            <span className="text-6xl">📖</span>
          </div>
        )}

        {/* Genre badge */}
        <div
          className="absolute top-3 left-3 px-3 py-1 rounded-full text-xs font-semibold"
          style={{ backgroundColor: `${genreColor}33`, color: genreColor }}
        >
          {genreLabels[story.genre] || story.genre}
        </div>

        {/* Read count */}
        <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 backdrop-blur-sm text-white text-xs">
          <span>🔥</span>
          <span>{story.totalReads.toLocaleString()}</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-lg mb-2 line-clamp-1 group-hover:text-primary transition-colors">
          {story.title}
        </h3>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {story.synopsis}
        </p>

        {/* Progress / chapters */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>📚</span>
            <span>{story.chapterCount} chapters</span>
          </div>

          {story.unlockedChapterCount && story.unlockedChapterCount > 0 ? (
            <span className="text-xs text-green-400">
              {story.unlockedChapterCount} unlocked
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {story.isFree ? 'Free to start' : ''}
            </span>
          )}
        </div>

        {/* Progress bar for started stories */}
        {story.started && (
          <div className="mt-3">
            <div className="h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${(story.lastMessageRead || 0) * 10}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
