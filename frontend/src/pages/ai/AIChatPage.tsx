import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { chatApi } from '../../api/chat';
import { useAuth } from '../../auth/useAuth';
import { Message, Conversation, IntelligenceResponse } from '../../types';
import {
  Send,
  Plus,
  MessageSquare,
  Brain,
  Bot,
  Check,
  Copy,
  ChevronDown,
  ChevronRight,
  FileText,
  Database,
  AlertTriangle,
  TrendingUp,
  Trash2,
  Sparkles,
  Search,
  X,
  RotateCcw,
  Square,
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useNavigate } from 'react-router-dom';
import { Markdown } from '../../components/ui/markdown';
import { Button, IconButton } from '../../components/ui/button';
import { Drawer } from '../../components/ui/dialog';
import { useToast } from '../../components/ui/toast';

const FAILURE_PATTERNS = [
  "couldn't retrieve a matching record",
  "couldn't find a reliable matching record",
  "couldn't find reliable information",
  "couldn't find a matching record",
  "information is unavailable",
  'no relevant information',
  'no matching record',
];

/** True when a response represents a genuine retrieval failure (not a real answer). */
function isFailureAnswer(text: string | undefined | null): boolean {
  if (!text) return true;
  const lower = text.toLowerCase();
  return FAILURE_PATTERNS.some((p) => lower.includes(p));
}

/** A real answer exists when there is content that is not a retrieval-failure message. */
function hasRealAnswer(message: { answer?: string; content?: string }): boolean {
  const text = message.answer || message.content || '';
  return text.trim().length > 0 && !isFailureAnswer(text);
}

function Section({ title, icon: Icon, children, badge }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  badge?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border bg-card">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-full items-center gap-2 px-3 text-left transition-colors hover:bg-secondary/70 rounded-xl"
      >
        <Icon className="h-3.5 w-3.5 text-primary" />
        <span className="text-[13px] font-medium text-foreground">{title}</span>
        {badge && <span className="text-[11px] text-muted-foreground">{badge}</span>}
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </span>
      </button>
      {open && <div className="px-3 pb-3 pt-1">{children}</div>}
    </div>
  );
}

