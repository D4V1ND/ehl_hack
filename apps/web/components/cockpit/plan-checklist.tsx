"use client";

import { useEffect, useRef, useState } from "react";

import {
  CheckIcon,
  ChevronDownIcon,
  CircleIcon,
  Loader2Icon,
  Phone,
  XIcon,
} from "@/components/icons";
import { DotLoader } from "@/components/cockpit/dot-loader";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type {
  CockpitCallItem,
  CockpitClaimView,
  CockpitStepItem,
  CockpitView,
  CockpitViewSection,
} from "@/lib/live/cockpit-view";
import { formatLabel, formatQty, maskPhone } from "@/lib/live/format";
import type { LiveStepStatus } from "@/lib/live/plan";
import { cn } from "@/lib/utils";

export function PlanChecklist({
  view,
  launching,
}: {
  view: CockpitView;
  launching: boolean;
}) {
  if (launching && view.sections.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <DotLoader className="size-4" />
        <span>Opening the case…</span>
      </div>
    );
  }

  if (view.sections.length === 0) return null;

  return (
    <section className="flex flex-col gap-3" aria-labelledby="activity-heading">
      <header className="px-1 pb-1">
        <h2 id="activity-heading" className="text-sm font-medium">
          Live activity
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Only started work and recorded results are shown.
        </p>
      </header>
      <div className="flex flex-col gap-2">
        {view.sections.map((section) => (
          <ActivitySection key={section.group} section={section} />
        ))}
      </div>
    </section>
  );
}

