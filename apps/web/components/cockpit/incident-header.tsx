import {
  ChevronDownIcon,
  CostIcon,
  FactoryIcon,
  type IconComponent,
  LineStopIcon,
  PanelRightOpenIcon,
  PartIcon,
  QuantityIcon,
  RotateCcwIcon,
  WarehouseIcon,
} from "@/components/icons"
import { DotLoader } from "@/components/cockpit/dot-loader"
import { Button } from "@/components/ui/button"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { SidebarTrigger } from "@/components/ui/sidebar"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { INCIDENT } from "@/lib/case-001"

const hoursToLineStop = Number(INCIDENT.lineStopDays) * 24
const standingStill = `${INCIDENT.lineStopCostPerHour.replace(/\.00$/, "")} / h`

type IncidentHeaderProps = {
  running: boolean
  onReplay: () => void
  showOpenCandidates: boolean
  onOpenCandidates: () => void
}

export function IncidentHeader(props: IncidentHeaderProps) {
  return (
    <Collapsible className="shrink-0">
      <header className="group/incident-header flex h-11 items-center gap-2 border-b border-border/70 bg-background px-3">
        <SidebarTrigger className="md:hidden" />
        <CollapsibleTrigger
          className="group/incident-trigger flex min-w-0 flex-1 items-center gap-4 rounded-md px-1 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Toggle Incident details"
        >
          <span className="font-mono text-sm">{INCIDENT.caseId}</span>
          <span className="hidden text-sm md:inline">
            {INCIDENT.lineStopDays} days to line stop
          </span>
          <ChevronDownIcon
            aria-hidden="true"
            className="size-4 shrink-0 text-muted-foreground opacity-0 transition-[opacity,transform] group-hover/incident-header:opacity-100 group-focus-visible/incident-trigger:opacity-100 group-data-[panel-open]/incident-trigger:rotate-180 group-data-[panel-open]/incident-trigger:opacity-100 motion-reduce:transition-none"
          />
        </CollapsibleTrigger>
        <HeaderActions {...props} />
      </header>
      <CollapsibleContent className="border-b border-border/70 bg-muted/20">
        <dl className="grid gap-x-6 gap-y-4 px-4 py-4 sm:grid-cols-2 xl:grid-cols-3">
          <IncidentProperty
            icon={FactoryIcon}
            label="Plants"
            value={INCIDENT.plant}
          />
          <IncidentProperty
            icon={PartIcon}
            label="Part"
            value={`${INCIDENT.partId} · ${INCIDENT.description}`}
          />
          <IncidentProperty
            icon={QuantityIcon}
            label="Quantity short"
            value={formatQuantity(INCIDENT.shortfall)}
          />
          <IncidentProperty
            icon={LineStopIcon}
            label="To line-stop"
            value={`${INCIDENT.lineStopDays} d · ${hoursToLineStop} h`}
          />
          <IncidentProperty
            icon={CostIcon}
            label="Standing still"
            value={standingStill}
          />
          <IncidentProperty
            icon={WarehouseIcon}
            label="Inventory"
            value={`${formatQuantity(INCIDENT.qtyOnHand)} on hand · ${formatQuantity(INCIDENT.qtyRequired)} required`}
          />
        </dl>
      </CollapsibleContent>
    </Collapsible>
  )
}

function HeaderActions(props: IncidentHeaderProps) {
  return (
    <div className="ml-auto flex shrink-0 items-center gap-1">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        disabled={props.running}
        onClick={props.onReplay}
      >
        {props.running ? (
          <DotLoader />
        ) : (
          <RotateCcwIcon data-icon="inline-start" />
        )}
        {props.running ? "Running" : "Replay"}
      </Button>
      {props.showOpenCandidates ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label="Open Candidates sidebar"
                onClick={props.onOpenCandidates}
              >
                <PanelRightOpenIcon aria-hidden="true" />
              </Button>
            }
          />
          <TooltipContent side="bottom">Open Candidates</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  )
}

function IncidentProperty({
  icon: Icon,
  label,
  value,
}: {
  icon: IconComponent
  label: string
  value: string
}) {
  return (
    <div className="grid min-w-0 grid-cols-[1.25rem_minmax(0,1fr)] gap-x-2.5">
      <Icon
        aria-hidden="true"
        className="mt-0.5 size-4 text-muted-foreground"
        stroke={1.75}
      />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium break-words tabular-nums">
          {value}
        </dd>
      </div>
    </div>
  )
}

function formatQuantity(quantity: string): string {
  return Number(quantity).toLocaleString("en-US").replaceAll(",", "\u00a0")
}