function IntelligencePanel({ intelligence }: { intelligence: IntelligenceResponse }) {
  // A real answer is required before showing any supporting panels.
  if (!hasRealAnswer(intelligence)) return null;
  if (intelligence.hasAnswer === false) return null;

  // Only a small, optional, expandable Sources section is shown. All other
  // internal details (confidence, key findings, agents, retrieval status) are
  // hidden so the AI answer remains the single source of truth.
  const hasSources = intelligence.sources && intelligence.sources.length > 0;
  if (!hasSources) return null;

  return (
    <div className="mt-3 animate-fade-in">
      <Section title="Sources" icon={FileText}>
        <div className="space-y-1">
          {intelligence.sources.slice(0, 8).map((s, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary/60">
              <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-secondary-foreground">{s.title}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <IconButton
      size="icon-sm"
      className="opacity-0 transition-opacity group-hover:opacity-100"
      aria-label="Copy response"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </IconButton>
  );
}

function MessageRow({
  message,
  isLatest,
  isStreaming,
  onRegenerate,
}: {
  message: Message;
  isLatest: boolean;
  isStreaming: boolean;
  onRegenerate?: () => void;
}) {
  const { user } = useAuth();
  const isUser = message.role === 'user';
  const hasIntelligence = !isUser && !!message.agentsUsed?.length;

  if (message._id === 'loading') {
    return (
      <div className="flex gap-3 message-enter">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-primary">
          <Bot className="h-3.5 w-3.5" />
        </div>
        <div className="mt-1 flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2.5">
          <Sparkles className="h-4 w-4 animate-spin text-primary" />
          <p className="mr-2 text-xs text-muted-foreground">Synthesizing intelligence response…</p>
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: '0ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: '150ms' }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end message-enter">
        <div className="max-w-[86%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm leading-relaxed text-primary-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  const body = message.answer || message.content;
  const isStreamingMsg = message._id.startsWith('streaming') || message._id.startsWith('tmp');
  const realAnswer = hasRealAnswer(message);

  return (
    <div className="group flex gap-3 message-enter">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg gradient-brand">
        <Brain className="h-3.5 w-3.5 text-white" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3">
          <div className={cn('md-body', isLatest && isStreamingMsg && 'streaming-caret')}>
            <Markdown content={body} />
          </div>
        </div>
        <div className="flex items-center gap-2 pl-1 pt-0.5">
          <CopyButton text={body} />
          {isLatest && !isStreaming && onRegenerate && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground opacity-0 group-hover:opacity-100"
              title="Regenerate AI response"
            >
              <RotateCcw className="h-3 w-3" /> Regenerate
            </button>
          )}
          {isLatest && (isStreaming || isStreamingMsg) && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Sparkles className="h-3 w-3 animate-spin text-primary" /> Streaming answer…
            </span>
          )}
        </div>
        {hasIntelligence && realAnswer && message.queryUnderstanding && (
          <IntelligencePanel
            intelligence={{
              queryId: '',
              answer: message.answer || '',
              summary: message.summary || '',
              keyFindings: message.keyFindings || [],
              evidence: message.evidence || [],
              sources: message.sources || [],
              citations: message.citations || [],
              confidence: message.confidence || 0,
              hasAnswer: message.hasAnswer,
              recommendations: message.recommendations || [],
              expectedImpact: message.expectedImpact || '',
              risks: message.risks || [],
              agentsUsed: message.agentsUsed || [],
              executionTimeMs: message.executionTimeMs || 0,
              queryUnderstanding: message.queryUnderstanding,
              subTasks: message.subTasks || [],
            }}
          />
        )}
      </div>
    </div>
  );
}

const SAMPLE_QUERIES = [
  { icon: Sparkles, text: 'What is artificial intelligence?' },
  { icon: AlertTriangle, text: 'How do I fix MongoDB connection error?' },
  { icon: TrendingUp, text: 'Why did sales decline in South India during Q2?' },
  { icon: Database, text: 'Write a Python program to reverse a string' },
];

export default function AIChatPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const prefill = searchParams.get('q');
    const conv = searchParams.get('conv');
    if (prefill) {
      setInputValue(prefill);
      setSearchParams({}, { replace: true });
      setTimeout(() => composerRef.current?.focus(), 100);
    } else if (conv) {
      setActiveConversationId(conv);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const { data: conversationsData } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => chatApi.getConversations(),
  });
  const conversations = conversationsData?.data?.data?.conversations || [];

  const { data: messagesData } = useQuery({
    queryKey: ['messages', activeConversationId],
    queryFn: () => chatApi.getConversationMessages(activeConversationId!),
    enabled: !!activeConversationId,
  });

  useEffect(() => {
    if (messagesData?.data?.data) {
      setMessages(messagesData.data.data.messages || []);
    }
  }, [messagesData]);

  const recentConversations = useMemo(
    () => [...conversations].sort((a, b) => (b.lastMessageAt || b.createdAt).localeCompare(a.lastMessageAt || a.createdAt)).slice(0, 8),
    [conversations]
  );

  const createConversationMutation = useMutation({
    mutationFn: (title?: string) => chatApi.createConversation(title),
    onSuccess: (res) => {
      const conv = res.data.data?.conversation;
      if (conv) {
        setActiveConversationId(conv._id);
        setMessages([]);
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
      }
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: (id: string) => chatApi.deleteConversation(id),
    onSuccess: () => {
      if (activeConversationId) {
        setActiveConversationId(null);
        setMessages([]);
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const abortRef = useRef(false);

  const streamMessageIntoState = (finalMsg: Message) => {
    const fullText = finalMsg.answer || finalMsg.content || '';
    if (!fullText) {
      setMessages((prev) => [...prev.filter((m) => !m._id.startsWith('tmp')), finalMsg]);
      setIsStreaming(false);
      return;
    }

    const tmpId = `streaming-${Date.now()}`;
    const chunkSize = Math.max(4, Math.floor(fullText.length / 35));
    let currentLen = 0;
    abortRef.current = false;

    setMessages((prev) => [
      ...prev.filter((m) => m._id !== 'loading' && !m._id.startsWith('tmp-assistant')),
      { ...finalMsg, _id: tmpId, answer: fullText.slice(0, chunkSize), content: fullText.slice(0, chunkSize) },
    ]);

    const interval = setInterval(() => {
      if (abortRef.current) {
        clearInterval(interval);
        setIsStreaming(false);
        abortRef.current = false;
        return;
      }
      currentLen += chunkSize;
      if (currentLen >= fullText.length) {
        clearInterval(interval);
        setMessages((prev) => [
          ...prev.filter((m) => m._id !== tmpId && m._id !== 'loading'),
          finalMsg,
        ]);
        setIsStreaming(false);
      } else {
        const partial = fullText.slice(0, currentLen);
        setMessages((prev) =>
          prev.map((m) => (m._id === tmpId ? { ...m, answer: partial, content: partial } : m))
        );
      }
    }, 20);
  };

  const sendMessageMutation = useMutation({
    mutationFn: ({ conversationId, content }: { conversationId: string; content: string }) =>
      chatApi.sendMessage(conversationId, content),
    onSuccess: (res) => {
      const msg = res.data.data?.message;
      if (msg) {
        streamMessageIntoState(msg);
      } else {
        setIsStreaming(false);
      }
      setSendError(null);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (err: unknown) => {
      setIsStreaming(false);
      setMessages((prev) => prev.filter((m) => !m._id.startsWith('tmp') && m._id !== 'loading'));
      const apiErr = err as { response?: { status?: number; data?: { message?: string } }; message?: string };
      const status = apiErr?.response?.status;
      let msg = apiErr?.response?.data?.message ?? apiErr?.message;

      if (status === 400) {
        msg = 'Please enter a valid question.';
      } else if (status === 401) {
        msg = 'Your session has expired. Please log in again.';
      } else if (status === 403) {
        msg = "You don't have permission to use AI Chat.";
      } else if (status === 429) {
        msg = 'The AI service is currently busy. Please try again shortly.';
      } else if (status === 500) {
        msg = 'The AI service encountered an error. Please try again.';
      } else if (!apiErr.response) {
        msg = 'Unable to connect to the AI server. Check your connection and try again.';
      }

      setSendError(msg || 'AI service is temporarily unavailable. Please try again.');
    },
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
    return () => clearTimeout(timer);
  }, [messages, isStreaming]);

  const handleStop = () => {
    abortRef.current = true;
    setIsStreaming(false);
    setMessages((prev) => prev.filter((m) => m._id !== 'loading' && !m._id.startsWith('streaming')));
  };

  const handleClear = () => {
    if (isStreaming) handleStop();
    setMessages([]);
  };

  const handleRegenerate = async () => {
    if (isStreaming || messages.length === 0) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
    if (!lastUserMsg) return;

    setMessages((prev) => {
      let lastUserIdx = -1;
      for (let i = prev.length - 1; i >= 0; i--) {
        if (prev[i].role === 'user') {
          lastUserIdx = i;
          break;
        }
      }
      if (lastUserIdx === -1) return prev;
      return [
        ...prev.slice(0, lastUserIdx + 1),
        { _id: 'loading', conversationId: activeConversationId || '', role: 'assistant', content: '', createdAt: new Date().toISOString() },
      ];
    });

    setSendError(null);
    setIsStreaming(true);
    sendMessageMutation.mutate({ conversationId: activeConversationId!, content: lastUserMsg.content });
  };

  const handleSend = async () => {
    const content = inputValue.trim();
    if (!content || isStreaming) return;

    let convId = activeConversationId;
    if (!convId) {
      const res = await createConversationMutation.mutateAsync(content.slice(0, 50));
      convId = res.data.data?.conversation._id || null;
      if (!convId) return;
    }

    const ts = Date.now();
    const userMsg: Message = {
      _id: `tmp-user-${ts}`, conversationId: convId,
      role: 'user', content, createdAt: new Date().toISOString(),
    };
    const loadingMsg: Message = {
      _id: 'loading', conversationId: convId,
      role: 'assistant', content: '', createdAt: new Date().toISOString(),
    };

    setSendError(null);
    setMessages((prev) => [...prev, userMsg, loadingMsg]);
    setInputValue('');
    setIsStreaming(true);
    sendMessageMutation.mutate({ conversationId: convId, content });
  };

  const onSelectConversation = (id: string) => {
    setActiveConversationId(id);
    setHistoryOpen(false);
  };

  const conversationList = (
    <>
      <div className="p-3">
        <Button
          className="w-full gap-1.5"
          variant="primary"
          onClick={(e) => {
            e.stopPropagation();
            createConversationMutation.mutate(undefined);
            setHistoryOpen(false);
          }}
        >
          <Plus className="h-4 w-4" /> New chat
        </Button>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {recentConversations.map((conv: Conversation) => (
          <div key={conv._id} className="group relative">
            <button
              onClick={() => onSelectConversation(conv._id)}
              className={cn(
                'w-full rounded-lg px-2.5 py-2 text-left transition-colors',
                activeConversationId === conv._id ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
              )}
            >
              <div className="flex items-start gap-2 pr-7">
                <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium leading-snug">{conv.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/70 tabular">
                    {new Date(conv.lastMessageAt || conv.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              </div>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (window.confirm('Delete this conversation?')) {
                  deleteConversationMutation.mutate(conv._id);
                  toast.info('Conversation deleted');
                }
              }}
              className="absolute right-1.5 top-1/2 hidden h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive group-hover:flex"
              title="Delete conversation"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
        {recentConversations.length === 0 && (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">No conversations yet</p>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-full min-h-0">
      {/* Conversation rail */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-border md:flex">
        {conversationList}
      </aside>

      {/* Mobile history */}
      <Drawer open={historyOpen} onOpenChange={setHistoryOpen} side="left">
        <div className="flex h-full flex-col">{conversationList}</div>
      </Drawer>

      {/* Main chat */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-4">
          <IconButton className="md:hidden" onClick={() => setHistoryOpen(true)} aria-label="Chat history">
            <Search className="h-4 w-4" />
          </IconButton>
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <p className="text-[13px] font-medium text-foreground">
              {activeConversationId ? 'Chat' : 'New chat'}
            </p>
          </div>
          <div className="flex-1" />
          {messages.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClear}
              className="text-xs text-muted-foreground hover:text-foreground"
              title="Clear conversation"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
          {activeConversationId && messages.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate('/reports', { state: { searchQuery: messages[0]?.content || 'AI Chat Thread', entities: [], kgRelationships: [], matchingDocuments: [] } })}
            >
              <FileText className="h-3.5 w-3.5" /> Report
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate('/agents')}
            className="hidden sm:inline-flex"
          >
            <Bot className="h-3.5 w-3.5" /> Agents
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-6">
            {messages.length === 0 ? (
              <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl gradient-brand shadow-card text-white">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold tracking-tight text-foreground">
                      What would you like to explore?
                    </h2>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      Ask technical questions, coding, general knowledge, or query enterprise databases.
                    </p>
                  </div>
                </div>
                <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
                  {SAMPLE_QUERIES.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => setInputValue(q.text)}
                      className="group flex items-start gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3 text-left transition-colors hover:bg-secondary"
                    >
                      <q.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                      <span className="text-[13px] text-secondary-foreground">{q.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((msg, i) => (
                  <MessageRow
                    key={msg._id}
                    message={msg}
                    isLatest={i === messages.length - 1}
                    isStreaming={isStreaming}
                    onRegenerate={handleRegenerate}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-border p-4">
          {sendError && (
            <div className="mx-auto mb-3 flex max-w-2xl items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/10 px-3.5 py-2 text-[13px] text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="flex-1">{sendError}</span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs text-destructive hover:bg-destructive/20"
                onClick={handleRegenerate}
              >
                <RotateCcw className="h-3 w-3 mr-1" /> Retry
              </Button>
              <IconButton size="icon-sm" aria-label="Dismiss" onClick={() => setSendError(null)}>
                <X className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          )}
          <div className="mx-auto max-w-2xl">
            <div className="flex items-end gap-2 rounded-2xl border border-border bg-card p-2 transition-colors focus-within:border-input focus-within:ring-2 focus-within:ring-ring/30">
              <textarea
                id="chat-input"
                ref={composerRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (isStreaming) {
                      handleStop();
                    } else {
                      handleSend();
                    }
                  }
                }}
                placeholder="Ask about your business, coding, troubleshooting, or data…"
                rows={1}
                className="max-h-40 min-h-[38px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                style={{ height: 'auto' }}
              />
              <Button
                size="icon"
                onClick={isStreaming ? handleStop : handleSend}
                disabled={!isStreaming && !inputValue.trim()}
                variant={isStreaming ? 'destructive' : 'primary'}
                aria-label={isStreaming ? 'Stop generation' : 'Send message'}
                title={isStreaming ? 'Stop generation' : 'Send message'}
              >
                {isStreaming ? (
                  <Square className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Enter to send · Shift+Enter for a new line · Multi-turn ChatGPT-style Assistant
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}