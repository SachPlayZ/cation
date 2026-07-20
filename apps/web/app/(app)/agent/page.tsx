"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CaretDown,
  CheckCircle,
  CircleNotch,
  Clock,
  PaperPlaneTilt,
  Receipt,
  Robot,
  ShieldCheck,
  ShieldWarning,
  WarningCircle,
} from "@phosphor-icons/react";
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
import {
  InlineError,
  PageHeader,
  Skeleton,
  buttonSecondary,
} from "@/components/ui";

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
  error?: string;
  retryText?: string;
}

function ActionResult({ action }: { action: ChatActionResult }) {
  const config = {
    executed: {
      label: "Executed",
      icon: CheckCircle,
      frame: "border-emerald-900/70 bg-emerald-950/25",
      tone: "text-emerald-300",
    },
    pending: {
      label: "Awaiting approval",
      icon: Clock,
      frame: "border-amber-900/70 bg-amber-950/25",
      tone: "text-amber-300",
    },
    denied: {
      label: "Denied",
      icon: ShieldWarning,
      frame: "border-red-900/70 bg-red-950/25",
      tone: "text-red-300",
    },
  }[action.outcome];
  const Icon = config.icon;

  return (
    <div className={`mt-3 rounded-control border p-3.5 ${config.frame}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${config.tone}`}>
          <Icon className="size-4" weight="fill" />
          {config.label}
        </span>
        <span className="font-mono text-sm font-semibold text-ink">{formatUSD(action.amount)}</span>
        <ArrowRight className="size-3.5 text-faint" />
        <span className="text-xs text-muted">{action.counterpartyId}</span>
      </div>
      <dl className="mt-3 grid gap-2 border-t border-rim/70 pt-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="text-faint">Category</dt>
          <dd className="mt-0.5 font-mono text-muted">{action.category}</dd>
        </div>
        <div>
          <dt className="text-faint">Purpose</dt>
          <dd className="mt-0.5 truncate text-muted">{action.purpose}</dd>
        </div>
      </dl>
      {action.outcome === "executed" && action.receiptId && (
        <p className="mt-3 flex items-center gap-2 font-mono text-[11px] text-muted">
          <Receipt className="size-3.5" />
          Receipt {action.receiptId}
        </p>
      )}
      {action.outcome === "pending" && (
        <p className="mt-3 text-xs leading-5 text-amber-200/75">
          Request exceeds automatic authority. CFO approval is required.
        </p>
      )}
      {action.outcome === "denied" && action.denialCode && (
        <div className="mt-3">
          <p className="font-mono text-[11px] text-red-300">{action.denialCode}</p>
          <p className="mt-1 text-xs leading-5 text-red-200/70">
            {DENIAL_EXPLANATIONS[action.denialCode] ?? action.denialCode}
          </p>
          <p className="mt-1 text-[11px] text-faint">Denial recorded on Canton ledger.</p>
        </div>
      )}
    </div>
  );
}

