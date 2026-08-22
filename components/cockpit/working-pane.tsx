"use client"

import { CheckIcon, GitPullRequestIcon } from "@/components/icons"

import { CallResult } from "@/components/cockpit/call-result"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ButtonGroup } from "@/components/ui/button-group"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  CALLS,
  CANDIDATES,
  CASE_FILES,
  LANDED_LINES,
  PR_PATH,
  SCRIPT,
  STRATEGIES,
  type ScriptKind,
  type ScriptStep,
  type StockStatus,
} from "@/lib/case-001"
import { cn } from "@/lib/utils"

export type WorkingTab = "files" | "results"

const STAGES = [
  { key: "part", label: "part" },
  { key: "stock", label: "stock" },
  { key: "candidates", label: "candidates" },
  { key: "calls", label: "calls" },
  { key: "decision", label: "decision" },
] as const

type StageKey = (typeof STAGES)[number]["key"]

export function WorkingPane({
  visible,
  tab,
  onTabChange,
}: {
  visible: number
  tab: WorkingTab
  onTabChange: (tab: WorkingTab) => void
}) {
  const visibleSteps = SCRIPT.slice(0, visible)
  const visibleIds = new Set(visibleSteps.map((step) => step.id))
  const kinds = new Set(visibleSteps.map((step) => step.kind))
  const files = CASE_FILES.filter((file) => visibleIds.has(file.afterId))
  const resultKind = resultKindFor(visibleSteps)

  return (
    <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden border-l border-border bg-card">
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border px-3">
        <ButtonGroup>
          <Button
            size="sm"
            variant={tab === "files" ? "default" : "ghost"}
            aria-pressed={tab === "files"}
            onClick={() => onTabChange("files")}
          >
            Files
          </Button>
          <Button
            size="sm"
            variant={tab === "results" ? "default" : "ghost"}
            aria-pressed={tab === "results"}
            onClick={() => onTabChange("results")}
          >
            Results
          </Button>
        </ButtonGroup>
      </div>
      {tab === "files" ? (
        <FileList files={files} ids={visibleIds} kinds={kinds} />
      ) : (
        <ResultsPanel
          kind={resultKind}
          visibleIds={visibleIds}
          files={files}
        />
      )}
    </aside>
  )
}

