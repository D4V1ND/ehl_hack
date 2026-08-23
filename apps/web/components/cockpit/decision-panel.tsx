"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { caseArtifactUrl } from "@/lib/live/api";
import { cn } from "@/lib/utils";
import type {
  LiveCandidate,
  LiveDecision,
  LiveFlowState,
  LiveStrategy,
} from "@/lib/live/types";

/** How many plans sit on the table as choices; the rest fold away. */
const OPTIONS_SHOWN = 3;

const money = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const qty = new Intl.NumberFormat("en-GB");

function euros(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? money.format(parsed) : value;
}

function shortDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function supplierName(
  ref: string,
  candidates: readonly LiveCandidate[],
): string {
  return candidates.find((c) => c.supplier_ref === ref)?.supplier_name ?? ref;
}

/** Cost above the cheapest plan — what each alternative asks you to pay for. */
function premium(option: LiveStrategy, cheapest: LiveStrategy): string | null {
  const gap = Number(option.total_cost) - Number(cheapest.total_cost);
  if (!Number.isFinite(gap) || gap <= 0) return null;
  return `+${money.format(gap)}`;
}

/** Has every supplier we called come back yet?
 *
 * The backend re-prices after each claim is filed, so a decision exists long
 * before the last call ends. Showing it then puts a shortlist in front of the
 * buyer that the next answer can still change, which reads as the agent having
 * made its mind up early. Wait until every compliant supplier has answered, or
 * until the case says it is decided for the ones that never will.
 */
function callsAreIn(
  flow: LiveFlowState | null,
  candidates: readonly LiveCandidate[],
): boolean {
  if (!flow) return false;
  if (flow.stage === "decided") return true;
  const asked = candidates.filter((c) => c.compliance.passed).length;
  return asked > 0 && flow.claims.length >= asked;
}

