'use client';

import { useState } from 'react';
import { Message } from '@/types';

interface ChatMessageProps {
  message: Message;
  isVisible: boolean;
  index: number;
}

export function ChatMessage({ message, isVisible, index }: ChatMessageProps) {
  const [imageExpanded, setImageExpanded] = useState(false);

  if (!isVisible) return null;

  const isNarrator = message.senderType === 'NARRATOR';
  const isCharacter = message.senderType === 'CHARACTER';

  // Narrator messages - centered, different style
  if (isNarrator) {
    return (
      <div 
        className="message-bubble flex justify-center my-4 opacity-0"
        style={{ animationDelay: `${index * 100}ms` }}
      >
        <div className="bg-gradient-to-r from-muted/50 to-muted/30 rounded-xl px-6 py-3 max-w-[90%]">
          <p className="text-muted-foreground italic text-center text-sm">
            {message.content}
          </p>
          {message.media && (
            <div className="mt-2 flex justify-center">
              <img
                src={message.media.url}
                alt="Story image"
                className="max-h-64 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setImageExpanded(true)}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  // Character messages - chat bubble style
  return (
    <div 
      className={`message-bubble flex gap-3 my-3 opacity-0 animate-fade-in`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {message.avatar ? (
          <img
            src={message.avatar}
            alt={message.senderName}
            className="w-10 h-10 rounded-full object-cover border-2 border-white/10"
          />
        ) : (
          <div 
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm"
            style={{ backgroundColor: message.colorTheme || '#6366f1' }}
          >
            {message.senderName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0">
        {/* Sender name */}
        <p 
          className="text-xs font-medium mb-1"
          style={{ color: message.colorTheme || '#fff' }}
        >
          {message.senderName}
        </p>

        {/* Message bubble */}
        <div 
          className="rounded-2xl rounded-tl-sm px-4 py-3 inline-block max-w-[85%] text-white/95 shadow-sm"
          style={{ backgroundColor: message.colorTheme || '#6366f1' }}
        >
          <p className="text-sm md:text-base leading-relaxed">
            {message.content}
          </p>
        </div>

        {/* Media inside message */}
        {message.media && (
          <div className="mt-2 max-w-[85%]">
            <img
              src={message.media.url}
              alt="Story media"
              className="rounded-2xl max-h-48 w-auto object-cover cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setImageExpanded(true)}
            />
          </div>
        )}
      </div>

      {/* Expanded image modal */}
      {imageExpanded && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setImageExpanded(false)}
        >
          <img
            src={message.media?.url || ''}
            alt="Full size"
            className="max-h-[90vh] max-w-full object-contain rounded-lg"
          />
        </div>
      )}
    </div>
  );
}

// Typing indicator component
export function TypingIndicator({ colorTheme }: { colorTheme: string }) {
  return (
    <div className="flex gap-3 my-3">
      <div 
        className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{ backgroundColor: colorTheme }}
      >
        <div className="typing-indicator">
          <span style={{ backgroundColor: '#fff' }} />
          <span style={{ backgroundColor: '#fff' }} />
          <span style={{ backgroundColor: '#fff' }} />
        </div>
      </div>
      <div className="flex-1">
        <div 
          className="rounded-2xl px-3 py-2 inline-flex items-center gap-2"
          style={{ backgroundColor: colorTheme, opacity: 0.7 }}
        >
          <span className="text-white/80 text-sm">typing</span>
        </div>
      </div>
    </div>
  );
}

// Message reveal control
export interface RevealSettings {
  autoPlay: boolean;
  delayMultiplier: number; // 0.5 = 2x faster, 2.0 = 2x slower
}

export function MessageControls({
  settings,
  onChange,
}: {
  settings: RevealSettings;
  onChange: (s: RevealSettings) => void;
}) {
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-card/95 backdrop-blur-sm border border-border rounded-full px-4 py-2 shadow-lg">
      <button
        onClick={() => onChange({ ...settings, autoPlay: !settings.autoPlay })}
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
          settings.autoPlay ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
        }`}
      >
        {settings.autoPlay ? '⏸' : '▶'}
      </button>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Speed</span>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.5"
          value={settings.delayMultiplier}
          onChange={(e) => onChange({ ...settings, delayMultiplier: parseFloat(e.target.value) })}
          className="w-24 accent-primary"
        />
      </div>
    </div>
  );
}
