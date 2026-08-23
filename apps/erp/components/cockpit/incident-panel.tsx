import type { CaseSnapshot } from "@/lib/contracts"
import { day, money, qty } from "@/lib/format"
import { Card, Mono, Stat } from "@/components/cockpit/primitives"
import { Countdown } from "@/components/cockpit/countdown"

/**
 * The shortage, as our own records see it. No supplier has been contacted yet.
 */
export function IncidentPanel({ snapshot }: { snapshot: CaseSnapshot }) {
  const { incident, part } = snapshot
  const shortfall = Math.max(incident.qty_required - incident.qty_on_hand, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Needed"
          value={qty(incident.qty_required)}
          hint={`by ${day(incident.needed_by)}`}
        />
        <Stat
          label="On hand"
          value={qty(incident.qty_on_hand)}
          hint={`${qty(shortfall)} short`}
          tone="warning"
        />
        <Stat
          label="Line stops in"
          value={<Countdown target={incident.line_stop_at} />}
          hint={day(incident.line_stop_at)}
          tone="danger"
        />
        <Stat
          label="Cost of standing still"
          value={`${money(incident.line_stop_cost_per_hour)}/h`}
          hint={`${incident.plant_id} · ${incident.production_line}`}
          tone="danger"
        />
      </div>

      <Card className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Mono>{part.item_code}</Mono>
          <span className="text-[15px] text-ink">{part.item_name}</span>
          <Mono className="text-muted-ink">{part.part_class}</Mono>
          <Mono className="text-muted-ink">criticality: {part.criticality}</Mono>
        </div>
        <p className="mt-2 max-w-3xl text-[14px] leading-[1.5] text-body">{part.description}</p>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          {Object.entries(part.spec ?? {}).map(([key, value]) => (
            <div key={key}>
              <dt className="text-[11px] uppercase tracking-[0.7px] text-muted-soft">
                {key.replace(/_/g, " ")}
              </dt>
              <dd className="tnum text-[13px] text-ink">{value}</dd>
            </div>
          ))}
          <div>
            <dt className="text-[11px] uppercase tracking-[0.7px] text-muted-soft">weight</dt>
            <dd className="tnum text-[13px] text-ink">{part.weight_kg} kg</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-[0.7px] text-muted-soft">hs code</dt>
            <dd className="tnum text-[13px] text-ink">{part.hs_code}</dd>
          </div>
        </dl>

        {incident.reason ? (
          <p className="mt-4 border-t border-hairline pt-3 text-[14px] leading-[1.5] text-body">
            <span className="font-medium text-ink">Reason: </span>
            {incident.reason}
          </p>
        ) : null}
      </Card>
    </div>
  )
}