function MandatePanel({
  mandate,
  error,
  onRetry,
}: {
  mandate: MandateView | null | undefined;
  error: string | null;
  onRetry: () => void;
}) {
  if (mandate === undefined && !error) {
    return (
      <div aria-busy="true" className="space-y-4">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
    );
  }
  if (error) return <InlineError title="Mandate unavailable" message={error} onRetry={onRetry} />;
  if (mandate === null) {
    return (
      <div className="rounded-control border border-amber-900/70 bg-amber-950/25 p-4 text-xs leading-5 text-amber-200">
        CFO must create a mandate before this agent can transact.
      </div>
    );
  }
  if (!mandate) return null;

  const statusTone = {
    Active: "text-emerald-300",
    Paused: "text-amber-300",
    Revoked: "text-red-300",
  }[mandate.status];

  return (
    <div>
      <div className="flex items-center justify-between gap-3 border-b border-rim pb-4">
        <div>
          <p className="text-xs text-faint">Mandate status</p>
          <p className={`mt-1 text-sm font-semibold ${statusTone}`}>{mandate.status}</p>
        </div>
        <span className="font-mono text-[11px] text-faint">v{mandate.version}</span>
      </div>

      <div className="grid gap-4 py-4 sm:grid-cols-2 lg:grid-cols-1">
        <div>
          <p className="text-xs text-faint">Daily remaining</p>
          <p className="mt-1 font-mono text-base font-semibold text-ink">
            {formatUSD(subtract(mandate.dailyMaximum, mandate.dailySpent))}
          </p>
          <p className="mt-0.5 text-[11px] text-faint">of {formatUSD(mandate.dailyMaximum)}</p>
        </div>
        <div>
          <p className="text-xs text-faint">Monthly remaining</p>
          <p className="mt-1 font-mono text-base font-semibold text-ink">
            {formatUSD(subtract(mandate.monthlyMaximum, mandate.monthlySpent))}
          </p>
          <p className="mt-0.5 text-[11px] text-faint">of {formatUSD(mandate.monthlyMaximum)}</p>
        </div>
        <div>
          <p className="text-xs text-faint">Automatic authority</p>
          <p className="mt-1 font-mono text-sm text-ink">Below {formatUSD(mandate.autoApproveLimit)}</p>
        </div>
      </div>

      <div className="border-t border-rim pt-4">
        <p className="flex items-center gap-2 text-xs font-medium text-muted">
          <ShieldCheck className="size-4 text-brand-strong" />
          Ledger-enforced scope
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {mandate.permittedCategories.map((category) => (
            <span key={category} className="rounded-md border border-rim px-2 py-1 text-[10px] text-faint">{category}</span>
          ))}
          {mandate.counterparties.map((counterparty) => (
            <span key={counterparty.party} className="rounded-md border border-rim px-2 py-1 text-[10px] text-faint">{counterparty.label}</span>
          ))}
        </div>
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
  const [mandate, setMandate] = useState<MandateView | null | undefined>(undefined);
  const [mandateError, setMandateError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mandateFetching = useRef(false);

  useEffect(() => {
    const role = getRole();
    if (role && role !== "agent") router.replace("/");
  }, [router]);

  const fetchMandate = useCallback(async () => {
    if (mandateFetching.current) return;
    mandateFetching.current = true;
    try {
      const nextMandate = await apiFetch<MandateView>("/api/mandate");
      setMandate(nextMandate);
      setMandateError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load mandate";
      if (message.includes("404") || message.toLowerCase().includes("not found")) {
        setMandate(null);
        setMandateError(null);
      } else {
        setMandateError(message);
      }
    } finally {
      mandateFetching.current = false;
    }
  }, []);

  useEffect(() => {
    fetchMandate();
    const id = setInterval(fetchMandate, 5000);
    return () => clearInterval(id);
  }, [fetchMandate]);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    messagesEndRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages]);

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending || mandate === null) return;
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    setMessages((previous) => [...previous, userMessage]);
    setInput("");
    setSending(true);

    try {
      const response = await apiFetch<ChatResponse>("/api/agent/chat", {
        method: "POST",
        body: JSON.stringify({ message: text }),
      });
      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.reply,
          action: response.action,
        },
      ]);
      if (response.action) {
        fetchMandate();
        const explorerLink = {
          label: "View on Canton Explorer",
          href: response.action.explorerUrl,
        };
        if (response.action.outcome === "executed") {
          toast("success", "Action executed on ledger", explorerLink);
        } else if (response.action.outcome === "pending") {
          toast("info", "Escalated for human approval", explorerLink);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent request failed";
      setMessages((previous) => [
        ...previous,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Request was not submitted.",
          error: message,
          retryText: text,
        },
      ]);
      toast("error", message);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  };

  const inputDisabled = sending || mandate === null;

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Agent console"
        description="Describe a financial intent. Policy evaluation and ledger execution remain deterministic."
      />

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
        <details className="group rounded-panel border border-rim bg-surface p-4 lg:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-ink">
            <span>Current authority</span>
            <span className="flex items-center gap-2">
              {mandate && (
                <span className="text-xs font-medium text-muted">{mandate.status}</span>
              )}
              <CaretDown className="size-4 text-faint transition group-open:rotate-180" />
            </span>
          </summary>
          <div className="mt-4 border-t border-rim pt-4">
            <MandatePanel mandate={mandate} error={mandateError} onRetry={fetchMandate} />
          </div>
        </details>

        <aside className="hidden rounded-panel border border-rim bg-surface p-4 lg:sticky lg:top-20 lg:block lg:self-start">
          <h2 className="mb-4 text-sm font-semibold text-ink">Current authority</h2>
          <MandatePanel mandate={mandate} error={mandateError} onRetry={fetchMandate} />
        </aside>

        <section className="flex min-h-[calc(100dvh-15rem)] flex-col overflow-hidden rounded-panel border border-rim bg-surface lg:h-[calc(100dvh-9.75rem)] lg:min-h-[580px]">
          <div className="flex items-center justify-between border-b border-rim px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex size-8 items-center justify-center rounded-control bg-brand-soft text-brand-strong">
                <Robot className="size-4" weight="fill" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-ink">Treasury agent</h2>
                <p className="text-[11px] text-faint">One financial tool. No direct ledger access.</p>
              </div>
            </div>
          </div>

          <div className="min-h-[320px] flex-1 overflow-y-auto p-4 sm:p-5">
            {messages.length === 0 && !sending ? (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center px-5 text-center">
                <div className="flex size-12 items-center justify-center rounded-panel border border-rim bg-elevated text-muted">
                  <ShieldCheck className="size-6" weight="duotone" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-ink">Ready for a financial intent</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-muted">
                  Cation converts your request into fixed inputs, then the current mandate decides the outcome.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <article
                    key={message.id}
                    className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[92%] rounded-panel px-4 py-3 sm:max-w-[82%] ${
                        message.role === "user"
                          ? "bg-brand text-white"
                          : "border border-rim bg-elevated text-ink"
                      }`}
                    >
                      {message.role === "assistant" && (
                        <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-faint">
                          <Robot className="size-3.5" />
                          Cation agent
                        </p>
                      )}
                      <p className="text-sm leading-6">{message.content}</p>
                      {message.action && <ActionResult action={message.action} />}
                      {message.error && (
                        <div className="mt-3 rounded-control border border-red-900/70 bg-red-950/25 p-3">
                          <p className="flex gap-2 text-xs leading-5 text-red-200">
                            <WarningCircle className="mt-0.5 size-4 shrink-0" weight="fill" />
                            {message.error}
                          </p>
                          {message.retryText && (
                            <button
                              type="button"
                              onClick={() => handleSend(message.retryText)}
                              disabled={sending}
                              className={`${buttonSecondary} mt-3`}
                            >
                              Retry request
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </article>
                ))}

                {sending && (
                  <div className="flex justify-start" role="status">
                    <div className="flex items-center gap-2 rounded-panel border border-rim bg-elevated px-4 py-3 text-sm text-muted">
                      <CircleNotch className="size-4 animate-spin text-brand" />
                      Evaluating intent and mandate
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {messages.length === 0 && (
            <div className="flex gap-2 overflow-x-auto border-t border-rim px-4 py-3">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => handleSend(prompt)}
                  disabled={inputDisabled}
                  className="min-h-10 shrink-0 whitespace-nowrap rounded-control border border-rim bg-elevated px-3 text-xs text-muted transition hover:border-rim-strong hover:text-ink active:scale-[0.98] disabled:opacity-45"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-rim p-3 sm:p-4">
            {mandate === null && (
              <p className="mb-2 text-xs text-amber-300">No mandate. Ask the CFO to create one.</p>
            )}
            <div className="flex items-end gap-2 rounded-control border border-rim bg-elevated p-2 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSend();
                  }
                }}
                aria-label="Financial intent"
                placeholder="Describe a transaction"
                rows={1}
                disabled={inputDisabled}
                className="min-h-10 max-h-32 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 text-ink placeholder:text-faint focus:outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim() || inputDisabled}
                aria-label="Send financial intent"
                className="flex size-11 shrink-0 items-center justify-center rounded-control bg-brand text-white transition hover:bg-brand-strong active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35"
              >
                {sending ? <CircleNotch className="size-5 animate-spin" /> : <PaperPlaneTilt className="size-5" weight="fill" />}
              </button>
            </div>
            <p className="mt-2 px-1 text-[11px] text-faint">Enter to send. Shift + Enter for a new line.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
