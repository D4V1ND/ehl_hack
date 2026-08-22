"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowUpRight, Play, RotateCcw } from "lucide-react"

import {
  DATA_SOURCE,
  getCase,
  getProfile,
  getShortages,
  initialCase,
  initialProfile,
  initialShortages,
} from "@/lib/api/client"
import type { CaseSnapshot, CompanyProfile, ShortageAlert, Stage } from "@/lib/contracts"
import { useEvents } from "@/lib/api/use-events"
import { stageMeta } from "@/lib/stages"
import { AwaitingSlice, Card, Kicker, Mono, Section } from "@/components/cockpit/primitives"
import { Countdown } from "@/components/cockpit/countdown"
import { EventDock } from "@/components/cockpit/event-dock"
import { IncidentPanel } from "@/components/cockpit/incident-panel"
import { ShortageStrip } from "@/components/cockpit/shortage-strip"
import { StageRail } from "@/components/cockpit/stage-rail"
import { SupplierTable } from "@/components/cockpit/supplier-table"
import { CallsPanel } from "@/components/cockpit/calls-panel"
import { cn } from "@/lib/utils"

const SECTIONS = [
  { id: "shortage", label: "Shortage" },
  { id: "suppliers", label: "Suppliers" },
  { id: "candidates", label: "Candidates" },
  { id: "calls", label: "Calls" },
  { id: "cost", label: "Cost" },
  { id: "decision", label: "Decision" },
]

export default function CockpitPage() {
  // Seeded synchronously from the fixture bundle so the case paints on first
  // render; in `live` mode these start empty and the effects below fill them.
  const [shortages, setShortages] = React.useState<ShortageAlert[]>(initialShortages)
  const [profile, setProfile] = React.useState<CompanyProfile | null>(initialProfile)
  const [caseId, setCaseId] = React.useState("CASE-001")
  const [snapshot, setSnapshot] = React.useState<CaseSnapshot | null>(() => initialCase("CASE-001"))
  const [running, setRunning] = React.useState(false)

  React.useEffect(() => {
    if (DATA_SOURCE === "fixtures") return
    getShortages().then(setShortages).catch(() => setShortages([]))
    getProfile().then(setProfile).catch(() => setProfile(null))
  }, [])

  React.useEffect(() => {
    setRunning(false)
    if (DATA_SOURCE === "fixtures") {
      setSnapshot(initialCase(caseId))
      return
    }
    getCase(caseId).then(setSnapshot).catch(() => setSnapshot(null))
  }, [caseId])

  // Replaying the recorded log is what "launch" does with the backend off. It is
  // the same read path live polling uses, at 4x -- not a second implementation.
  const { events, complete } = useEvents(caseId, { replay: true, speed: 4, enabled: running })
  const stage: Stage = events.length ? events[events.length - 1].stage : "detected"

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
                onClick={() => setRunning(true)}
                disabled={running && !complete}
                className={cn(
                  "inline-flex h-10 items-center gap-2 rounded-md px-[18px] text-[14px] font-medium transition-colors",
                  running && !complete
                    ? "cursor-not-allowed bg-hairline-soft text-muted-ink"
                    : "bg-primary text-on-primary hover:bg-primary-active",
                )}
              >
                {running ? (
                  complete ? <RotateCcw className="size-4" /> : null
                ) : (
                  <Play className="size-4" />
                )}
                {running ? (complete ? "Run again" : "Running…") : "Launch sourcing agent"}
              </button>
            }
          >
            <IncidentPanel snapshot={snapshot} />
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
            <AwaitingSlice
              owner=""
              what="Each candidate scored against the four rules in the company profile, with rejections named by rule — blocked origin, lapsed certification, unaudited supplier, lead time past the line stop."
              endpoint="GET /cases/{id} → candidates[]"
            />
          </Section>

          <Section
            id="calls"
            step={4}
            kicker="Outreach"
            title="What the suppliers actually said"
          >
            <CallsPanel
              caseId={snapshot.case_id}
              suppliers={snapshot.supplier_records ?? []}
              qty={snapshot.incident.qty_required}
            />
          </Section>

          <Section id="cost" step={5} kicker="Landed cost" title="Every option, fully costed">
            <AwaitingSlice
              owner="cost engine"
              what="Strategies compared on total landed cost — goods, freight, duty, carrying cost and expedite — with the ones that miss the line-stop date marked, and the recommended split highlighted."
              endpoint="GET /cases/{id} → decision.strategies[]"
            />
          </Section>

          <Section id="decision" step={6} kicker="The artifact" title="The decision, as a pull request">
            <AwaitingSlice
              owner="artifact writer"
              what="The rationale, the runner-up strategies, both green test suites, and a link to the pull request carrying the case, the policy report, the cost report and the PO draft."
              endpoint="GET /cases/{id} → decision.pr_url"
            />
          </Section>

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
          <div className="sticky top-16 h-[calc(100dvh-4rem)]">
            <EventDock events={events} replaying={running && !complete} />
          </div>
        </div>
      </div>
    </div>
  )
}
