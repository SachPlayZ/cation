"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  apiFetch,
  getRole,
  formatUSD,
  subtract,
  DENIAL_EXPLANATIONS,
  type MandateView,
  type ChatResponse,
  type ChatActionResult,
} from "@/components/api";
import { useToast } from "@/components/Toast";

const SUGGESTED_PROMPTS = [
  "Pay $200 to Cloud Operations",
  "Transfer $1,200 to Treasury Reserve",
  "Send $100 to Unknown External Account",
];

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: ChatActionResult | null;
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`bg-elevated rounded animate-skeleton ${className}`} />;
}

function ActionCard({ action }: { action: ChatActionResult }) {
  const styles = {
    executed: {
      border: "border-emerald-800",
      bg: "bg-emerald-950/30",
      badge: "bg-emerald-900 text-emerald-200 border-emerald-700",
      icon: "✓",
      label: "Executed",
    },
    pending: {
      border: "border-amber-800",
      bg: "bg-amber-950/20",
      badge: "bg-amber-900/60 text-amber-200 border-amber-700",
      icon: "◎",
      label: "Awaiting approval",
    },
    denied: {
      border: "border-red-900",
      bg: "bg-red-950/20",
      badge: "bg-red-900/60 text-red-200 border-red-800",
      icon: "✕",
      label: "Denied",
    },
  };
  const s = styles[action.outcome];

  return (
    <div className={`mt-2 rounded-lg border p-3 text-xs ${s.border} ${s.bg}`}>
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border font-medium text-[10px] ${s.badge}`}
        >
          <span>{s.icon}</span>
          {s.label}
        </span>
        <span className="font-mono text-white font-semibold">
          {formatUSD(action.amount)}
        </span>
        <span className="text-slate-400">→ {action.counterpartyId}</span>
        <span className="px-1.5 py-0.5 rounded bg-elevated border border-rim text-slate-500 font-mono text-[10px]">
          {action.category}
        </span>
      </div>

      {action.outcome === "executed" && action.receiptId && (
        <div className="text-slate-500 font-mono">
          Receipt:{" "}
          <span className="text-slate-300">{action.receiptId}</span>
        </div>
      )}
      {action.outcome === "pending" && (
        <div className="text-amber-400/70">
          Amount {formatUSD(action.amount)} exceeds auto-approve threshold. CFO
          approval required.
        </div>
      )}
      {action.outcome === "denied" && action.denialCode && (
        <div>
          <span className="font-mono text-red-400 text-[10px]">
            {action.denialCode}
          </span>
          <p className="text-slate-400 mt-0.5">
            {DENIAL_EXPLANATIONS[action.denialCode] ?? action.denialCode}
          </p>
          <p className="text-slate-600 mt-1 text-[10px]">
            Denial recorded on Canton ledger — ledger enforces this, not the
            AI.
          </p>
        </div>
      )}
      {action.purpose && (
        <div className="text-slate-600 mt-1 truncate">
          Purpose: {action.purpose}
        </div>
      )}
    </div>
  );
}

function MandateSidebar({ mandate }: { mandate: MandateView | null | undefined }) {
  if (mandate === undefined) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12" />
        <Skeleton className="h-12" />
      </div>
    );
  }

  if (mandate === null) {
    return (
      <div className="p-3 rounded-lg border border-amber-900/40 bg-amber-950/10 text-xs text-amber-400">
        No active mandate. CFO must create one before the agent can transact.
      </div>
    );
  }

  const statusColors = {
    Active: "text-emerald-400",
    Paused: "text-amber-400",
    Revoked: "text-red-400",
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">
          Mandate Status
        </p>
        <p className={`text-sm font-semibold ${statusColors[mandate.status]}`}>
          {mandate.status}
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">
            Daily Remaining
          </p>
          <p className="font-mono text-white text-sm">
            {formatUSD(subtract(mandate.dailyMaximum, mandate.dailySpent))}
          </p>
          <p className="text-[10px] text-slate-600 mt-0.5">
            of {formatUSD(mandate.dailyMaximum)} cap
          </p>
          <div className="h-0.5 bg-rim rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full bg-cyan-600 rounded-full"
              style={{
                width: `${Math.min(
                  ((parseFloat(mandate.dailySpent) || 0) /
                    (parseFloat(mandate.dailyMaximum) || 1)) *
                    100,
                  100
                )}%`,
              }}
            />
          </div>
        </div>

        <div>
          <p className="text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">
            Monthly Remaining
          </p>
          <p className="font-mono text-white text-sm">
            {formatUSD(
              subtract(mandate.monthlyMaximum, mandate.monthlySpent)
            )}
          </p>
          <p className="text-[10px] text-slate-600 mt-0.5">
            of {formatUSD(mandate.monthlyMaximum)} cap
          </p>
        </div>
      </div>

      <div>
        <p className="text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">
          Auto-approve below
        </p>
        <p className="font-mono text-slate-300 text-xs">
          {formatUSD(mandate.autoApproveLimit)}
        </p>
      </div>

      <div>
        <p className="text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-1">
          Permitted
        </p>
        <div className="space-y-1">
          {mandate.permittedCategories.map((c) => (
            <div
              key={c}
              className="text-[10px] font-mono text-slate-500 flex items-center gap-1"
            >
              <span className="text-emerald-600">✓</span> {c}
            </div>
          ))}
          {mandate.counterparties.map((cp) => (
            <div
              key={cp.party}
              className="text-[10px] font-mono text-slate-500 flex items-center gap-1"
            >
              <span className="text-emerald-600">✓</span> {cp.label}
            </div>
          ))}
        </div>
      </div>

      <div className="pt-2 border-t border-rim">
        <p className="text-[10px] text-slate-600 leading-relaxed">
          Mandate v{mandate.version} · Canton ledger enforces all limits.
          The LLM has no direct ledger authority.
        </p>
      </div>
    </div>
  );
}

export default function AgentPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mandate, setMandate] = useState<MandateView | null | undefined>(
    undefined
  );

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Role guard
  useEffect(() => {
    const role = getRole();
    if (role && role !== "agent") router.replace("/");
  }, [router]);

  // Fetch mandate summary
  const fetchMandate = useCallback(async () => {
    try {
      const m = await apiFetch<MandateView>("/api/mandate");
      setMandate(m);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("404") || msg.toLowerCase().includes("not found")) {
        setMandate(null);
      }
    }
  }, []);

  useEffect(() => {
    fetchMandate();
    const id = setInterval(fetchMandate, 5000);
    return () => clearInterval(id);
  }, [fetchMandate]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;

    const userMsg: Message = {
      id: Math.random().toString(36).slice(2),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await apiFetch<ChatResponse>("/api/agent/chat", {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      const assistantMsg: Message = {
        id: Math.random().toString(36).slice(2),
        role: "assistant",
        content: res.reply,
        action: res.action,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      // Refresh mandate after action
      if (res.action) fetchMandate();
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Agent error");
      // Remove optimistic user message on failure
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-4">
        <p className="text-xs font-mono text-cyan-500 uppercase tracking-wider mb-0.5">
          AI Agent Console
        </p>
        <h1 className="text-white font-bold text-xl">Treasury Copilot</h1>
      </div>

      <div className="flex gap-5 h-[calc(100vh-180px)] min-h-[500px]">
        {/* Sidebar */}
        <div className="hidden lg:block w-52 shrink-0">
          <div className="p-4 rounded-lg border border-rim bg-surface sticky top-20">
            <p className="text-[10px] font-mono text-slate-600 uppercase tracking-wider mb-3">
              Mandate Summary
            </p>
            <MandateSidebar mandate={mandate} />
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col min-w-0 rounded-lg border border-rim bg-surface overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && !sending && (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <div className="w-10 h-10 rounded-full border border-rim flex items-center justify-center text-slate-600 text-lg mb-3">
                  ◈
                </div>
                <p className="text-slate-500 text-sm mb-1">
                  AI treasury agent ready
                </p>
                <p className="text-slate-600 text-xs max-w-xs">
                  Propose a transaction using natural language. The Canton
                  mandate evaluates every request on-ledger.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] ${
                    msg.role === "user"
                      ? "bg-cyan-950/40 border border-cyan-900/50 rounded-2xl rounded-tr-sm"
                      : "bg-elevated border border-rim rounded-2xl rounded-tl-sm"
                  } px-4 py-3`}
                >
                  {msg.role === "assistant" && (
                    <p className="text-[10px] font-mono text-slate-600 mb-1.5 uppercase tracking-wider">
                      Agent
                    </p>
                  )}
                  <p
                    className={`text-sm leading-relaxed ${
                      msg.role === "user" ? "text-cyan-100" : "text-slate-200"
                    }`}
                  >
                    {msg.content}
                  </p>
                  {msg.role === "assistant" && msg.action && (
                    <ActionCard action={msg.action} />
                  )}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="bg-elevated border border-rim rounded-2xl rounded-tl-sm px-4 py-3">
                  <p className="text-[10px] font-mono text-slate-600 mb-1.5 uppercase tracking-wider">
                    Agent
                  </p>
                  <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-bounce"
                        style={{ animationDelay: `${i * 150}ms` }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Suggested chips */}
          {messages.length === 0 && (
            <div className="px-4 pb-2 flex gap-2 flex-wrap">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => handleSend(p)}
                  disabled={sending}
                  className="px-3 py-1.5 rounded-full border border-rim bg-elevated hover:bg-rim text-slate-400 hover:text-slate-200 text-xs transition-colors disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-rim p-3 flex gap-2 items-end">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Describe a transaction… (Enter to send, Shift+Enter for newline)"
              rows={1}
              disabled={sending}
              className="flex-1 resize-none bg-transparent text-slate-200 placeholder:text-slate-600 text-sm focus:outline-none disabled:opacity-50 min-h-[36px] max-h-[120px] py-1.5 font-sans"
              style={{ lineHeight: "1.5" }}
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || sending}
              className="shrink-0 w-8 h-8 rounded-lg bg-cyan-700 hover:bg-cyan-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-white text-sm transition-colors"
            >
              ↑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