function FileList({
  files,
  ids,
  kinds,
}: {
  files: readonly (typeof CASE_FILES)[number][]
  ids: ReadonlySet<string>
  kinds: ReadonlySet<ScriptKind>
}) {
  if (files.length === 0 && ids.size === 0) {
    return (
      <p className="text-muted-foreground p-4 text-sm">No artifacts yet.</p>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      {ids.size > 0 ? <StageChecklist ids={ids} kinds={kinds} /> : null}
      {files.length === 0 ? (
        <p className="text-muted-foreground px-4 py-2 text-sm">
          No artifacts yet.
        </p>
      ) : (
        <ul className="flex flex-col p-2">
          {files.map((file) => (
            <li
              key={file.name}
              className="flex items-center gap-3 px-3 py-2 text-sm"
            >
              <span className="text-muted-foreground w-8 shrink-0 font-mono text-xs">
                {file.ext}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono">
                {file.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StageChecklist({
  ids,
  kinds,
}: {
  ids: ReadonlySet<string>
  kinds: ReadonlySet<ScriptKind>
}) {
  return (
    <ol className="flex flex-col gap-1 border-b border-border px-4 py-3">
      {STAGES.map((stage) => {
        const done = stageDone(stage.key, ids, kinds)
        return (
          <li
            key={stage.key}
            className={cn(
              "flex items-center gap-2 text-sm",
              done ? "text-foreground" : "text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "flex size-3.5 shrink-0 items-center justify-center border",
                done
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border"
              )}
              aria-hidden
            >
              {done ? <CheckIcon className="size-2.5" /> : null}
            </span>
            <span className="font-mono text-xs">{stage.label}</span>
          </li>
        )
      })}
    </ol>
  )
}

function stageDone(
  key: StageKey,
  ids: ReadonlySet<string>,
  kinds: ReadonlySet<ScriptKind>
) {
  if (key === "part") return ids.has("part")
  if (key === "stock") return ids.has("stock")
  if (key === "candidates") return ids.has("suppliers")
  if (key === "calls") return kinds.has("outreach") || kinds.has("claims")
  return kinds.has("decision")
}

function ResultsPanel({
  kind,
  visibleIds,
  files,
}: {
  kind: ResultKind
  visibleIds: ReadonlySet<string>
  files: readonly (typeof CASE_FILES)[number][]
}) {
  if (kind === "call") {
    const call = latestCall(visibleIds)
    if (!call) {
      return (
        <p className="text-muted-foreground p-4 text-sm">No results yet.</p>
      )
    }
    return <CallResult call={call} />
  }
  if (kind === "compare") {
    return <ClaimRecordTable />
  }
  if (kind === "decision") {
    return <DecisionResult files={files} />
  }
  return (
    <p className="text-muted-foreground p-4 text-sm">No results yet.</p>
  )
}

function latestCall(visibleIds: ReadonlySet<string>) {
  const matches = CALLS.filter((call) => visibleIds.has(call.afterId))
  return matches.at(-1) ?? null
}

function ClaimRecordTable() {
  const rows = CANDIDATES.filter((candidate) => candidate.claimUnit)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-auto p-3">
      <Table>
        <TableCaption>
          Claim | Supplier Record. Claims are not facts.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Candidate</TableHead>
            <TableHead>Record unit</TableHead>
            <TableHead>Claim unit</TableHead>
            <TableHead>Record lead</TableHead>
            <TableHead>Claim lead</TableHead>
            <TableHead>stock_status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((candidate) => {
            const unitDelta = candidate.claimUnit !== candidate.recordUnit
            const leadDelta = candidate.claimLeadDays !== candidate.recordLeadDays
            return (
              <TableRow key={candidate.name}>
                <TableCell>{candidate.name}</TableCell>
                <TableCell
                  className={cn(
                    "font-mono tabular-nums",
                    unitDelta && "font-medium"
                  )}
                >
                  {candidate.recordUnit}
                </TableCell>
                <TableCell
                  className={cn(
                    "font-mono tabular-nums",
                    unitDelta && "font-medium"
                  )}
                >
                  {candidate.claimUnit}
                </TableCell>
                <TableCell
                  className={cn(
                    "font-mono tabular-nums",
                    leadDelta && "font-medium"
                  )}
                >
                  {candidate.recordLeadDays}
                </TableCell>
                <TableCell
                  className={cn(
                    "font-mono tabular-nums",
                    leadDelta && "font-medium"
                  )}
                >
                  {candidate.claimLeadDays}
                </TableCell>
                <TableCell>
                  <Badge variant={stockBadgeVariant(candidate.stockStatus!)}>
                    {candidate.stockStatus}
                  </Badge>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <Table>
        <TableCaption>Landed Cost. Unused lines are allocated.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Candidate</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead>Goods</TableHead>
            <TableHead>Freight</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Usable</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {LANDED_LINES.map((line) => (
            <TableRow
              key={line.supplier}
              className={cn(!line.usable && "text-muted-foreground")}
            >
              <TableCell>{line.supplier}</TableCell>
              <TableCell className="font-mono">{line.mode}</TableCell>
              <TableCell className="font-mono tabular-nums">
                {line.goods}
              </TableCell>
              <TableCell className="font-mono tabular-nums">
                {line.freight}
              </TableCell>
              <TableCell className="font-mono tabular-nums">
                {line.total}
              </TableCell>
              <TableCell>
                {line.usable ? (
                  <Badge variant="secondary">usable</Badge>
                ) : (
                  <Badge variant="destructive">unused</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Table>
        <TableCaption>
          Cheapest unit price is not the Decision. Recommended: split 20% SKF
          air + 80% FAG sea.
        </TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Strategy</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Note</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {STRATEGIES.map((strategy) => (
            <TableRow
              key={strategy.name}
              data-state={strategy.recommended ? "selected" : undefined}
            >
              <TableCell>
                <span className="flex items-center gap-2">
                  {strategy.name}
                  {strategy.recommended ? (
                    <Badge variant="default">recommended</Badge>
                  ) : null}
                </span>
              </TableCell>
              <TableCell className="font-mono tabular-nums">
                {strategy.total}
              </TableCell>
              <TableCell className="text-muted-foreground whitespace-normal">
                {strategy.note}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function DecisionResult({
  files,
}: {
  files: readonly (typeof CASE_FILES)[number][]
}) {
  const prHref = PR_PATH.startsWith("http") ? PR_PATH : `https://${PR_PATH}`

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
      {files.length > 0 ? (
        <ul className="flex flex-col">
          {files.map((file) => (
            <li
              key={file.name}
              className="flex items-center gap-3 py-1.5 text-sm"
            >
              <span className="text-muted-foreground w-8 shrink-0 font-mono text-xs">
                {file.ext}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono">
                {file.name}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitPullRequestIcon className="size-4" />
            Pull request
          </CardTitle>
          <CardDescription className="font-mono">
            branch case/CASE-001
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary">pass</Badge>
            <span>policy suite</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary">pass</Badge>
            <span>cost_model suite</span>
          </div>
          <p className="text-muted-foreground text-sm">
            A human approves by merging. No in-app Approve.
          </p>
        </CardContent>
        <CardFooter>
          <Button
            size="sm"
            nativeButton={false}
            render={<a href={prHref} target="_blank" rel="noreferrer" />}
          >
            Open PR
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

type ResultKind = "empty" | "call" | "compare" | "decision"

function resultKindFor(steps: ScriptStep[]): ResultKind {
  const kinds = new Set(steps.map((step) => step.kind))
  if (kinds.has("decision")) {
    return "decision"
  }
  if (kinds.has("deltas") || kinds.has("strategy") || kinds.has("tests")) {
    return "compare"
  }
  if (kinds.has("outreach") || kinds.has("claims")) {
    return "call"
  }
  return "empty"
}

function stockBadgeVariant(
  status: StockStatus
): "secondary" | "destructive" | "outline" {
  if (status === "in_stock_allocated" || status === "unavailable") {
    return "destructive"
  }
  if (status === "free_in_stock") {
    return "secondary"
  }
  return "outline"
}

export function paneForVisible(visible: number): WorkingTab {
  const kind = resultKindFor(SCRIPT.slice(0, visible))
  return kind === "empty" ? "files" : "results"
}
