import type { Metadata } from "next"
import Link from "next/link"

import { CockpitShell } from "@/components/cockpit/cockpit-shell"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { INCIDENTS, type IncidentStage } from "@/lib/case-001"

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "Incidents the ERP already flagged. Open a row to watch the sourcing run.",
}

export default function DashboardPage() {
  return (
    <CockpitShell active="dashboard">
      <div className="min-h-0 flex-1 overflow-auto px-6 py-8">
        <p className="text-muted-foreground font-mono text-xs tracking-wider uppercase">
          /dashboard
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Incidents</h1>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          Shortages the ERP already flagged. Open a row to launch or watch the
          sourcing run.
        </p>
        <Table className="mt-8">
          <TableHeader>
            <TableRow>
              <TableHead>Case</TableHead>
              <TableHead>Part</TableHead>
              <TableHead>Line stop</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>Plant</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {INCIDENTS.map((incident) => (
              <TableRow
                key={incident.caseId}
                className={incident.href ? "bg-muted/60" : undefined}
              >
                <TableCell className="font-mono">
                  {incident.href ? (
                    <Link
                      href={incident.href}
                      className="underline-offset-4 hover:underline"
                    >
                      {incident.caseId}
                    </Link>
                  ) : (
                    incident.caseId
                  )}
                </TableCell>
                <TableCell>{incident.partLabel}</TableCell>
                <TableCell className="tabular-nums">
                  {incident.lineStopDays ? `${incident.lineStopDays} days` : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={stageBadgeVariant(incident.stage)}>
                    {incident.stage}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {incident.plant}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="text-muted-foreground mt-6 text-sm">
          Open CASE-001 to go to /chat for that Incident.
        </p>
      </div>
    </CockpitShell>
  )
}

function stageBadgeVariant(
  stage: IncidentStage
): "default" | "secondary" | "outline" {
  if (stage === "open") {
    return "default"
  }
  if (stage === "calling") {
    return "secondary"
  }
  return "outline"
}
