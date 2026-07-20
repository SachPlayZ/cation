import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle,
  Fingerprint,
  GitBranch,
  LockKey,
  Robot,
  SealCheck,
  ShieldCheck,
  UserFocus,
} from "@phosphor-icons/react/dist/ssr";
import { LandingMotion } from "@/components/LandingMotion";

const roleViews = [
  {
    icon: UserFocus,
    role: "Principal",
    sees: "Mandate terms, usage, approvals",
  },
  {
    icon: Robot,
    role: "Agent",
    sees: "Only the authority needed to propose",
  },
  {
    icon: ShieldCheck,
    role: "Compliance",
    sees: "Policy violations, not treasury state",
  },
  {
    icon: Fingerprint,
    role: "Recipient",
    sees: "Only receipts addressed to its party",
  },
];

const proof = [
  ["17 / 17", "Daml Script tests passing"],
  ["7", "Purpose-built contract templates"],
  ["4", "Party-scoped ledger views"],
  ["1", "Constrained financial tool"],
];

export default function LandingPage() {
  return (
    <LandingMotion>
    <main className="landing-shell w-full max-w-full overflow-x-hidden bg-canvas text-ink">
      <header className="absolute inset-x-0 top-0 z-30 bg-gradient-to-b from-canvas/90 to-transparent">
        <nav
          aria-label="Primary navigation"
          className="mx-auto flex h-[72px] max-w-[1400px] items-center justify-between px-4 sm:px-6 lg:px-10"
        >
          <Link href="/" className="flex items-center gap-3" aria-label="Cation home">
            <Image
              src="/android-chrome-192x192.png"
              alt=""
              width={36}
              height={36}
              priority
              className="size-9 rounded-control"
            />
            <span className="text-sm font-semibold tracking-[0.18em]">CATION</span>
          </Link>

          <div className="hidden items-center gap-7 text-sm text-muted md:flex">
            <a className="transition hover:text-ink" href="#how-it-works">
              How it works
            </a>
            <a className="transition hover:text-ink" href="#privacy">
              Privacy
            </a>
            <a className="transition hover:text-ink" href="#proof">
              DevNet proof
            </a>
          </div>

          <Link
            href="/login"
            className="group inline-flex shrink-0 items-center gap-2 rounded-control bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-strong active:translate-y-px"
          >
            Sign in
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" weight="bold" />
          </Link>
        </nav>
      </header>

      <section className="relative isolate min-h-[100dvh] overflow-hidden border-b border-rim">
        <div className="motion-hero-visual absolute inset-0 -z-20">
          <Image
            src="/landing/authority-gate.png"
            alt="A signal-red path passing through a precise mechanical authorization gate"
            fill
            priority
            sizes="100vw"
            className="object-cover object-[57%_center]"
          />
          <video
            autoPlay
            loop
            muted
            playsInline
            disablePictureInPicture
            preload="auto"
            poster="/landing/authority-gate.png"
            aria-hidden="true"
            tabIndex={-1}
            className="hero-gate-video absolute inset-0 size-full object-cover object-[57%_center]"
          >
            <source src="/landing/authority-gate-loop.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="hero-gate-scrim absolute inset-0 -z-10" aria-hidden="true" />

        <div className="mx-auto flex min-h-[100dvh] max-w-[1400px] items-center px-4 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32 lg:px-10 lg:pb-24 lg:pt-36">
          <div className="motion-hero-copy relative z-10 max-w-2xl">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-brand-strong">
              Private authority for agentic finance
            </p>
            <h1 className="max-w-5xl text-[3.7rem] font-semibold leading-[0.94] tracking-[-0.065em] text-ink sm:text-[5.2rem] lg:text-[6.5rem]">
              Boundaries that hold.
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-muted sm:text-lg">
              Cation turns financial permissions into revocable Daml mandates enforced before every ledger action.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="group inline-flex items-center gap-2 whitespace-nowrap rounded-control bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong active:translate-y-px"
              >
                Explore role views
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5" weight="bold" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-control border border-rim-strong bg-canvas/65 px-5 py-3 text-sm font-semibold text-ink backdrop-blur-md transition hover:border-muted hover:bg-elevated/90 active:translate-y-px"
              >
                See how it works
              </a>
            </div>
          </div>
        </div>
      </section>

      <section id="how-it-works" className="border-y border-rim bg-surface/45">
        <div className="mx-auto max-w-[1400px] px-4 py-24 sm:px-6 sm:py-32 lg:px-10">
          <div className="max-w-5xl">
            <h2 className="motion-copy text-4xl font-semibold leading-[1.08] tracking-[-0.05em] sm:text-6xl">
              <span className="motion-word inline-block">The</span>{" "}
              <span className="motion-word inline-block">model</span>{" "}
              <span className="motion-inline-image relative mx-2 inline-block h-[0.62em] w-[1.3em] overflow-hidden rounded-control align-middle">
                <Image
                  src="/landing/authority-gate.png"
                  alt=""
                  fill
                  priority
                  sizes="96px"
                  className="object-cover object-[58%_center]"
                />
              </span>
              <span className="motion-word inline-block">proposes.</span>
              <br />
              <span className="motion-word inline-block">The</span>{" "}
              <span className="motion-word inline-block">mandate</span>{" "}
              <span className="motion-word inline-block">decides.</span>
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted">
              Natural-language intent becomes a validated action. Deterministic contracts choose execution, human approval, or denial.
            </p>
          </div>

          <div className="mt-14 grid grid-flow-dense gap-4 lg:grid-cols-[0.78fr_1.22fr]">
            <div className="motion-reveal rounded-panel border border-rim bg-canvas p-6 sm:p-8">
              <div className="flex items-center justify-between gap-4">
                <span className="flex size-11 items-center justify-center rounded-control border border-rim bg-elevated text-brand-strong">
                  <Robot className="size-5" weight="duotone" />
                </span>
                <span className="font-mono text-[11px] text-faint">propose_financial_action</span>
              </div>
              <p className="mt-14 text-2xl font-semibold tracking-[-0.035em]">One constrained tool.</p>
              <p className="mt-3 max-w-md text-sm leading-6 text-muted">
                The LLM never receives ledger credentials, raw party selection, or generic command submission.
              </p>
            </div>

            <div className="motion-reveal overflow-hidden rounded-panel border border-rim bg-canvas">
              <div className="policy-outcomes grid grid-flow-dense gap-px bg-rim sm:grid-cols-3">
                <div className="policy-outcome min-h-56 bg-elevated p-6 transition-colors duration-700 sm:p-7">
                  <GitBranch className="size-6 text-brand-strong" weight="duotone" />
                  <p className="mt-12 text-lg font-semibold">Execute</p>
                  <p className="mt-2 text-sm leading-6 text-muted">Within category, counterparty, amount, and time limits.</p>
                </div>
                <div className="policy-outcome min-h-56 bg-surface p-6 transition-colors duration-700 sm:p-7">
                  <UserFocus className="size-6 text-brand-strong" weight="duotone" />
                  <p className="mt-12 text-lg font-semibold">Request approval</p>
                  <p className="mt-2 text-sm leading-6 text-muted">A human reviews actions above the mandate threshold.</p>
                </div>
                <div className="policy-outcome min-h-56 bg-canvas p-6 transition-colors duration-700 sm:p-7">
                  <LockKey className="size-6 text-brand-strong" weight="duotone" />
                  <p className="mt-12 text-lg font-semibold">Deny and record</p>
                  <p className="mt-2 text-sm leading-6 text-muted">Policy outcomes stay legible and machine-readable on ledger.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 border-t border-rim px-6 py-4 text-xs text-muted sm:px-7">
                <CheckCircle className="size-4 text-brand-strong" weight="fill" />
                Approval re-evaluates the current mandate. It never bypasses policy.
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="privacy" className="mx-auto grid max-w-[1400px] gap-14 px-4 py-24 sm:px-6 sm:py-32 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:px-10">
        <div className="motion-image group relative min-h-[460px] overflow-hidden rounded-panel border border-rim bg-surface panel-shadow sm:min-h-[620px]">
          <Image
            src="/landing/privacy-layers.png"
            alt="Seven separate contract layers revealing only narrow slices of one authorization path"
            fill
            sizes="(max-width: 1024px) 100vw, 55vw"
            className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.025]"
          />
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-canvas via-canvas/80 to-transparent p-6 pt-24 sm:p-8 sm:pt-28">
            <p className="max-w-md text-xl font-semibold tracking-[-0.03em]">Seven contracts. Minimal stakeholders on each.</p>
          </div>
        </div>

        <div className="motion-reveal">
          <h2 className="max-w-[10ch] text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-6xl">
            Privacy comes from structure.
          </h2>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted">
            Terms, usage, approvals, violations, and receipts remain separate. Each party queries only its own ledger view.
          </p>

          <div className="mt-10 border-y border-rim">
            {roleViews.map(({ icon: Icon, role, sees }) => (
              <div key={role} className="grid grid-cols-[auto_1fr] gap-4 border-b border-rim py-5 last:border-b-0 sm:grid-cols-[auto_8rem_1fr] sm:items-center">
                <span className="flex size-9 items-center justify-center rounded-control bg-elevated text-brand-strong">
                  <Icon className="size-4" weight="duotone" />
                </span>
                <p className="text-sm font-semibold text-ink">{role}</p>
                <p className="col-start-2 text-sm leading-6 text-muted sm:col-start-3">{sees}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="proof" className="border-y border-rim bg-surface/45">
        <div className="mx-auto max-w-[1400px] px-4 py-24 sm:px-6 sm:py-32 lg:px-10">
          <div className="motion-reveal flex max-w-4xl items-start gap-5">
            <SealCheck className="mt-1 size-9 shrink-0 text-brand-strong" weight="duotone" />
            <div>
              <h2 className="text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-6xl">
                Proven on a real ledger.
              </h2>
              <p className="mt-5 max-w-2xl text-base leading-7 text-muted">
                Cation is deployed and verified end to end against real Canton DevNet transactions, not a mocked policy engine.
              </p>
            </div>
          </div>

          <div className="motion-metrics mt-14 grid border-y border-rim sm:grid-cols-2 lg:grid-cols-[1.25fr_0.8fr_0.8fr_1.15fr]">
            {proof.map(([value, label], index) => (
              <div
                key={label}
                className={`motion-metric min-h-44 py-7 sm:px-6 lg:min-h-52 lg:py-9 ${index > 0 ? "border-t border-rim sm:border-l sm:border-t-0" : ""} ${index === 2 ? "sm:border-t lg:border-t-0" : ""}`}
              >
                <p className="font-mono text-4xl font-medium tracking-[-0.06em] text-ink sm:text-5xl">{value}</p>
                <p className="mt-10 max-w-[15rem] text-sm leading-6 text-muted">{label}</p>
              </div>
            ))}
          </div>

          <div className="motion-marquee mt-10 overflow-hidden text-sm text-muted">
            <div className="motion-marquee-track flex w-max">
              {[0, 1].map((copy) => (
                <div
                  key={copy}
                  aria-hidden={copy === 1 ? "true" : undefined}
                  className="flex shrink-0 items-center"
                >
                  {[
                    "Server-generated request IDs",
                    "Atomic spend accounting",
                    "Outcome verified after every write",
                  ].map((item) => (
                    <div key={item} className="flex min-w-[19rem] items-center gap-3 pr-12 sm:min-w-[28rem]">
                      <Check className="size-4 shrink-0 text-brand-strong" weight="bold" />
                      {item}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-4 py-24 sm:px-6 sm:py-32 lg:px-10">
        <div className="motion-reveal relative overflow-hidden rounded-panel border border-rim bg-surface px-6 py-16 sm:px-10 sm:py-20 lg:grid lg:grid-cols-[1fr_auto] lg:items-end lg:gap-16 lg:px-14">
          <div className="absolute -left-20 top-0 h-56 w-56 rounded-full bg-brand/10 blur-[90px]" aria-hidden="true" />
          <div className="relative">
            <h2 className="max-w-[12ch] text-4xl font-semibold leading-[1.02] tracking-[-0.05em] sm:text-6xl">
              Put policy between intent and execution.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-7 text-muted">
              Enter the role-scoped control plane and follow a real action through its mandate.
            </p>
          </div>
          <Link
            href="/login"
            className="group relative mt-10 inline-flex w-fit items-center gap-2 whitespace-nowrap rounded-control bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-strong active:translate-y-px lg:mt-0"
          >
            Open control plane
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" weight="bold" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-rim">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-5 px-4 py-8 text-xs text-faint sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <Image src="/android-chrome-192x192.png" alt="" width={28} height={28} className="size-7 rounded-control" />
            <span className="font-semibold tracking-[0.16em] text-muted">CATION</span>
          </div>
          <p>The AI proposes. The mandate decides.</p>
          <p>Built on Canton with Daml.</p>
        </div>
      </footer>
    </main>
    </LandingMotion>
  );
}
