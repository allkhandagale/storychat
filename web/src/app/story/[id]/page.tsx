'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Lock, Unlock } from 'lucide-react';

interface Chapter {
  id: string;
  chapter_number: number;
  title: string;
  credit_cost: number;
  unlocked: boolean;
}

export default function StoryDetailPage() {
  const { id } = useParams();
  const [story, setStory] = useState<any>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);

  useEffect(() => {
    // Demo data - replace with API call
    setStory({
      id,
      title: 'The Last Message',
      genre: 'Thriller',
      description: 'Sarah thought she was texting her brother. She was wrong.',
    });
    setChapters([
      { id: '1', chapter_number: 1, title: 'Wrong Number', credit_cost: 0, unlocked: true },
      { id: '2', chapter_number: 2, title: 'The Photo', credit_cost: 10, unlocked: false },
      { id: '3', chapter_number: 3, title: 'Midwest Meet', credit_cost: 10, unlocked: false },
      { id: '4', chapter_number: 4, title: 'The Truth', credit_cost: 10, unlocked: false },
    ]);
  }, [id]);

  if (!story) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen max-w-md mx-auto bg-gray-50">
      <header className="p-4 border-b bg-white sticky top-0">
        <Link href="/" className="flex items-center gap-2 text-sm">
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </header>

      <div className="p-4 bg-gradient-to-br from-purple-600 to-pink-600 text-white">
        <span className="text-xs px-2 py-1 bg-white/20 rounded-full">{story.genre}</span>
        <h1 className="text-2xl font-bold mt-2">{story.title}</h1>
        <p className="text-sm text-white/80 mt-2">{story.description}</p>
      </div>

      <div className="p-4">
        <h2 className="font-semibold mb-4">Chapters</h2>
        <div className="space-y-3">
          {chapters.map(ch => (
            <Link
              key={ch.id}
              href={ch.unlocked ? `/chat?story=${id}&chapter=${ch.id}` : '#'}
              className={`block p-4 bg-white rounded-xl border ${ch.unlocked ? 'hover:shadow-md' : 'opacity-70'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-400">Chapter {ch.chapter_number}</span>
                  <h3 className="font-medium">{ch.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {ch.unlocked ? (
                    <Unlock className="w-4 h-4 text-green-500" />
                  ) : (
                    <>
                      <span className="text-xs text-amber-500">{ch.credit_cost} credits</span>
                      <Lock className="w-4 h-4 text-gray-400" />
                    </>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
