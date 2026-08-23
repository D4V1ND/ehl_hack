"use client"

import * as React from "react"
import { ArrowUpRight } from "lucide-react"

import {
  DATA_SOURCE,
  getCase,
  getProfile,
  getShortages,
  initialCase,
  initialProfile,
  initialShortages,
} from "@/lib/api/client"
import type { CaseSnapshot, CompanyProfile, ShortageAlert } from "@/lib/contracts"
import { Card, Kicker, Mono, Section } from "@/components/cockpit/primitives"
import { Countdown } from "@/components/cockpit/countdown"
import { IncidentPanel } from "@/components/cockpit/incident-panel"
import { ShortageStrip } from "@/components/cockpit/shortage-strip"
import { SupplierTable } from "@/components/cockpit/supplier-table"

const SUPPLYOS_URL = process.env.NEXT_PUBLIC_SUPPLYOS_URL ?? "http://localhost:3000/chat"

function supplyOsCaseUrl(caseId: string): string {
  const target = new URL(SUPPLYOS_URL)
  target.searchParams.set("case", caseId)
  return target.toString()
}

export default function CockpitPage() {
  const [shortages, setShortages] = React.useState<ShortageAlert[]>(initialShortages)
  const [profile, setProfile] = React.useState<CompanyProfile | null>(initialProfile)
  const [caseId, setCaseId] = React.useState("CASE-001")
  const [liveSnapshot, setLiveSnapshot] = React.useState<CaseSnapshot | null>(null)
  const snapshot = DATA_SOURCE === "fixtures" ? initialCase(caseId) : liveSnapshot

  React.useEffect(() => {
    if (DATA_SOURCE === "fixtures") return
    getShortages().then(setShortages).catch(() => setShortages([]))
    getProfile().then(setProfile).catch(() => setProfile(null))
  }, [])

  React.useEffect(() => {
    if (DATA_SOURCE === "fixtures") return
    getCase(caseId).then(setLiveSnapshot).catch(() => setLiveSnapshot(null))
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
            <span className="text-[17px] font-semibold text-ink">European Operations ERP</span>
            <span className="hidden h-4 w-px bg-hairline-strong sm:block" />
            <Mono className="hidden sm:inline-block">{snapshot.case_id}</Mono>
            <span className="hidden text-[14px] text-body md:inline">{snapshot.part.item_code}</span>
          </div>

          <div className="hidden items-baseline gap-2 lg:flex">
            <Kicker>Line stops in</Kicker>
            <Countdown target={snapshot.incident.line_stop_at} className="text-[15px]" />
          </div>
        </div>
      </header>

      <ShortageStrip shortages={shortages} selectedCaseId={caseId} onSelect={setCaseId} />

      <main className="mx-auto max-w-[1180px] px-6 pb-24 lg:px-10">
        <nav className="sticky top-16 z-30 -mx-1 flex items-center gap-1 border-b border-hairline bg-canvas/95 px-1 py-3 backdrop-blur">
          <a className="rounded-sm px-2.5 py-1 text-[13px] text-body hover:bg-hairline-soft" href="#shortage">
            Shortage
          </a>
          <a className="rounded-sm px-2.5 py-1 text-[13px] text-body hover:bg-hairline-soft" href="#suppliers">
            Supplier Records
          </a>
        </nav>

        <Section
          id="shortage"
          step={1}
          kicker="The shortage"
          title="Requires Attention"
          aside={
            <a
              href={supplyOsCaseUrl(snapshot.case_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-[18px] text-[14px] font-medium text-on-primary transition-colors hover:bg-primary-active"
            >
              Request fix via agent
              <ArrowUpRight className="size-4" />
            </a>
          }
        >
          <IncidentPanel snapshot={snapshot} />
        </Section>

        <Section id="suppliers" step={2} kicker="System of record" title="Supplier Records">
          <SupplierTable
            suppliers={snapshot.supplier_records ?? []}
            incumbentId={snapshot.incident.incumbent_supplier_id}
          />
          {profile ? (
            <Card className="mt-3 px-5 py-4">
              <Kicker>Trusted company policy</Kicker>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-body">
                <span>{profile.legal_entity}</span>
                <span>· blocked origins</span>
                <Mono>{(profile.blocked_origin_countries ?? []).join(", ") || "none"}</Mono>
              </div>
            </Card>
          ) : null}
        </Section>

        <footer className="border-t border-hairline py-6 text-[12px] text-muted-ink">
          Trusted ERP records stay separate from supplier Claims in SupplyOS.
        </footer>
      </main>
    </div>
  )
}
