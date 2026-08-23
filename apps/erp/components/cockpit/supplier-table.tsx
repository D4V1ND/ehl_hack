import type { SupplierRecord } from "@/lib/contracts"
import { day, maskPhone, money, qty } from "@/lib/format"
import { Card, Kicker, Mono } from "@/components/cockpit/primitives"
import { cn } from "@/lib/utils"

/**
 * What OUR files say about each supplier -- the trusted baseline.
 *
 * Deliberately not "quotes": nothing here came from a phone call. Once Slice C
 * files claims, the comparison view sets these numbers against what each
 * supplier actually said.
 *
 * Phone numbers arrive masked from the API; `SupplierRecord` has no field for a
 * raw one.
 */
export function SupplierTable({
  suppliers,
  incumbentId,
}: {
  suppliers: SupplierRecord[]
  incumbentId?: string | null
}) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-hairline bg-canvas-soft text-left">
              {["Supplier", "Origin", "Contract price", "Lead", "Certification", "Audit", "Committed elsewhere", "Phone"].map(
                (heading, index) => (
                  <th
                    key={heading}
                    className={cn(
                      "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.88px] text-muted-ink",
                      index >= 2 && index <= 3 ? "text-right" : "",
                      index === 6 ? "text-right" : "",
                    )}
                  >
                    {heading}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {suppliers.map((supplier) => {
              const lapsed =
                supplier.certification_expires_at != null &&
                new Date(supplier.certification_expires_at) < new Date()
              return (
                <tr key={supplier.supplier_id} className="border-b border-hairline last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-ink">{supplier.supplier_name}</span>
                      {supplier.supplier_id === incumbentId ? (
                        <span className="rounded-pill bg-surface-strong px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.7px] text-muted-ink">
                          Incumbent
                        </span>
                      ) : null}
                    </div>
                    <Mono className="mt-1 inline-block">{supplier.supplier_id}</Mono>
                  </td>
                  <td className="px-4 py-3 text-body">{supplier.country}</td>
                  <td className="tnum px-4 py-3 text-right text-ink">
                    {money(supplier.contract_unit_price)}
                  </td>
                  <td className="tnum px-4 py-3 text-right text-ink">
                    {supplier.standard_lead_days ?? "—"} d
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {supplier.certifications?.length
                        ? supplier.certifications.map((cert) => (
                            <Mono key={cert}>{cert}</Mono>
                          ))
                        : <span className="text-muted-soft">none</span>}
                    </div>
                    <div
                      className={cn(
                        "mt-1 text-[12px]",
                        lapsed ? "text-semantic-error" : "text-muted-ink",
                      )}
                    >
                      {supplier.certification_expires_at
                        ? `${lapsed ? "lapsed" : "valid to"} ${day(supplier.certification_expires_at)}`
                        : "no expiry on record"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "text-[13px]",
                        supplier.audit_status === "audited"
                          ? "text-semantic-success"
                          : "text-semantic-warning",
                      )}
                    >
                      {(supplier.audit_status ?? "never_audited").replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="tnum px-4 py-3 text-right text-body">
                    {supplier.known_allocations ? qty(supplier.known_allocations) : "—"}
                  </td>
                  <td className="tnum px-4 py-3 text-muted-ink">
                    {maskPhone(supplier.phone_masked)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-hairline bg-canvas-soft px-4 py-2.5">
        <Kicker>
          Records
        </Kicker>
      </div>
    </Card>
  )
}