export function DecisionPanel({
  decision,
  flow,
  candidates,
  caseId,
}: {
  decision: LiveDecision | null;
  flow: LiveFlowState | null;
  candidates: readonly LiveCandidate[];
  caseId: string | null;
}) {
  const [buyerChoice, setBuyerChoice] = useState<string | null>(null);
  const [showRest, setShowRest] = useState(false);

  const { offered, rest, cheapest } = useMemo(() => {
    const options = decision?.options ?? [];
    // The agent's pick leads; the runners-up keep the order it ranked them in.
    const ranked = [...options].sort(
      (a, b) => Number(b.recommended) - Number(a.recommended),
    );
    const cheapest = options.reduce<LiveStrategy | null>((best, option) => {
      if (!best) return option;
      return Number(option.total_cost) < Number(best.total_cost)
        ? option
        : best;
    }, null);
    return {
      offered: ranked.slice(0, OPTIONS_SHOWN),
      rest: ranked.slice(OPTIONS_SHOWN),
      cheapest,
    };
  }, [decision]);

  const rejected = candidates.filter((c) => !c.compliance.passed);

  if (!decision || offered.length === 0 || !cheapest) return null;
  if (!callsAreIn(flow, candidates)) return null;
  const chosen = decision.options.some(
    (option) => option.strategy_id === buyerChoice,
  )
    ? buyerChoice
    : decision.recommended_strategy_id;

  return (
    <section
      aria-label="Plans for the buyer to choose from"
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <header className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Choose a plan
        </span>
        <span className="text-xs text-muted-foreground">
          {decision.options.length} priced · {offered.length} shortlisted
        </span>
      </header>

      <div
        role="radiogroup"
        aria-label="Sourcing plans"
        className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {offered.map((option) => (
          <PlanCard
            key={option.strategy_id}
            option={option}
            cheapest={cheapest}
            candidates={candidates}
            selected={chosen === option.strategy_id}
            onSelect={() => setBuyerChoice(option.strategy_id)}
          />
        ))}
      </div>

      {rest.length > 0 ? (
        <div className="border-t border-border px-4 py-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-mx-2 h-auto px-2 py-1 text-xs text-muted-foreground"
            aria-expanded={showRest}
            onClick={() => setShowRest((open) => !open)}
          >
            {showRest ? "Hide" : "Show"} {rest.length} plan
            {rest.length === 1 ? "" : "s"} that cost more
          </Button>

          {showRest ? (
            <ul className="mt-2 flex flex-col gap-1">
              {rest.map((option) => (
                <li
                  key={option.strategy_id}
                  className="flex items-baseline gap-3 border-t border-border/60 py-2 text-sm first:border-t-0"
                >
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {option.label}
                  </span>
                  <span className="tabular-nums">
                    {euros(option.total_cost)}
                  </span>
                  <span className="w-24 text-right text-xs text-amber-600 tabular-nums">
                    {premium(option, cheapest) ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {rejected.length > 0 ? (
        <div className="border-t border-border px-4 py-3">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Rejected on policy
          </p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {rejected.map((candidate) => (
              <li
                key={candidate.supplier_ref}
                className="flex flex-wrap items-baseline gap-2 text-sm"
              >
                <span className="text-muted-foreground line-through">
                  {candidate.supplier_name}
                </span>
                {(candidate.compliance.failed_rules ?? []).map((rule) => (
                  <code
                    key={rule}
                    className="rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-[11px] text-destructive"
                  >
                    {rule}
                  </code>
                ))}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <footer className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border bg-muted/30 px-4 py-2.5">
        <p className="text-xs text-muted-foreground">{decision.approval}</p>
        <div className="ml-auto flex items-center gap-3">
          {decision.pr_url ? (
            <a
              href={decision.pr_url}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline underline-offset-4"
            >
              Review pull request
            </a>
          ) : null}
          {caseId ? (
            <a
              href={caseArtifactUrl(caseId, "decision.md")}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline underline-offset-4"
            >
              Read decision.md
            </a>
          ) : null}
        </div>
      </footer>
    </section>
  );
}

function PlanCard({
  option,
  cheapest,
  candidates,
  selected,
  onSelect,
}: {
  option: LiveStrategy;
  cheapest: LiveStrategy;
  candidates: readonly LiveCandidate[];
  selected: boolean;
  onSelect: () => void;
}) {
  const extra = premium(option, cheapest);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex flex-col gap-3 rounded-lg border p-3 text-left transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-foreground/25 hover:bg-muted/40",
      )}
    >
      <div className="flex items-center gap-2">
        {option.recommended ? (
          <Badge variant="secondary" className="text-[10px]">
            Agent&rsquo;s pick
          </Badge>
        ) : null}
        <Badge
          variant={option.meets_line_stop ? "outline" : "destructive"}
          className="text-[10px]"
        >
          {option.meets_line_stop ? "In time" : "Too late"}
        </Badge>
        {selected ? (
          <span className="ml-auto text-[10px] font-medium tracking-wide text-primary uppercase">
            Selected
          </span>
        ) : null}
      </div>

      <p className="text-sm leading-snug font-medium text-balance">
        {option.label}
      </p>

      <div className="flex items-baseline gap-2">
        <span className="text-xl leading-none font-semibold tabular-nums">
          {euros(option.total_cost)}
        </span>
        {extra ? (
          <span className="text-xs text-amber-600 tabular-nums">{extra}</span>
        ) : (
          <span className="text-xs text-emerald-600">cheapest</span>
        )}
      </div>

      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div className="flex gap-1.5">
          <dt>Unit</dt>
          <dd className="text-foreground tabular-nums">
            {euros(option.unit_effective)}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt>Covered</dt>
          <dd className="text-foreground tabular-nums">
            {shortDate(option.coverage_date)}
          </dd>
        </div>
      </dl>

      <ul className="mt-auto flex flex-col gap-1 border-t border-border/60 pt-2">
        {option.suppliers.map((line) => (
          <li
            key={`${line.supplier_ref}-${line.eta}`}
            className="flex items-baseline gap-2 text-xs"
          >
            <span className="min-w-0 truncate">
              {supplierName(line.supplier_ref, candidates)}
            </span>
            <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
              {qty.format(line.qty)} · {shortDate(line.eta)}
            </span>
          </li>
        ))}
      </ul>
    </button>
  );
}
