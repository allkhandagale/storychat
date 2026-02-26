'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { storiesAPI, chaptersAPI, creditsAPI } from '@/lib/api';
import { Story, Chapter, Character } from '@/types';
import { CreditWallet, UnlockModal } from '@/components/CreditWallet';

export default function StoryDetail() {
  const router = useRouter();
  const params = useParams();
  const storyId = params.id as string;

  const [story, setStory] = useState<{
    id: string;
    title: string;
    genre: string;
    synopsis: string;
    coverImage: string | null;
    totalReads: number;
    characters: Character[];
    chapters: Chapter[];
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState(50); // Default demo amount

  // Unlock modal state
  const [unlockChapter, setUnlockChapter] = useState<Chapter | null>(null);
  const [unlockLoading, setUnlockLoading] = useState(false);

  useEffect(() => {
    if (storyId) {
      fetchStory();
    }
  }, [storyId]);

  const fetchStory = async () => {
    try {
      setLoading(true);
      const data = await storiesAPI.get(storyId);
      setStory(data.story);
    } catch (err: any) {
      setError(err.message || 'Failed to load story');
    } finally {
      setLoading(false);
    }
  };

  const handleChapterClick = (chapter: Chapter) => {
    if (chapter.unlocked || chapter.isFree) {
      router.push(`/chapter/${chapter.id}`);
    } else {
      setUnlockChapter(chapter);
    }
  };

  const handleUnlock = async () => {
    if (!unlockChapter) return;

    try {
      setUnlockLoading(true);
      const result = await creditsAPI.unlock(unlockChapter.id);
      setCredits(result.creditsRemaining);

      // Reload story to get updated unlock status
      await fetchStory();
      setUnlockChapter(null);

      // Navigate to chapter
      router.push(`/chapter/${unlockChapter.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUnlockLoading(false);
    }
  };

  const genreColors: Record<string, string> = {
    THRILLER: '#ef4444',
    ROMANCE: '#ec4899',
    SCIFI: '#06b6d4',
    DRAMA: '#f59e0b',
    MYSTERY: '#8b5cf6',
  };

  const genreLabel = story?.genre ? {
    THRILLER: 'Thriller',
    ROMANCE: 'Romance',
    SCIFI: 'Sci-Fi',
    DRAMA: 'Drama',
    MYSTERY: 'Mystery',
  }[story.genre] || story.genre : '';

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading story...</p>
        </div>
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error || 'Story not found'}</p>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-primary rounded-lg text-white"
          >
            Back to stories
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>←</span>
            <span>Back</span>
          </button>

          <CreditWallet balance={credits} onBalanceChange={setCredits} />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Story header */}
        <div className="flex flex-col md:flex-row gap-8 mb-12">
          {/* Cover */}
          <div className="w-full md:w-48 h-64 rounded-2xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
            {story.coverImage ? (
              <img
                src={story.coverImage}
                alt={story.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-6xl">📖</span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: `${genreColors[story.genre] || '#6366f1'}33`,
                  color: genreColors[story.genre] || '#6366f1'
                }}
              >
                {genreLabel}
              </span>
              <span className="text-sm text-muted-foreground flex items-center gap-1">
                <span>🔥</span>
                {story.totalReads.toLocaleString()} reads
              </span>
            </div>

            <h1 className="text-3xl font-bold mb-4">{story.title}</h1>
            <p className="text-muted-foreground leading-relaxed mb-6">
              {story.synopsis}
            </p>

            {/* Characters */}
            <div className="flex flex-wrap gap-3">
              <span className="text-sm text-muted-foreground">Characters:</span>
              {story.characters.filter(c => !c.isNarrator).map(char => (
                <div
                  key={char.id}
                  className="flex items-center gap-1 text-sm"
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ backgroundColor: char.colorTheme }}
                  >
                    {char.name.charAt(0)}
                  </span>
                  <span>{char.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Chapter list */}
        <div>
          <h2 className="text-xl font-bold mb-6">Chapters</h2>

          <div className="space-y-3">
            {story.chapters.map((chapter, index) => (
              <button
                key={chapter.id}
                onClick={() => handleChapterClick(chapter)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left ${
                  chapter.unlocked || chapter.isFree
                    ? 'border-border hover:border-primary/50 hover:bg-card/50'
                    : 'border-border/50 bg-muted/30 cursor-not-allowed'
                }`}
              >
                <span className="text-2xl font-bold text-muted-foreground w-8">
                  {chapter.chapterNumber}
                </span>

                <div className="flex-1">
                  <p className="font-medium">{chapter.title}</p>
                  {chapter.unlocked && (
                    <p className="text-xs text-muted-foreground">
                      {chapter.completed ? '✓ Completed' : 'Continue reading'}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {chapter.unlocked || chapter.isFree ? (
                    <span className="px-3 py-1 rounded-full bg-primary