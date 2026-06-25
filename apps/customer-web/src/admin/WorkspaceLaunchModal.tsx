import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  cloneHardwareConfig,
  confirmWorkspaceDeployment,
  fetchDeploymentCatalog,
  formatOreMonthly,
  quoteWorkspaceDeployment,
  type DeploymentCatalog,
  type DeploymentHardwareItem,
  type DeploymentPlanCard,
  type DeploymentQuote,
  type HardwareConfig,
  type HardwareKind,
  type HardwareSlot,
  type WorkspaceDeploymentInput,
  type WorkspacePlanId
} from "./deploymentApi";
import { AdminSkeletonDeploymentPlans, AdminSkeletonQuote } from "./AdminSkeleton";

const EXIT_MS = 300;
const STEP_TRANSITION_MS = 340;

type StepDirection = "forward" | "back";

const launchBtnCls =
  "bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-[0_4px_20px_rgba(124,58,237,0.28)] hover:from-violet-500 hover:to-blue-500";

type Step = "choose-plan" | "configure-hardware" | "review";

type Props = {
  open: boolean;
  token: string;
  onConfirmed: (quote: DeploymentQuote) => void;
};

function useStepTransition(initial: Step) {
  const [step, setStep] = useState(initial);
  const [leavingStep, setLeavingStep] = useState<Step | null>(null);
  const [direction, setDirection] = useState<StepDirection>("forward");
  const timerRef = useRef<number | null>(null);

  const transitionTo = useCallback(
    (next: Step, dir: StepDirection = "forward") => {
      if (next === step || leavingStep) return;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      setDirection(dir);
      setLeavingStep(step);
      setStep(next);
      timerRef.current = window.setTimeout(() => {
        setLeavingStep(null);
        timerRef.current = null;
      }, STEP_TRANSITION_MS);
    },
    [step, leavingStep]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const reset = useCallback((next: Step = "choose-plan") => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    setLeavingStep(null);
    setDirection("forward");
    setStep(next);
  }, []);

  return { step, leavingStep, direction, transitionTo, reset };
}

function DeploymentStepLayer({
  stepKey,
  direction,
  phase,
  children
}: {
  stepKey: Step;
  direction: StepDirection;
  phase: "enter" | "exit";
  children: ReactNode;
}) {
  const motionClass =
    phase === "enter"
      ? direction === "forward"
        ? "deployment-phase-in-forward"
        : "deployment-phase-in-back"
      : direction === "forward"
        ? "deployment-phase-out-forward"
        : "deployment-phase-out-back";

  return (
    <div key={`${stepKey}-${phase}`} className={`w-full ${motionClass}`} aria-hidden={phase === "exit"}>
      {children}
    </div>
  );
}

