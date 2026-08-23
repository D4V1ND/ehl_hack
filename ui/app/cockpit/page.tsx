"use client"

import * as React from "react"
import Link from "next/link"
import { Play } from "lucide-react"

import {
  DATA_SOURCE,
  collectCalls,
  getCase,
  getPlan,
  getProfile,
  getShortages,
  initialCase,
  initialPlan,
  initialProfile,
  initialShortages,
  placeCall,
} from "@/lib/api/client"
import type { CasePlan, CaseSnapshot, CompanyProfile, ShortageAlert, Stage } from "@/lib/contracts"
import { useEvents } from "@/lib/api/use-events"
import { stageMeta } from "@/lib/stages"
import { Card, Kicker, Mono, Section } from "@/components/cockpit/primitives"
import { CandidateTable } from "@/components/cockpit/candidate-table"
import { ClaimCards } from "@/components/cockpit/claim-cards"
import { Countdown } from "@/components/cockpit/countdown"
import { DecisionPanel } from "@/components/cockpit/decision-panel"
import { StrategyTable } from "@/components/cockpit/strategy-table"
import { EventDock } from "@/components/cockpit/event-dock"
import { IncidentPanel } from "@/components/cockpit/incident-panel"
import { PlanChecklist } from "@/components/cockpit/plan-checklist"
import { ShortageStrip } from "@/components/cockpit/shortage-strip"
import { StageRail } from "@/components/cockpit/stage-rail"
import { SupplierTable } from "@/components/cockpit/supplier-table"
import { cn } from "@/lib/utils"
import { openChat } from "@/lib/web-app"

const SECTIONS = [
  { id: "shortage", label: "Shortage" },
  { id: "suppliers", label: "Suppliers" },
  { id: "candidates", label: "Candidates" },
  { id: "calls", label: "Calls" },
  { id: "cost", label: "Cost" },
  { id: "decision", label: "Decision" },
]

/**
 * `fixtures` replays the recorded log; `live` polls the running API and the
 * buttons actually do something. Same components either way.
 */
const LIVE = DATA_SOURCE === "live"

