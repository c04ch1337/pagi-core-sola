
import React, { useState, useRef, useEffect } from 'react';
import { Mic, ArrowRight, User } from 'lucide-react';
import { Message, AgentEvent, ProjectContext as ProjectContextType } from '../types';
import { gemini } from '../services/geminiService';
import { mockBackend } from '../services/mockBackendService';
import type { RLMSummaryItem } from '../services/geminiService';
import ProjectContext from './ProjectContext';

interface ChatViewProps {
  onStatusChange: (status: 'active' | 'thinking') => void;
}

const JUDGMENTAL_WORDS = ['always', 'never', 'should', 'wrong', 'bad', 'lazy', 'stupid', 'unfair', 'must', 'ought', 'blame', 'fault'];

const ChatView: React.FC<ChatViewProps> = ({ onStatusChange }) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [reasoningText, setReasoningText] = useState<string | null>(null);
  const [mockConvergedText, setMockConvergedText] = useState<string | null>(null);
  const [activeProjects, setActiveProjects] = useState<ProjectContextType[]>([
    { id: '1', title: 'Registry Sync', description: '', isActive: true, category: 'KB_CORE' }
  ]);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mockConvergedRef = useRef<string | null>(null);

  const getUserAlias = (): string => {
    try {
      const s = localStorage.getItem('phoenix_config');
      const c = s ? JSON.parse(s) : {};
      return c.userAlias || 'User';
    } catch { return 'User'; }
  };
  const userAlias = getUserAlias();

  useEffect(() => {
    mockBackend.onEvent((event: AgentEvent) => {
      if (event.kind === 'thought') {
        setReasoningText(event.payload?.text ?? null);
      } else if (event.kind === 'converged') {
        const text = event.payload?.text ?? null;
        if (text) {
          setMockConvergedText(text);
          mockConvergedRef.current = text;
        }
        setReasoningText(null);
      }
    });
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const scrollToBottom = () => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, reasoningText]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;

    const currentInput = input;
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: currentInput,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    
    setIsStreaming(true);
    onStatusChange('thinking');

    setMockConvergedText(null);
    mockConvergedRef.current = null;

    const bridgeUrl = gemini.getBridgeUrl();
    const useRlm = bridgeUrl && (bridgeUrl.startsWith('http://') || bridgeUrl.startsWith('https://'));
    const useMockFromSettings = (() => {
      try {
        const s = localStorage.getItem('phoenix_config');
        const c = s ? JSON.parse(s) : {};
        return c.useMockModeForRlm === true;
      } catch { return false; }
    })();
    if (useMockFromSettings) mockBackend.simulateReasoning(currentInput);

    const assistantId = (Date.now() + 1).toString();
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '' }]);

    try {
      if (useRlm) {
        const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
        const savedConfig = (() => {
          try {
            const s = localStorage.getItem('phoenix_config');
            return s ? JSON.parse(s) : {};
          } catch { return {}; }
        })();
        const verticalUseCase = savedConfig.verticalUseCase ?? 'research';
        const flags = savedConfig.feature_flags ?? {};
        const feature_flags: Record<string, boolean> = {
          health: flags.personalHealth === true,
          finance: flags.personalFinance === true,
          social: flags.personalSocial === true,
          email: flags.personalEmail === true,
          calendar: flags.personalCalendar === true,
        };
        const summaries = await gemini.rlmMultiTurn({
          query: currentInput,
          context: lastAssistant?.content ?? '',
          depth: 0,
          max_turns: 5,
          vertical_use_case: verticalUseCase,
          feature_flags: Object.values(feature_flags).some(Boolean) ? feature_flags : undefined,
          mock_mode: savedConfig.useMockModeForRlm === true,  // false = force real RLM (structured/LLM) even if bridge has PAGI_MOCK_MODE=true
        });
        const parts: string[] = [];
        summaries.forEach((s: RLMSummaryItem, i: number) => {
          parts.push(`**Turn ${i + 1}**\n${s.summary}`);
          if (!s.converged && i === summaries.length - 1) parts.push('*Continuing...*');
        });
        const fullContent = parts.join('\n\n---\n\n');
        setMessages(prev =>
          prev.map(m => (m.id === assistantId ? { ...m, content: fullContent } : m))
        );
      } else {
        let fullContent = '';
        const stream = gemini.streamChat(
          currentInput,
          messages.map(m => ({ role: m.role, content: m.content }))
        );
        for await (const chunk of stream) {
          if (chunk) {
            fullContent += chunk;
            setMessages(prev =>
              prev.map(m => (m.id === assistantId ? { ...m, content: fullContent } : m))
            );
          }
        }
      }
    } catch (err) {
      const fallback = 'Inference sequence failed. Check bridge URL in Settings, ensure the bridge is running, and check the browser console for errors.';
      setMessages(prev =>
        prev.map(m => (m.id === assistantId ? { ...m, content: fallback } : m))
      );
      // Only show mock "Mock Mode" message as fallback when user has Mock Mode enabled in Settings.
      const useMockFallback = (() => {
        try {
          const s = localStorage.getItem('phoenix_config');
          const c = s ? JSON.parse(s) : {};
          return c.useMockModeForRlm === true;
        } catch { return false; }
      })();
      if (useMockFallback) {
        const checkMock = () => {
          const text = mockConvergedRef.current;
          if (text) {
            setMessages(prev => prev.map(m => (m.id === assistantId ? { ...m, content: text } : m)));
          }
        };
        setTimeout(checkMock, 100);
        setTimeout(checkMock, 2500);
      }
    } finally {
      setIsStreaming(false);
      onStatusChange('active');
    }
  };

  const Aura = () => (
    <div className="flex flex-col items-center justify-center pt-8 pb-12 aura-container">
      <div className={`relative w-16 h-16 transition-all duration-1000 ease-in-out`}>
        <div className={`absolute inset-0 rounded-full bg-emerald-400/20 blur-2xl transition-all duration-1000 ${isStreaming ? 'scale-150 animate-pulse opacity-100' : 'scale-100 opacity-0'}`} />
        <div className={`absolute inset-0 rounded-full border border-zinc-200 dark:border-zinc-800 flex items-center justify-center`}>
           <div className={`w-1.5 h-1.5 rounded-full ${isStreaming ? 'bg-blue-500 animate-ping shadow-[0_0_8px_rgba(59,130,246,0.8)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`} />
        </div>
      </div>
      {reasoningText && (
        <span className="text-[10px] font-mono text-blue-500 mt-4 animate-pulse uppercase tracking-widest">
          {reasoningText}
        </span>
      )}
    </div>
  );

  const NVCPreview = () => {
    if (!input.trim()) return null;
    const words = input.split(/(\s+)/);
    const hasJudgment = words.some(w => JUDGMENTAL_WORDS.includes(w.toLowerCase().replace(/[^\w]/g, '')));
    if (!hasJudgment) return null;

    return (
      <div className="absolute -top-10 left-0 right-0 px-3 py-1.5 bg-rose-50/90 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-900/50 rounded-lg text-[10px] text-rose-600 dark:text-rose-400 animate-in fade-in slide-in-from-bottom-1">
        <span className="font-black uppercase tracking-widest mr-2">System Warning:</span>
        Judgmental tone detected.
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full w-full chat-view relative bg-transparent">
      <div className="flex-1 overflow-y-auto no-scrollbar pt-12 pb-48 transcript max-w-3xl mx-auto w-full px-6">
        <Aura />

        {messages.length === 0 && (
          <div className="h-full flex flex-col justify-center items-center text-center py-20">
            <img src="/sola-logo.svg" alt="Sola Logo" className="h-12 w-12 mb-6 opacity-90" />
            <h2 className="text-2xl font-light text-zinc-500 dark:text-zinc-400 tracking-tight mb-2">
              Hi {userAlias}, how can I assist with your coding today?
            </h2>
            <p className="text-xs uppercase tracking-[0.4em] font-medium text-zinc-400 dark:text-zinc-500">Awaiting your input...</p>
          </div>
        )}

        <div className="space-y-16">
          {messages.map((msg) => (
            <div key={msg.id} className="animate-in fade-in slide-in-from-bottom-2 duration-700">
              <div className="flex items-center gap-3 mb-4 opacity-40">
                <div className="w-6 h-6 flex items-center justify-center rounded-md border border-zinc-200 dark:border-zinc-800 overflow-hidden shrink-0">
                  {msg.role === 'user' ? <User size={12} /> : <img src="/sola-logo.svg" alt="Sola Logo" className="h-4 w-4 object-contain" />}
                </div>
                <span className="text-[10px] uppercase tracking-[0.3em] font-black text-zinc-500">
                  {msg.role === 'user' ? userAlias : 'Sola'}
                </span>
              </div>
              <div className={`text-[15px] leading-relaxed prose dark:prose-invert max-w-none ${
                msg.role === 'user' ? 'text-zinc-900 dark:text-zinc-100 font-medium' : 'text-zinc-700 dark:text-zinc-300'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
        </div>
        <div ref={scrollRef} />
      </div>

      <div className="absolute bottom-10 left-0 right-0 px-6 input-area">
        <div className="max-w-2xl mx-auto relative input-container">
          <ProjectContext activeProjects={activeProjects} />
          <NVCPreview />
          <form 
            onSubmit={handleSubmit}
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl flex items-end p-2 transition-all focus-within:ring-4 focus-within:ring-emerald-500/5"
          >
            <button type="button" className="p-3 text-zinc-400 hover:text-emerald-500 transition-colors">
              <Mic size={18} />
            </button>
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={handleInput}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Query PAGI Core Sola bridge..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-[14px] py-3 px-2 resize-none max-h-48 no-scrollbar placeholder-zinc-400 dark:text-zinc-100"
            />
            <button 
              type="submit" 
              disabled={!input.trim() || isStreaming}
              className={`p-3 rounded-xl transition-all ${
                input.trim() && !isStreaming 
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900' 
                  : 'text-zinc-300'
              }`}
            >
              <ArrowRight size={18} strokeWidth={3} />
            </button>
          </form>
          <div className="mt-3 flex justify-center">
            <span className="text-[9px] uppercase tracking-[0.2em] text-zinc-400 font-bold opacity-50">
              Protocol: PAGI-V1 // Status: Encrypted
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatView;