function PlanCard({
  plan,
  selected,
  onSelect
}: {
  plan: DeploymentPlanCard;
  selected: boolean;
  onSelect: (id: WorkspacePlanId) => void;
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(plan.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(plan.id);
        }
      }}
      className={`deployment-plan-card relative flex cursor-pointer flex-col rounded-2xl border p-4 shadow-[0_6px_24px_rgba(15,23,42,0.08)] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:p-5 ${
        selected
          ? `${launchBtnCls} border-transparent ring-2 ring-violet-400/40`
          : plan.recommended
            ? "border-violet-300/70 bg-gradient-to-b from-violet-50/90 to-white/95 ring-1 ring-violet-300/30"
            : "border-slate-200/80 bg-white/95 hover:border-violet-200/80"
      }`}
    >
      {plan.recommended ? (
        <span
          className={`absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] shadow-[0_4px_12px_rgba(124,58,237,0.3)] ${
            selected ? "border border-white/90 bg-white text-violet-700" : "bg-gradient-to-r from-violet-600 to-blue-600 text-white"
          }`}
        >
          Most Popular
        </span>
      ) : null}

      <p className={`font-display text-2xl font-extrabold tracking-tight sm:text-3xl ${selected ? "text-white" : "text-slate-900"}`}>
        {plan.name}
      </p>
      <p className={`mt-1 font-display text-lg font-extrabold leading-tight sm:text-xl ${selected ? "text-white" : "text-slate-900"}`}>
        {plan.priceLabel}
      </p>
      <p className={`mt-0.5 text-[11px] font-bold ${selected ? "text-violet-100" : "text-violet-700"}`}>{plan.trialLabel}</p>
      <p className={`mt-2 text-xs font-semibold ${selected ? "text-white" : "text-slate-800"}`}>{plan.locationSummary}</p>

      <div className="mt-3 min-h-0 flex-1">
        <p className={`text-[9px] font-bold uppercase tracking-[0.14em] ${selected ? "text-violet-100/90" : "text-slate-500"}`}>
          Deployment includes
        </p>
        <ul className="mt-1.5 space-y-1">
          {plan.included.map((item) => (
            <li key={item} className={`flex gap-1.5 text-[10px] leading-snug ${selected ? "text-violet-50" : "text-slate-700"}`}>
              <span className={`mt-px shrink-0 ${selected ? "text-violet-100" : "text-emerald-600"}`} aria-hidden>
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className={`mt-3 border-t pt-3 text-[10px] leading-snug ${selected ? "border-white/25 text-violet-100" : "border-slate-200/70 text-slate-500"}`}>
        <span className="font-bold uppercase tracking-wide">Best for </span>
        {plan.bestFor}
      </p>
    </article>
  );
}

function HardwareRow({
  item,
  enabled,
  quantity,
  onToggle,
  onQuantityChange
}: {
  item: DeploymentHardwareItem;
  enabled: boolean;
  quantity: number;
  onToggle: (next: boolean) => void;
  onQuantityChange: (next: number) => void;
}) {
  return (
    <div className="deployment-hardware-row flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-white/90 px-4 py-3 sm:flex-nowrap">
      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
        />
        <span className="min-w-0">
          <span className="block text-sm font-bold text-slate-900">{item.label}</span>
          <span className="block text-xs text-slate-500">{item.description}</span>
          <span className="mt-0.5 block text-[10px] text-slate-500">Extra units: {item.addonMonthlyLabel}</span>
        </span>
      </label>

      <div className={`flex items-center gap-2 ${enabled ? "" : "pointer-events-none opacity-40"}`}>
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Qty</span>
        <button
          type="button"
          aria-label={`Decrease ${item.label}`}
          onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50"
        >
          −
        </button>
        <span className="w-6 text-center text-sm font-bold text-slate-900">{enabled ? quantity : 0}</span>
        <button
          type="button"
          aria-label={`Increase ${item.label}`}
          onClick={() => onQuantityChange(quantity + 1)}
          className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-sm font-bold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function WorkspaceLaunchModal({ open, token, onConfirmed }: Props) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const { step, leavingStep, direction, transitionTo, reset } = useStepTransition("choose-plan");
  const [catalog, setCatalog] = useState<DeploymentCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<WorkspacePlanId>("multi");
  const [hardware, setHardware] = useState<HardwareConfig | null>(null);
  const [quote, setQuote] = useState<DeploymentQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const plans = catalog?.plans ?? [];
  const hardwareCatalog = catalog?.hardware ?? [];
  const selectedPlan = useMemo(() => plans.find((p) => p.id === selectedPlanId), [plans, selectedPlanId]);

  const deploymentInput = useMemo((): WorkspaceDeploymentInput | null => {
    if (!hardware) return null;
    return { planId: selectedPlanId, hardware };
  }, [selectedPlanId, hardware]);

  const loadCatalog = useCallback(async () => {
    const res = await fetchDeploymentCatalog();
    if (!res.ok || !res.plans?.length) {
      setCatalogError(res.error ?? "catalog_unavailable");
      return;
    }
    setCatalog(res);
    setCatalogError(null);
    const defaultPlan = res.plans.find((p) => p.recommended) ?? res.plans[0]!;
    setSelectedPlanId(defaultPlan.id);
    setHardware(cloneHardwareConfig(defaultPlan.defaultHardware));
  }, []);

  const refreshQuote = useCallback(async (input: WorkspaceDeploymentInput) => {
    setQuoteLoading(true);
    setActionError(null);
    const res = await quoteWorkspaceDeployment(input);
    setQuoteLoading(false);
    if (!res.ok || !res.quote) {
      setQuote(null);
      setActionError(res.error ?? "quote_failed");
      return;
    }
    setQuote(res.quote);
  }, []);

  useEffect(() => {
    if (open) {
      setMounted(true);
      reset("choose-plan");
      setQuote(null);
      setActionError(null);
      void loadCatalog();
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const timer = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => clearTimeout(timer);
  }, [open, loadCatalog]);

  useEffect(() => {
    if (!mounted) return;
    const scrollY = window.scrollY;
    const html = document.documentElement;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyPosition = document.body.style.position;
    const prevBodyTop = document.body.style.top;
    const prevBodyWidth = document.body.style.width;
    const prevHtmlOverflow = html.style.overflow;

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    html.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.position = prevBodyPosition;
      document.body.style.top = prevBodyTop;
      document.body.style.width = prevBodyWidth;
      html.style.overflow = prevHtmlOverflow;
      window.scrollTo(0, scrollY);
    };
  }, [mounted]);

  useEffect(() => {
    if (step !== "configure-hardware" || !deploymentInput) return;
    const timer = window.setTimeout(() => {
      void refreshQuote(deploymentInput);
    }, 200);
    return () => clearTimeout(timer);
  }, [step, deploymentInput, refreshQuote]);

  useEffect(() => {
    if (step !== "review" || !deploymentInput) return;
    void refreshQuote(deploymentInput);
  }, [step, deploymentInput, refreshQuote]);

  function selectPlan(planId: WorkspacePlanId) {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;
    setSelectedPlanId(planId);
    setHardware(cloneHardwareConfig(plan.defaultHardware));
    setQuote(null);
  }

  function goToHardwareStep() {
    const plan = plans.find((p) => p.id === selectedPlanId);
    if (!plan || !hardware) return;
    setHardware(cloneHardwareConfig(plan.defaultHardware));
    transitionTo("configure-hardware", "forward");
  }

  function updateHardware(kind: HardwareKind, patch: Partial<HardwareSlot>) {
    setHardware((prev) => {
      if (!prev) return prev;
      const next = cloneHardwareConfig(prev);
      const slot = { ...next[kind], ...patch };
      if (patch.enabled === true && slot.quantity < 1) slot.quantity = 1;
      if (patch.enabled === false) slot.quantity = 0;
      next[kind] = slot;
      return next;
    });
  }

  async function goToReviewStep() {
    if (!deploymentInput) return;
    const res = await quoteWorkspaceDeployment(deploymentInput);
    if (!res.ok || !res.quote) {
      setActionError(res.error ?? "quote_failed");
      return;
    }
    setQuote(res.quote);
    transitionTo("review", "forward");
  }

  async function confirmDeployment() {
    if (!deploymentInput || !quote) return;
    setConfirming(true);
    setActionError(null);
    const res = await confirmWorkspaceDeployment(token, deploymentInput);
    setConfirming(false);
    if (!res.ok || !res.quote) {
      setActionError(res.error ?? "confirm_failed");
      return;
    }
    onConfirmed(res.quote);
  }

  const hasEnabledHardware = hardwareCatalog.some((item) => hardware?.[item.id]?.enabled && (hardware[item.id]?.quantity ?? 0) > 0);
  const step2CtaLabel = quote?.needsReview ? "Review Changes" : "Start Free Trial";
  const isStepTransitioning = Boolean(leavingStep);

  function renderStepContent(activeStep: Step) {
    if (!selectedPlan || !hardware) return null;

    if (activeStep === "choose-plan") {
      return (
        <>
          <header className="text-center">
            <h2 id="workspace-launch-title" className="font-display text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
              Everything is ready. Now it&apos;s your move.
            </h2>
            <p className="mx-auto mt-2 max-w-2xl text-sm font-medium leading-relaxed text-slate-800 sm:text-base">
              Choose the ServeOS setup that will power your operation from day one.
            </p>
          </header>

          <p className="mx-auto mt-4 max-w-3xl rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center text-sm leading-relaxed text-slate-800">
            Every plan ships the full platform — customer app, staff tools, admin dashboard, orders, reservations, chat,
            payments, and onboarding. Plans differ by{" "}
            <span className="font-bold text-slate-900">locations</span>,{" "}
            <span className="font-bold text-slate-900">hardware deployment</span>, and{" "}
            <span className="font-bold text-slate-900">support level</span>.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} selected={selectedPlanId === plan.id} onSelect={selectPlan} />
            ))}
          </div>

          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={goToHardwareStep}
              disabled={isStepTransitioning}
              className={`rounded-full px-8 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${launchBtnCls}`}
            >
              Continue — configure hardware
            </button>
          </div>
        </>
      );
    }

    if (activeStep === "configure-hardware") {
      return (
        <>
          <header>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-700/90">Step 2 of 3</p>
            <h2 id="workspace-launch-title" className="font-display mt-1 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
              Configure your deployment
            </h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800 sm:text-base">
              <span className="font-extrabold text-slate-900">{selectedPlan.name}</span> plan — {selectedPlan.locationSummary}.{" "}
              Select the hardware ServeOS will install and configure for you. Need more than your plan includes? Add units
              below — additional hardware is billed monthly.
            </p>
          </header>

          <div className="mt-4 space-y-2">
            {hardwareCatalog.map((item) => (
              <HardwareRow
                key={item.id}
                item={item}
                enabled={hardware[item.id].enabled}
                quantity={hardware[item.id].quantity}
                onToggle={(next) =>
                  updateHardware(item.id, { enabled: next, quantity: next ? Math.max(1, hardware[item.id].quantity) : 0 })
                }
                onQuantityChange={(next) => updateHardware(item.id, { quantity: next, enabled: true })}
              />
            ))}
          </div>

          {actionError ? <p className="mt-3 text-center text-xs font-medium text-red-600">{actionError}</p> : null}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => transitionTo("choose-plan", "back")}
              disabled={isStepTransitioning}
              className="rounded-full border border-slate-200/90 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-45"
            >
              ← Change plan
            </button>
            <button
              type="button"
              onClick={() => void goToReviewStep()}
              disabled={!hasEnabledHardware || quoteLoading || isStepTransitioning}
              className={`rounded-full px-8 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${launchBtnCls}`}
            >
              {step2CtaLabel}
            </button>
          </div>
        </>
      );
    }

    return (
      <>
        <header>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-700/90">Step 3 of 3</p>
          <h2 id="workspace-launch-title" className="font-display mt-1 text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
            Review your deployment
          </h2>
          <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800">
            Confirm your plan, hardware, and monthly total before starting your free trial.
          </p>
        </header>

        {quote ? (
          <div className="mt-4 space-y-4">
            <div className="deployment-review-block rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-800">Monthly total</p>
              <p className="font-display mt-1 text-3xl font-extrabold text-slate-900">{formatOreMonthly(quote.totalMonthlyOre)}</p>
              <p className="mt-1 text-sm text-slate-700">{quote.trialDays}-day free trial · {quote.currency}</p>
            </div>

            <div className="deployment-review-block rounded-xl border border-slate-200 bg-white px-4 py-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Summary</p>
              <ul className="mt-2 space-y-1.5">
                {quote.summaryLines.map((line) => (
                  <li key={line} className="text-sm text-slate-800">
                    {line}
                  </li>
                ))}
              </ul>
            </div>

            {quote.hardwareLines.length > 0 ? (
              <div className="deployment-review-block rounded-xl border border-slate-200 bg-white px-4 py-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Hardware</p>
                <ul className="mt-2 space-y-2">
                  {quote.hardwareLines.map((line) => (
                    <li key={line.kind} className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-slate-800">
                      <span>
                        {line.label} × {line.quantity}
                        {line.additionalQuantity > 0 ? (
                          <span className="ml-1 text-xs text-slate-500">(+{line.additionalQuantity} add-on)</span>
                        ) : null}
                      </span>
                      {line.lineAddonMonthlyOre > 0 ? (
                        <span className="text-xs font-semibold text-violet-700">+{formatOreMonthly(line.lineAddonMonthlyOre)}</span>
                      ) : (
                        <span className="text-xs text-emerald-700">Included</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {quote.suggestedPlanName && quote.suggestedPlanId !== quote.planId ? (
              <p className="deployment-review-block rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                Your hardware matches the <span className="font-bold">{quote.suggestedPlanName}</span> bundle. You can go back to
                change plan if that fits better.
              </p>
            ) : null}
          </div>
        ) : quoteLoading ? (
          <AdminSkeletonQuote />
        ) : (
          <p className="mt-4 text-center text-sm text-slate-600">Quote unavailable.</p>
        )}

        {actionError ? <p className="mt-3 text-center text-xs font-medium text-red-600">{actionError}</p> : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => transitionTo("configure-hardware", "back")}
            disabled={isStepTransitioning}
            className="rounded-full border border-slate-200/90 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 transition hover:border-violet-200 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-45"
          >
            ← Edit hardware
          </button>
          <button
            type="button"
            onClick={() => void confirmDeployment()}
            disabled={!quote || confirming || isStepTransitioning}
            className={`rounded-full px-8 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${launchBtnCls}`}
          >
            {confirming ? "Starting trial…" : "Start Free Trial"}
          </button>
        </div>
      </>
    );
  }

  if (!mounted) return null;

  const shell = (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden overscroll-none p-3 sm:p-4" role="presentation">
      <div
        className={`workspace-launch-backdrop pointer-events-none absolute inset-0 bg-slate-950/50 backdrop-blur-xl ${visible ? "is-active" : ""}`}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-launch-title"
        className={`workspace-launch-panel relative z-[1] w-full overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white px-4 py-5 shadow-[0_32px_100px_rgba(15,23,42,0.22)] transition-[max-width] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] sm:px-6 sm:py-6 ${visible ? "is-active" : ""} ${step !== "choose-plan" ? "max-w-[min(98vw,52rem)]" : "max-w-[min(98vw,72rem)]"}`}
      >
        {catalogError ? (
          <p className="text-center text-sm font-medium text-red-600">{catalogError}</p>
        ) : !selectedPlan || !hardware ? (
          <AdminSkeletonDeploymentPlans />
        ) : (
          <div className="deployment-step-stage">
            {leavingStep ? (
              <div className="absolute inset-x-0 top-0 z-0">
                <DeploymentStepLayer stepKey={leavingStep} direction={direction} phase="exit">
                  {renderStepContent(leavingStep)}
                </DeploymentStepLayer>
              </div>
            ) : null}
            <div className={leavingStep ? "relative z-[1]" : ""}>
              <DeploymentStepLayer stepKey={step} direction={direction} phase="enter">
                {renderStepContent(step)}
              </DeploymentStepLayer>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(shell, document.body);
}