function ActivitySection({ section }: { section: CockpitViewSection }) {
  const [open, setOpen] = useState(section.defaultOpen);
  const previousStatus = useRef(section.status);
  const manuallyChanged = useRef(false);
  const activeCalls = section.items.filter(
    (item): item is CockpitCallItem =>
      item.kind === "call" && item.status === "active",
  );

  useEffect(() => {
    const previous = previousStatus.current;
    if (section.status === "active" && previous !== "active") {
      manuallyChanged.current = false;
      setOpen(true);
    } else if (
      previous === "active" &&
      section.status !== "active" &&
      !manuallyChanged.current
    ) {
      setOpen(false);
    }
    previousStatus.current = section.status;
  }, [section.status]);

  return (
    <Collapsible
      open={open}
      onOpenChange={(nextOpen) => {
        manuallyChanged.current = true;
        setOpen(nextOpen);
      }}
      className="rounded-xl border border-border/70 bg-card/60"
    >
      <CollapsibleTrigger className="group/activity-trigger flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50">
        <StatusIcon status={section.status} />
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-3">
            <span className="truncate text-sm font-medium">
              {section.label}
            </span>
            <span className="shrink-0 text-[11px] capitalize text-muted-foreground">
              {section.status}
            </span>
          </span>
          {activeCalls.length > 0 ? (
            <ActiveCallSummary
              call={activeCalls[0]}
              additional={activeCalls.length - 1}
            />
          ) : null}
        </span>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[panel-open]/activity-trigger:rotate-180 motion-reduce:transition-none" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ol className="border-t border-border/70 px-3 py-2">
          {section.items.map((item) =>
            item.kind === "call" ? (
              <CallRow key={item.id} call={item} />
            ) : (
              <StepRow key={item.id} step={item} />
            ),
          )}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}

function ActiveCallSummary({
  call,
  additional,
}: {
  call: CockpitCallItem;
  additional: number;
}) {
  return (
    <span className="mt-2 flex min-w-0 items-center gap-2 rounded-lg bg-background/80 px-2.5 py-2">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
        <Phone aria-hidden="true" className="size-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-xs font-medium">
          <span>Calling agent</span>
          <DotLoader className="size-3.5" />
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {call.supplierName}
          {additional > 0 ? ` · +${additional} more active` : ""}
        </span>
      </span>
      <ElapsedTime startedAt={call.startedAt} completedAt={call.completedAt} />
    </span>
  );
}

function StepRow({ step }: { step: CockpitStepItem }) {
  return (
    <li className="flex items-start gap-2.5 border-b border-border/50 py-2.5 last:border-b-0">
      {statusIcon(
        step.status,
        cn(
          "mt-0.5 size-3.5 shrink-0",
          toneFor(step.status),
          step.status === "active" && "animate-spin",
        ),
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-5 text-foreground/90">{step.label}</p>
        {step.detail ? (
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            {step.detail}
          </p>
        ) : null}
      </div>
      <ElapsedTime startedAt={step.startedAt} completedAt={step.completedAt} />
    </li>
  );
}

function CallRow({ call }: { call: CockpitCallItem }) {
  return (
    <li className="border-b border-border/50 py-3 last:border-b-0">
      <article className="rounded-lg bg-background/60 p-3">
        <header className="flex items-start gap-2.5">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-full",
              call.status === "active"
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Phone aria-hidden="true" className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h4 className="text-sm font-medium">{call.supplierName}</h4>
              <span className="text-[11px] capitalize text-muted-foreground">
                {call.status === "done" ? "completed" : call.status}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-muted-foreground">
              {call.taskId ? <span>{call.taskId}</span> : null}
              {call.phoneMasked ? (
                <span>{maskPhone(call.phoneMasked)}</span>
              ) : null}
            </div>
          </div>
          <ElapsedTime
            startedAt={call.startedAt}
            completedAt={call.completedAt}
          />
        </header>
        {call.detail ? (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            {call.detail}
          </p>
        ) : null}
        {call.claim ? (
          <ClaimDetails claim={call.claim} supplierName={call.supplierName} />
        ) : null}
      </article>
    </li>
  );
}

function ClaimDetails({
  claim,
  supplierName,
}: {
  claim: CockpitClaimView;
  supplierName: string;
}) {
  const rows = [
    ["Availability", claim.available ? "Available" : "Unavailable"],
    [
      "Quantity offered",
      claim.quantityOffered > 0 ? formatQty(claim.quantityOffered) : null,
    ],
    [
      "Unit price",
      claim.unitPrice
        ? `${claim.unitPrice.currency} ${claim.unitPrice.amount}`
        : null,
    ],
    ["MOQ", claim.moq == null ? null : formatQty(claim.moq)],
    [
      "Lead time",
      claim.leadTimeDays == null ? null : `${claim.leadTimeDays} days`,
    ],
    ["Earliest ready", claim.earliestReady],
    ["Incoterm", claim.incoterm],
    ["Payment terms", claim.paymentTerms],
    ["Stock status", formatLabel(claim.stockStatus)],
    ["Price quoted", formatLabel(claim.priceQuoted)],
    ["Part confirmed", formatLabel(claim.partNumberConfirmed)],
    ["Certification current", formatLabel(claim.certificationCurrent)],
    ["Confidence", `${Math.round(claim.confidence * 100)}%`],
  ].filter((row): row is [string, string] => row[1] !== null);

  return (
    <div className="mt-4 border-t border-border/70 pt-3">
      <div className="flex items-center justify-between gap-3">
        <h5 className="text-xs font-medium">Claim filed</h5>
        <span className="text-[10px] text-muted-foreground">
          Supplier statement · not verified
        </span>
      </div>
      {claim.summary ? (
        <p className="mt-2 text-sm leading-5">{claim.summary}</p>
      ) : null}
      {rows.length > 0 ? (
        <dl className="mt-3 grid gap-x-4 gap-y-2 sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[10px] text-muted-foreground">{label}</dt>
              <dd className="mt-0.5 text-xs break-words tabular-nums">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
      {claim.evidence.length > 0 ? (
        <section className="mt-4">
          <h6 className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Evidence
          </h6>
          <div className="mt-2 flex flex-col gap-2">
            {claim.evidence.map((evidence, index) => (
              <blockquote
                key={`${calloutKey(evidence)}-${index}`}
                className="rounded-md border-l-2 border-border bg-muted/40 px-3 py-2 text-xs leading-5"
              >
                “{evidence}”
              </blockquote>
            ))}
          </div>
        </section>
      ) : null}
      {claim.transcript.length > 0 ? (
        <section className="mt-4">
          <h6 className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Transcript
          </h6>
          <ol className="mt-2 flex flex-col gap-2">
            {claim.transcript.map((turn, index) => (
              <li
                key={`${turn.offsetSeconds}-${index}`}
                className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-2 text-xs leading-5"
              >
                <span className="truncate text-muted-foreground">
                  {turn.speaker === "bot"
                    ? "Calling agent"
                    : turn.speaker === "user"
                      ? supplierName
                      : formatLabel(turn.speaker)}
                </span>
                <span>{turn.text}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      {claim.transcriptUrl || claim.recordingUrl ? (
        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          {claim.transcriptUrl ? (
            <a
              href={claim.transcriptUrl}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              Open transcript
            </a>
          ) : null}
          {claim.recordingUrl ? (
            <a
              href={claim.recordingUrl}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              Open recording
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StatusIcon({ status }: { status: LiveStepStatus }) {
  return statusIcon(
    status,
    cn(
      "size-4 shrink-0",
      toneFor(status),
      status === "active" && "animate-spin",
    ),
  );
}

function ElapsedTime({
  startedAt,
  completedAt,
}: {
  startedAt: string | null;
  completedAt: string | null;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!startedAt || completedAt) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [completedAt, startedAt]);

  const start = startedAt ? Date.parse(startedAt) : Number.NaN;
  const end = completedAt ? Date.parse(completedAt) : now;
  if (!Number.isFinite(start) || end == null || !Number.isFinite(end)) {
    return (
      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
        {completedAt ? "Completed" : "Active"}
      </span>
    );
  }

  const totalSeconds = Math.max(0, Math.floor((end - start) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <span className="shrink-0 font-mono text-[10px] text-muted-foreground tabular-nums">
      {minutes > 0 ? `${minutes}m ` : ""}
      {seconds}s
    </span>
  );
}

function statusIcon(status: LiveStepStatus, className: string) {
  if (status === "active") {
    return <Loader2Icon aria-hidden="true" className={className} />;
  }
  if (status === "done") {
    return <CheckIcon aria-hidden="true" className={className} />;
  }
  if (status === "failed") {
    return <XIcon aria-hidden="true" className={className} />;
  }
  return <CircleIcon aria-hidden="true" className={className} />;
}

function toneFor(status: LiveStepStatus): string {
  if (status === "active") return "text-foreground";
  if (status === "done") return "text-foreground/70";
  if (status === "failed") return "text-destructive";
  return "text-muted-foreground/50";
}

function calloutKey(value: string): string {
  return value.slice(0, 24).replace(/\s+/g, "-");
}
