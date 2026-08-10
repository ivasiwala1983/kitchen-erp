'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTenant } from '../../../../contexts/TenantContext';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  code?: string;
  userMessage?: string;
  dataSources?: string[];
  quickActions?: Array<{ label: string; route: string }>;
}

const SUGGESTED_QUESTIONS = [
  { category: 'Purchases', text: 'What did we purchase this month?' },
  { category: 'Purchases', text: 'Which vendor did we spend the most with?' },
  { category: 'Ledger', text: 'How much do we currently owe vendors?' },
  { category: 'Ledger', text: 'What are our outstanding vendor balances?' },
  { category: 'Inventory', text: 'Which items are running low?' },
  { category: 'Reports', text: 'Show dashboard overview stats.' },
];

export default function ArgusOneAssistantPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceParam = (searchParams.get('source') || '').toLowerCase().trim();

  const { user, tenantSlug, api, isLoading } = useTenant();

  const [inputMessage, setInputMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/t/${tenantSlug}/login`);
    }
  }, [user, isLoading, tenantSlug, router]);

  useEffect(() => {
    if (sourceParam === 'purchases') setSelectedCategory('Purchases');
    else if (sourceParam === 'inventory') setSelectedCategory('Inventory');
    else if (sourceParam === 'vendors' || sourceParam === 'ledger') setSelectedCategory('Ledger');
    else if (sourceParam === 'reports') setSelectedCategory('Reports');
  }, [sourceParam]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isProcessing]);

  const contextGreeting = useMemo(() => {
    if (sourceParam === 'purchases') {
      return {
        title: '👋 Need help with purchases?',
        body: 'I can help you understand spending, recent purchases, vendor-wise purchases, or compare periods.',
      };
    }
    if (sourceParam === 'inventory') {
      return {
        title: "👋 Let's look at your inventory.",
        body: 'I can help you find low-stock items, current stock, or inventory trends.',
      };
    }
    if (sourceParam === 'vendors') {
      return {
        title: '👋 I can help you explore your vendors.',
        body: 'I can answer questions about vendor spending, payment history, and active suppliers.',
      };
    }
    if (sourceParam === 'ledger') {
      return {
        title: "👋 Let's take a look at your ledger.",
        body: 'I can help with balances, outstanding amounts and recent activity.',
      };
    }
    if (sourceParam === 'reports') {
      return {
        title: '👋 Let’s analyze your reports.',
        body: 'I can help you understand this report and explore the numbers behind it.',
      };
    }
    return {
      title: `👋 Good day, ${user?.name || 'there'}!`,
      body: 'I am ArgusOne Assistant, your read-only business operations companion. Ask me anything about purchases, vendors, inventory, ledger, or reports.',
    };
  }, [sourceParam, user?.name]);

  const filteredQuestions = useMemo(() => {
    if (selectedCategory === 'ALL') return SUGGESTED_QUESTIONS;
    return SUGGESTED_QUESTIONS.filter((q) => q.category === selectedCategory);
  }, [selectedCategory]);

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim();
    if (!query || isProcessing) return;

    const userMsgId = `msg-${Date.now()}`;
    const newMessages: ChatMessage[] = [
      ...messages,
      { id: userMsgId, role: 'user', content: query },
    ];

    setMessages(newMessages);
    setInputMessage('');
    setIsProcessing(true);

    try {
      // Build conversation history format for API payload
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await api.ai.chat(query, historyPayload);
      const data = res.data;

      const aiContent =
        data?.code === 'AI_RATE_LIMITED' && data?.userMessage
          ? data.userMessage
          : data?.userMessage ||
            data?.message ||
            'I have analyzed your query based on current data.';

      setMessages((prev) => [
        ...prev,
        {
          id: `msg-ai-${Date.now()}`,
          role: 'assistant',
          content: aiContent,
          code: data?.code,
          userMessage: data?.userMessage,
          dataSources: data?.dataSources || [],
          quickActions: data?.quickActions || [],
        },
      ]);
    } catch (err: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg-err-${Date.now()}`,
          role: 'assistant',
          content:
            "☕ My AI coffee is finished!\n\nI've reached today's free AI limit.\n\nDon't worry — your ArgusOne data is safe. I'll be back when my AI energy refills. 🤖",
          code: 'AI_RATE_LIMITED',
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoading || !user) {
    return null;
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        maxWidth: 600,
        margin: '0 auto',
        background: '#0f172a',
        color: '#f8fafc',
        fontFamily: 'var(--font-sans, system-ui, -apple-system, sans-serif)',
      }}
    >
      {/* ── Top Navigation Header ──────────────────────────────────────── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          padding: '1rem 1.25rem',
          background: '#1e293b',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <button
          onClick={() => router.back()}
          type="button"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'rgba(255, 255, 255, 0.08)',
            color: '#f8fafc',
            border: 'none',
            fontSize: '1.2rem',
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          ←
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.25rem' }}>🤖</span>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#f8fafc' }}>
              ArgusOne Assistant
            </h1>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
            Business Operations Intelligence
          </div>
        </div>
      </header>

      {/* ── Chat Content & Scroll Area ─────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        {/* Context-Aware Welcome Card & Prompt Suggestions */}
        {messages.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div
              style={{
                background: 'linear-gradient(135deg, #1e293b, #334155)',
                padding: '1.25rem',
                borderRadius: 16,
                border: '1px solid rgba(56, 189, 248, 0.3)',
                boxShadow: '0 8px 24px rgba(15, 23, 42, 0.3)',
              }}
            >
              <h2
                style={{
                  fontSize: '1.1rem',
                  fontWeight: 800,
                  margin: '0 0 0.5rem 0',
                  color: '#38bdf8',
                }}
              >
                {contextGreeting.title}
              </h2>
              <p style={{ fontSize: '0.875rem', color: '#cbd5e1', margin: 0, lineHeight: 1.5 }}>
                {contextGreeting.body}
              </p>
            </div>

            {/* Category Filter Chips */}
            <div>
              <div
                style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: '#64748b',
                  marginBottom: '0.5rem',
                }}
              >
                Explore Topics
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.4rem',
                  marginBottom: '0.75rem',
                }}
              >
                {['ALL', 'Purchases', 'Ledger', 'Inventory', 'Reports'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    type="button"
                    style={{
                      padding: '0.3rem 0.75rem',
                      borderRadius: 20,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      border:
                        selectedCategory === cat
                          ? '1px solid #38bdf8'
                          : '1px solid rgba(255,255,255,0.1)',
                      background:
                        selectedCategory === cat
                          ? 'rgba(56, 189, 248, 0.2)'
                          : 'rgba(255,255,255,0.05)',
                      color: selectedCategory === cat ? '#38bdf8' : '#94a3b8',
                      cursor: 'pointer',
                    }}
                  >
                    {cat === 'ALL' ? 'All Topics' : cat}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {filteredQuestions.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(item.text)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      padding: '0.875rem 1rem',
                      borderRadius: 12,
                      background: '#1e293b',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      color: '#f8fafc',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                      transition: 'background 0.2s',
                    }}
                  >
                    <span>{item.text}</span>
                    <span
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.15rem 0.4rem',
                        borderRadius: 6,
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: '#38bdf8',
                        fontWeight: 700,
                      }}
                    >
                      {item.category}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Message Thread */}
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
              gap: '0.35rem',
            }}
          >
            {msg.code === 'AI_RATE_LIMITED' ? (
              /* Dedicated Humorous Free-Limit Fallback Card */
              <div
                style={{
                  maxWidth: '92%',
                  padding: '1.25rem',
                  borderRadius: '16px 16px 16px 4px',
                  background: 'linear-gradient(135deg, #1e293b, #0f172a)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  boxShadow: '0 8px 24px rgba(15, 23, 42, 0.4)',
                  color: '#f8fafc',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginBottom: '0.75rem',
                  }}
                >
                  <span style={{ fontSize: '1.4rem' }}>🤖</span>
                  <span style={{ fontWeight: 800, color: '#38bdf8', fontSize: '0.95rem' }}>
                    ArgusOne Assistant
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '0.9rem',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    marginBottom: '1rem',
                    color: '#e2e8f0',
                  }}
                >
                  {msg.content}
                </div>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    borderRadius: 12,
                    padding: '0.75rem 1rem',
                    fontSize: '0.8rem',
                    color: '#94a3b8',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.35rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div>✅ ArgusOne application is fully operational</div>
                  <div>🔒 Your business data is completely safe</div>
                  <div>☕ AI will refresh when free quota resets</div>
                </div>
                <Link
                  href={`/t/${tenantSlug}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: 10,
                    background: '#0284c7',
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.875rem',
                    textDecoration: 'none',
                    textAlign: 'center',
                  }}
                >
                  Back to ArgusOne Dashboard
                </Link>
              </div>
            ) : (
              /* Standard Message Bubble */
              <div
                style={{
                  maxWidth: '88%',
                  padding: '0.875rem 1.1rem',
                  borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background:
                    msg.role === 'user' ? 'linear-gradient(135deg, #0284c7, #0369a1)' : '#1e293b',
                  color: '#f8fafc',
                  border: msg.role === 'user' ? 'none' : '1px solid rgba(255, 255, 255, 0.1)',
                  fontSize: '0.9rem',
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {msg.content}
              </div>
            )}

            {/* Data Sources Badge */}
            {msg.dataSources && msg.dataSources.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.75rem',
                  color: '#64748b',
                  marginTop: '0.1rem',
                }}
              >
                <span>Data used:</span>
                {msg.dataSources.map((ds, idx) => (
                  <span
                    key={idx}
                    style={{
                      padding: '0.1rem 0.4rem',
                      borderRadius: 4,
                      background: 'rgba(255,255,255,0.06)',
                      color: '#94a3b8',
                      fontWeight: 600,
                    }}
                  >
                    • {ds}
                  </span>
                ))}
              </div>
            )}

            {/* Navigation Action Buttons */}
            {msg.quickActions && msg.quickActions.length > 0 && (
              <div
                style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.25rem' }}
              >
                {msg.quickActions.map((action, idx) => (
                  <Link
                    key={idx}
                    href={action.route}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      padding: '0.4rem 0.75rem',
                      borderRadius: 20,
                      background: 'rgba(56, 189, 248, 0.15)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.3)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      textDecoration: 'none',
                    }}
                  >
                    <span>{action.label}</span>
                    <span>→</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Friendly Thinking Indicator */}
        {isProcessing && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              color: '#94a3b8',
              fontSize: '0.85rem',
              padding: '0.5rem',
            }}
          >
            <span style={{ animation: 'pulse 1.5s infinite', fontSize: '1.2rem' }}>🔎</span>
            <span>Checking your business data...</span>
          </div>
        )}

        <div ref={chatBottomRef} />
      </main>

      {/* ── Input Controls Bar ─────────────────────────────────────────── */}
      <footer
        style={{
          padding: '0.875rem 1.25rem',
          background: '#1e293b',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          style={{ display: 'flex', gap: '0.5rem' }}
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask ArgusOne..."
            disabled={isProcessing}
            style={{
              flex: 1,
              padding: '0.875rem 1rem',
              borderRadius: 12,
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#f8fafc',
              fontSize: '0.9rem',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || isProcessing}
            style={{
              padding: '0 1.25rem',
              borderRadius: 12,
              background: inputMessage.trim() && !isProcessing ? '#0284c7' : '#334155',
              color: '#f8fafc',
              border: 'none',
              fontWeight: 800,
              fontSize: '1.1rem',
              cursor: inputMessage.trim() && !isProcessing ? 'pointer' : 'not-allowed',
            }}
          >
            →
          </button>
        </form>
      </footer>
    </div>
  );
}
