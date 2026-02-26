'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { chaptersAPI, creditsAPI, chaptersAPI } from '@/lib/api';
import { ChapterWithMessages, Message } from '@/types';
import { ChatMessage, TypingIndicator, RevealSettings } from '@/components/ChatMessage';
import { CreditWallet, UnlockModal } from '@/components/CreditWallet';
import { MessageControls } from '@/components/ChatMessage';

export default function ChapterReader() {
  const router = useRouter();
  const params = useParams();
  const chapterId = params.id as string;

  const [chapter, setChapter] = useState<ChapterWithMessages | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [visibleCount, setVisibleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [credits, setCredits] = useState(50);

  const [unlockModal, setUnlockModal] = useState<{ chapterId: string; chapterTitle: string; cost: number } | null>(null);
  const [unlockLoading, setUnlockLoading] = useState(false);

  const [settings, setSettings] = useState<RevealSettings>({
    autoPlay: true,
    delayMultiplier: 1,
  });

  const [isTyping, setIsTyping] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chapterId) {
      loadChapter();
    }
  }, [chapterId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [visibleCount]);

  // Auto-advance messages
  useEffect(() => {
    if (!chapter || !settings.autoPlay) return;

    if (visibleCount < messages.length - 1) {
      const currentMessage = messages[visibleCount];
      const delay = (currentMessage.delaySeconds * 1000) / settings.delayMultiplier;

      setIsTyping(true);

      const timer = setTimeout(() => {
        setVisibleCount(prev => prev + 1);
        setIsTyping(false);
      }, delay + 500); // Add typing indicator time

      return () => clearTimeout(timer);
    }

    // Chapter complete
    if (visibleCount === messages.length - 1 && !isComplete) {
      setIsComplete(true);
      markComplete();
    }
  }, [visibleCount, messages, settings.autoPlay, chapter, isComplete, settings.delayMultiplier]);

  const loadChapter = async () => {
    try {
      setLoading(true);
      const data = await chaptersAPI.getMessages(chapterId);
      setChapter(data.chapter);
      setMessages(data.chapter.messages);

      // Start from last read or beginning
      const startIndex = data.chapter.progress.lastMessageRead || 0;
      setVisibleCount(startIndex);
    } catch (err: any) {
      if (err.message?.includes('Chapter locked') || err.error?.includes('locked')) {
        // Show unlock modal
        setUnlockModal({ chapterId, chapterTitle: '', cost: 10 });
      } else {
        setError(err.message || 'Failed to load chapter');
      }
    } finally {
      setLoading(false);
    }
  };

  const markComplete = async () => {
    try {
      await chaptersAPI.complete(chapterId);
    } catch (err) {
      console.error('Failed to mark complete:', err);
    }
  };

  const handleUnlock = async () => {
    if (!unlockModal) return;

    try {
      setUnlockLoading(true);
      const result = await creditsAPI.unlock(unlockModal.chapterId);
      setCredits(result.creditsRemaining);
      setUnlockModal(null);
      await loadChapter();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleManualAdvance = () => {
    if (visibleCount < messages.length - 1) {
      setVisibleCount(prev => prev + 1);
    }
  };

  const handleSkipToEnd = () => {
    setVisibleCount(messages.length - 1);
    setSettings(prev => ({ ...prev, autoPlay: false }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading chapter...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
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
            onClick={() => router.push(`/story/${chapter?.id.split('_')[0]} ?? '')}`)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <span>←</span>
            <span className="hidden sm:inline">Back to story</span>
          </button>

          <div className="flex-1 text-center px-4">
            <h1 className="text-lg font-semibold truncate">{chapter?.storyTitle}</h1>
            <p className="text-xs text-muted-foreground">Chapter {chapter?.chapterNumber}</p>
          </div>

          <CreditWallet balance={credits} onBalanceChange={setCredits} />
        </div>
      </header>

      {/* Reading area */}
      <div className="max-w-2xl mx-auto">
        <div
          ref={scrollRef}
          className="h-[calc(100vh-12rem)] overflow-y-auto px-4 py-6 space-y-2"
          onClick={handleManualAdvance}
        >
          {messages.map((msg, index) => (
            <ChatMessage
              key={msg.id}
              message={msg}
              isVisible={index <= visibleCount}
              index={index}
            />
          ))}

          {isTyping && (
            <div className="message-bubble opacity-0 animate-fade-in">
              <TypingIndicator
                colorTheme={
                  messages[visibleCount + 1]?.colorTheme || '#6366f1'
                }
              />
            </div>
          )}

          {/* Spacer */}
          <div className="h-20" />
        </div>

        {/* Controls */}
        <MessageControls
          settings={settings}
          onChange={setSettings}
        />

        {/* Progress */}
        <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t border-border">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {visibleCount + 1} / {messages.length} messages
              </span>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleSkipToEnd}
                  className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                >
                  Skip to end
                </button>
                <div className="w-32 h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${((visibleCount + 1) / messages.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unlock modal */}
      {unlockModal && (
        <UnlockModal
          chapterId={unlockModal.chapterId}
          chapterTitle={unlockModal.chapterTitle}
          cost={unlockModal.cost}
          balance={credits}
          onUnlock={handleUnlock}
          onClose={() => setUnlockModal(null)}
          isLoading={unlockLoading}
        />
      )}

      {/* Chapter complete celebration */}
      {isComplete && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-gradient-to-r from-primary to-secondary text-white px-6 py-3 rounded-full shadow-lg animate-fade-in">
          <span className="font-medium">🎉 Chapter Complete!</span>
        </div>
      )}
    </div>
  );
}