export default function CockpitPage() {
  // Seeded synchronously from the fixture bundle so the case paints on first
  // render; in `live` mode these start empty and the effects below fill them.
  const [shortages, setShortages] = React.useState<ShortageAlert[]>(initialShortages)
  const [profile, setProfile] = React.useState<CompanyProfile | null>(initialProfile)
  const [caseId, setCaseId] = React.useState("CASE-001")
  const [snapshot, setSnapshot] = React.useState<CaseSnapshot | null>(() => initialCase("CASE-001"))
  const [plan, setPlan] = React.useState<CasePlan | null>(() => initialPlan("CASE-001"))
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (DATA_SOURCE === "fixtures") return
    getShortages().then(setShortages).catch(() => setShortages([]))
    getProfile().then(setProfile).catch(() => setProfile(null))
  }, [])

  React.useEffect(() => {
    if (!LIVE) {
      setSnapshot(initialCase(caseId))
      setPlan(initialPlan(caseId))
      return
    }
    getCase(caseId).then(setSnapshot).catch(() => setSnapshot(null))
    getPlan(caseId).then(setPlan).catch(() => setPlan(null))
  }, [caseId])

  // The case is joined server-side, so one poll refreshes candidates, claims and
  // the priced plans together -- no partial screen while a phase lands.
  React.useEffect(() => {
    if (!LIVE) return
    const timer = setInterval(() => {
      getCase(caseId)
        .then((fresh) => setSnapshot((prior) => fresh ?? prior))
        .catch(() => undefined)
      // The checklist moves several times per phase, so it is polled with the
      // case rather than waiting for one: a tick a human can see is the point.
      getPlan(caseId)
        .then((fresh) => setPlan((prior) => fresh ?? prior))
        .catch(() => undefined)
    }, 3000)
    return () => clearInterval(timer)
  }, [caseId])

  // Replaying the recorded log is what "launch" does with the backend off. It is
  // the same read path live polling uses, at 4x -- not a second implementation.
  const { events } = useEvents(caseId, {
    replay: !LIVE,
    speed: 4,
    enabled: LIVE,
  })
  const stage: Stage = events.length ? events[events.length - 1].stage : "detected"

  const act = React.useCallback(async (key: string, action: () => Promise<unknown>) => {
    setBusy(key)
    setError(null)
    try {
      await action()
      const fresh = await getCase(caseId)
      if (fresh) setSnapshot(fresh)
      const freshPlan = await getPlan(caseId)
      if (freshPlan) setPlan(freshPlan)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(null)
    }
  }, [caseId])

  if (!snapshot) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-canvas">
        <p className="text-[14px] text-muted-ink">Loading {caseId}…</p>
      </main>
    )
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="sticky top-0 z-40 border-b border-hairline bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-4 px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[17px] font-semibold text-ink">
              stockout
            </Link>
            <span className="hidden h-4 w-px bg-hairline-strong sm:block" />
            <Mono className="hidden sm:inline-block">{snapshot.case_id}</Mono>
            <span className="hidden text-[14px] text-body md:inline">
              {snapshot.part.item_code}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden items-baseline gap-2 lg:flex">
              <Kicker>Line stops in</Kicker>
              <Countdown target={snapshot.incident.line_stop_at} className="text-[15px]" />
            </div>
            <span
              className={cn(
                "rounded-pill px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.88px]",
                stageMeta(stage).pill,
              )}
            >
              {stageMeta(stage).label}
            </span>
          </div>
        </div>
      </header>

      <ShortageStrip shortages={shortages} selectedCaseId={caseId} onSelect={setCaseId} />

      <div className="mx-auto flex max-w-[1180px] gap-0 px-6 lg:px-10">
        <main className="min-w-0 flex-1 pb-24 pr-0 xl:pr-8">
          <div className="sticky top-16 z-30 -mx-1 flex items-center gap-1 overflow-x-auto border-b border-hairline bg-canvas/95 px-1 py-3 backdrop-blur">
            {SECTIONS.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="whitespace-nowrap rounded-sm px-2.5 py-1 text-[13px] text-body transition-colors hover:bg-hairline-soft hover:text-ink"
              >
                {section.label}
              </a>
            ))}
            <div className="ml-auto hidden xl:block">
              <StageRail stage={stage} />
            </div>
          </div>

          <Section
            id="shortage"
            step={1}
            kicker="The shortage"
            title="Requires Attention"
            aside={
              <button
                type="button"
                onClick={() =>
                  openChat(caseId, window.location.origin, (url) =>
                    window.location.assign(url),
                  )
                }
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-[18px] text-[14px] font-medium text-on-primary transition-colors hover:bg-primary-active"
              >
                <Play className="size-4" />
                Launch sourcing agent
              </button>
            }
          >
            <IncidentPanel snapshot={snapshot} />
            <div className="mt-4 xl:hidden">
              <PlanChecklist plan={plan} />
            </div>
          </Section>

          <Section
            id="suppliers"
            step={2}
            kicker="System of record"
            title="Records"
            aside={
              profile ? (
                <div className="text-right text-[12px] text-muted-ink">
                  <div>{profile.legal_entity}</div>
                  <div>
                    blocked origins:{" "}
                    <span className="tnum">
                      {(profile.blocked_origin_countries ?? []).join(", ") || "none"}
                    </span>
                  </div>
                </div>
              ) : null
            }
          >
            <SupplierTable
              suppliers={snapshot.supplier_records ?? []}
              incumbentId={snapshot.incident.incumbent_supplier_id}
            />
            {profile ? (
              <Card className="mt-3 px-5 py-4">
                <Kicker>Rules that apply to this part class</Kicker>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-body">
                  <span>Requires</span>
                  {(snapshot.profile_summary?.required_certifications as string[] | undefined)?.map(
                    (cert) => <Mono key={cert}>{cert}</Mono>,
                  )}
                  <span>· on-site audit above criticality</span>
                  <Mono>{String(snapshot.profile_summary?.audit_required_above_criticality)}</Mono>
                  <span>· carrying cost at WACC</span>
                  <Mono>{String(snapshot.profile_summary?.wacc)}</Mono>
                </div>
              </Card>
            ) : null}
          </Section>

          <Section
            id="candidates"
            step={3}
            kicker="Screening"
            title="Candidates, and the rule that rejected each one"
          >
            <CandidateTable candidates={snapshot.candidates ?? []} />
          </Section>

          <Section
            id="calls"
            step={4}
            kicker="Outreach"
            title="What the suppliers actually said"
          >
            <ClaimCards
              claims={snapshot.claims ?? []}
              candidates={snapshot.candidates ?? []}
              heldFor={
                LIVE && (snapshot.candidates ?? []).length
                  ? snapshot.incident.incumbent_supplier_id
                  : null
              }
              calling={busy}
              onCall={
                LIVE
                  ? (supplierRef) => void act(supplierRef, () => placeCall(caseId, supplierRef, true))
                  : undefined
              }
            />
            {LIVE ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void act("collect", () => collectCalls(caseId))}
                  disabled={busy === "collect"}
                  className="inline-flex h-9 items-center rounded-md border border-hairline-strong bg-surface-card px-4 text-[13px] font-medium text-ink transition-colors hover:bg-hairline-soft disabled:text-muted-ink"
                >
                  {busy === "collect" ? "Collecting…" : "Collect answers and re-price"}
                </button>
                <span className="text-[12px] text-muted-ink">
                  A CALL-E answer can take minutes to come back; collecting is safe to repeat.
                </span>
              </div>
            ) : null}
          </Section>

          <Section id="cost" step={5} kicker="Landed cost" title="Every option, fully costed">
            <StrategyTable
              strategies={snapshot.decision?.strategies ?? []}
              recommendedId={snapshot.decision?.recommended_strategy_id}
              claims={snapshot.claims ?? []}
            />
          </Section>

          <Section id="decision" step={6} kicker="The artifact" title="The decision, as a pull request">
            <DecisionPanel decision={snapshot.decision} />
          </Section>

          {error ? (
            <Card className="mt-4 border-semantic-error/35 bg-semantic-error/5 px-5 py-4">
              <Kicker>Backend said no</Kicker>
              <p className="mt-1 text-[14px] text-semantic-error">{error}</p>
            </Card>
          ) : null}

          <footer className="border-t border-hairline py-6 text-[12px] text-muted-ink">
            Data source <Mono>{DATA_SOURCE}</Mono>
            {DATA_SOURCE === "fixtures" ? (
              <>
                {" "}— a recording of the live endpoints, exported by{" "}
                <Mono>python -m packages.contracts.export</Mono>. Set{" "}
                <Mono>NEXT_PUBLIC_DATA_SOURCE=live</Mono> to read the running API instead.
              </>
            ) : null}
          </footer>
        </main>

        <div className="hidden w-[320px] shrink-0 xl:block">
          <div className="sticky top-16 flex h-[calc(100dvh-4rem)] flex-col gap-3 overflow-y-auto border-l border-hairline pl-4 pt-4">
            <PlanChecklist plan={plan} />
            <div className="min-h-[280px] flex-1">
              <EventDock events={events} replaying={LIVE && busy !== null} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
