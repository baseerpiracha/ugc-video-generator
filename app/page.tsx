"use client";

import { useRef, useState } from 'react';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  videoUrl?: string;
  status?: string;
};

const examplePrompt = 'I’m building CalAI, a calorie-tracking app. Here’s the site: https://calai.app/';

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: 'Hey! I can create short UGC-style marketing videos for your product. Send me a product URL and I’ll get started.',
    },
  ]);
  const [input, setInput] = useState(examplePrompt);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('Ready');
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const handleSubmit = async () => {
    const rawValue = input.trim();
    if (!rawValue || isLoading) return;

    const userMessage: Message = { id: crypto.randomUUID(), role: 'user', text: rawValue };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setStatus('Thinking...');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: rawValue }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant', text: data.error || 'Something went wrong while generating the video.' },
        ]);
        setStatus('Failed');
        return;
      }

      const aiMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: data.reply || 'Your UGC video is ready.',
        videoUrl: data.videoUrl,
        status: data.status,
      };
      setMessages((prev) => [...prev, aiMessage]);
      setStatus(data.status || 'Complete');
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', text: 'I hit a temporary issue while generating your video. Please try again with a valid product URL.' },
      ]);
      setStatus('Error');
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      <header className="mb-6 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-soft backdrop-blur-sm">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-violet-300">UGC Video Generator</p>
          <h1 className="mt-1 text-lg font-semibold text-white">Product-to-video pipeline</h1>
        </div>
        <div className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
          {status}
        </div>
      </header>

      <div className="grid flex-1 gap-6 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="flex min-h-[620px] flex-col rounded-3xl border border-white/10 bg-slate-900/70 shadow-soft backdrop-blur-xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="text-sm font-medium text-slate-200">Conversation</span>
            </div>
            <span className="text-xs text-slate-400">URL → Video</span>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    message.role === 'user'
                      ? 'bg-violet-500 text-white'
                      : 'border border-white/10 bg-slate-800/90 text-slate-100'
                  }`}
                >
                  <div>{message.text}</div>
                  {message.videoUrl && (
                    <div className="mt-4 overflow-hidden rounded-xl border border-white/10 bg-slate-950">
                      <video className="aspect-[9/16] w-full object-cover" controls src={message.videoUrl} />
                    </div>
                  )}
                  {message.videoUrl && (
                    <a
                      href={message.videoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center rounded-full bg-violet-500/20 px-3 py-1 text-xs font-medium text-violet-100"
                    >
                      Open final video
                    </a>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-white/10 bg-slate-800/90 px-4 py-3 text-sm text-slate-200">
                  <span className="loading-dots inline-block min-w-[2.5rem]">Generating</span>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-white/10 p-4">
            <div className="flex gap-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                className="min-h-[96px] flex-1 resize-none rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-violet-400"
                placeholder="Paste a product URL or say hi..."
              />
              <button
                type="button"
                disabled={isLoading || !input.trim()}
                onClick={handleSubmit}
                className="w-28 rounded-2xl bg-violet-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
              >
                {isLoading ? 'Working' : 'Send'}
              </button>
            </div>
          </div>
        </section>

        <aside className="rounded-3xl border border-white/10 bg-slate-900/70 p-5 shadow-soft">
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-400">Creative brief</p>
          <div className="space-y-4 text-sm text-slate-300">
            <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-3">
              <p className="text-violet-100">Example input</p>
              <p className="mt-2 text-xs leading-6 text-slate-200">{examplePrompt}</p>
            </div>
            <div>
              <p className="font-medium text-white">What this does</p>
              <ul className="mt-2 space-y-2 text-slate-300">
                <li>• Detects the product URL in chat</li>
                <li>• Extracts product context from the public site</li>
                <li>• Builds a UGC concept and picks local assets</li>
                <li>• Renders a short vertical video with text + audio + GIF</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-white">Current mode</p>
              <p className="mt-2 text-slate-300">{status}</p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
