'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, Lock } from 'lucide-react';
import Link from 'next/link';

interface Message {
  id: string;
  type: 'character' | 'narrator' | 'photo';
  sender: string;
  content: string;
  photo_url?: string;
  delay_ms: number;
}

export default function ChatPage() {
  const searchParams = useSearchParams();
  const storyId = searchParams.get('story');
  const chapterId = searchParams.get('chapter');
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [showUnlock, setShowUnlock] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Demo messages for first chapter
  const demoMessages: Message[] = [
    { id: '1', type: 'character', sender: 'Sarah', content: 'Hey, are you still at work?', delay_ms: 1500 },
    { id: '2', type: 'character', sender: 'Unknown', content: 'Sarah, listen carefully.', delay_ms: 2500 },
    { id: '3', type: 'character', sender: 'Sarah', content: 'Who is this? This is David\'s number.', delay_ms: 2000 },
    { id: '4', type: 'narrator', sender: 'Narrator', content: 'The typing dots appear. Stop. Start. Stop again.', delay_ms: 3000 },
    { id: '5', type: 'character', sender: 'Unknown', content: 'David is in the hospital. You need to check your email. Now.', delay_ms: 4000 },
    { id: '6', type: 'character', sender: 'Sarah', content: 'This isn\'t funny. I\'m calling the police.', delay_ms: 2500 },
    { id: '7', type: 'photo', sender: 'Unknown', content: 'Photo received', photo_url: '/assets/hospital.jpg', delay_ms: 3000 },
    { id: '8', type: 'narrator', sender: 'Narrator', content: 'It\'s David. Unconscious. The timestamp says 9:47 PM. Two minutes ago.', delay_ms: 4000 },
  ];

  useEffect(() => {
    setMessages(demoMessages);
    autoRevealMessages(demoMessages.length);
  }, [storyId, chapterId]);

  const autoRevealMessages = (total: number) => {
    let current = 0;
    const reveal = () => {
      if (current < total) {
        setVisibleCount(current + 1);
        current++;
        setTimeout(reveal, demoMessages[current - 1]?.delay_ms || 1500);
      } else {
        setShowUnlock(true);
      }
    };
    reveal();
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleCount]);

  return (
    <div className="min-h-screen max-w-md mx-auto bg-gray-100 flex flex-col">
      <header className="p-4 bg-white border-b flex items-center gap-2 sticky top-0 z-10">
        <Link href={`/story/${storyId}`}>
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="font-semibold">Chapter 1</h1>
          <p className="text-xs text-gray-500">Wrong Number</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.slice(0, visibleCount).map((msg, i) => (
          <div key={msg.id} className={msg.type === 'narrator' ? 'text-center text-gray-400 text-sm italic my-4' : msg.sender === 'Sarah' ? 'ml-12' : 'mr-12'}>
            {msg.type === 'narrator' ? (
              <span>{msg.content}</span>
            ) : msg.type === 'photo' ? (
              <div className={`rounded-2xl p-3 ${msg.sender === 'Sarah' ? 'bg-blue-500 text-white ml-auto' : 'bg-white shadow-sm'}`}>
                <img src={msg.photo_url} alt="photo" className="max-w-full rounded-lg" />
              </div>
            ) : (
              <div className={`rounded-2xl p-3 max-w-xs ${msg.sender === 'Sarah' ? 'bg-blue-500 text-white ml-auto' : 'bg-white shadow-sm'}`}>
                <p className="text-xs opacity-70 mb-1">{msg.sender}</p>
                <p>{msg.content}</p>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
        
        {showUnlock && (
          <div className="text-center p-4">
            <div className="p-4 bg-amber-100 rounded-xl">
              <Lock className="w-8 h-8 mx-auto mb-2 text-amber-600" />
              <p className="text-sm">Continue to Chapter 2?</p>
              <p className="text-xs text-gray-500 mt-1">10 credits</p>
              <button className="mt-3 px-6 py-2 bg-amber-500 text-white rounded-full font-medium">
                Unlock Now
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
