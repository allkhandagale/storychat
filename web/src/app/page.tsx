'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, CreditCard, User } from 'lucide-react';

interface Story {
  id: string;
  title: string;
  genre: string;
  description: string;
  chapter_count: number;
  unlocked_chapters: number;
}

export default function HomePage() {
  const [stories, setStories] = useState<Story[]>([]);
  const [credits, setCredits] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://storychat-api.three-neon-breezes.workers.dev/api/stories')
      .then(r => r.json())
      .then(data => {
        setStories(data.data || []);
        setLoading(false);
      })
      .catch(() => {
        // Demo data fallback
        setStories([
          { id: '1', title: 'The Last Message', genre: 'Thriller', description: 'A text that changes everything.', chapter_count: 4, unlocked_chapters: 1 },
          { id: '2', title: 'Love, Maybe', genre: 'Romance', description: 'The dating app matched them again.', chapter_count: 4, unlocked_chapters: 1 },
          { id: '3', title: 'Midnight Confessions', genre: 'Drama', description: 'Group chat at 3 AM.', chapter_count: 4, unlocked_chapters: 1 },
          { id: '4', title: 'Starship Omega', genre: 'Sci-Fi', description: 'The AI woke up.', chapter_count: 4, unlocked_chapters: 1 },
        ]);
        setCredits(50);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="p-8">Loading stories...</div>;

  return (
    <div className="min-h-screen max-w-md mx-auto">
      <header className="p-4 border-b bg-white sticky top-0">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">StoryChat</h1>
          <div className="flex items-center gap-2 text-sm">
            <CreditCard className="w-4 h-4" />
            <span>{credits} credits</span>
            <User className="w-4 h-4 ml-2" />
          </div>
        </div>
      </header>

      <main className="p-4">
        <h2 className="text-lg font-semibold mb-4">Featured Stories</h2>
        <div className="space-y-4">
          {stories.map(story => (
            <Link
              key={story.id}
              href={`/story/${story.id}`}
              className="block p-4 bg-white rounded-xl border hover:shadow-md transition"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold">{story.title}</h3>
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded-full">{story.genre}</span>
                  <p className="text-sm text-gray-500 mt-1">{story.description}</p>
                  <div className="flex gap-2 mt-2 text-xs text-gray-400">
                    <span>Ch. {story.unlocked_chapters || 1}/{story.chapter_count} unlocked</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
