'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { storiesAPI } from '@/lib/api';
import { Story } from '@/types';
import { StoryCard } from '@/components/StoryCard';
import { CreditWallet } from '@/components/CreditWallet';

export default function Home() {
  const router = useRouter();
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<string>('all');

  useEffect(() => {
    fetchStories();
  }, []);

  const fetchStories = async () => {
    try {
      setLoading(true);
      const data = await storiesAPI.list();
      setStories(data.stories);
    } catch (err: any) {
      setError(err.message || 'Failed to load stories');
    } finally {
      setLoading(false);
    }
  };

  const filteredStories = selectedGenre === 'all'
    ? stories
    : stories.filter(s => s.genre === selectedGenre);

  const genres = ['all', ...Array.from(new Set(stories.map(s => s.genre)))];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">💬</span>
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              StoryChat
            </h1>
          </div>

          <CreditWallet />
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">
            Stories like you've never experienced
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Dive into immersive chat-based fiction. Every story unfolds like you're reading
            someone else's messages. From thrillers to romance - stories that keep you hooked.
          </p>
        </div>

        {/* Genre filter */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {genres.map(genre => (
            <button
              key={genre}
              onClick={() => setSelectedGenre(genre)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                selectedGenre === genre
                  ? 'bg-primary text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {genre === 'all' ? 'All Stories' : genre}
            </button>
          ))}
        </div>

        {/* Story grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[3/4] bg-muted rounded-2xl" />
                <div className="h-4 bg-muted rounded mt-4 w-3/4" />
                <div className="h-3 bg-muted rounded mt-2 w-1/2" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400 mb-4">{error}</p>
            <button
              onClick={fetchStories}
              className="px-4 py-2 bg-primary rounded-lg text-white"
            >
              Try Again
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredStories.map(story => (
                <StoryCard key={story.id} story={story} />
              ))}
            </div>

            {filteredStories.length === 0 && (
              <p className="text-center text-muted-foreground py-12">
                No stories found in this genre.
              </p>
            )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-16">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-sm text-muted-foreground">
          <p>© 2026 StoryChat. Built on Cloudflare.</p>
        </div>
      </footer>
    </div>
  );
}
