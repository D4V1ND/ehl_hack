"use client"

import {
  Message,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message"
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolOutput,
} from "@/components/ai-elements/tool"
import {
  Calculator,
  ChevronRightIcon,
  CostIcon,
  PartIcon,
  Phone,
  SearchIcon,
  ShieldCheck,
  WarehouseIcon,
  WrenchIcon,
  type IconComponent,
} from "@/components/icons"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { getStepResponse, type ScriptStep } from "@/lib/case-001"
import { useStickToBottomContext } from "use-stick-to-bottom"

type AssistantTurnPhase = "pending" | "streaming" | "stopped" | "complete"

export function CompletedRunSummary({ steps }: { steps: ScriptStep[] }) {
  const toolCalls = steps.filter((step) => step.method && step.path)
  const { scrollRef, stopScroll } = useStickToBottomContext()

  function preserveViewport() {
    const scrollElement = scrollRef.current
    if (!scrollElement) return

    const scrollTop = scrollElement.scrollTop
    stopScroll()
    window.requestAnimationFrame(() => {
      scrollElement.scrollTop = scrollTop
      window.requestAnimationFrame(() => {
        scrollElement.scrollTop = scrollTop
      })
    })
  }

  return (
    <Collapsible className="not-prose w-full" onOpenChange={preserveViewport}>
      <CollapsibleTrigger className="group/run-summary flex w-full items-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none">
        <ChevronRightIcon className="size-3.5 shrink-0 transition-transform duration-200 ease-[cubic-bezier(0.77,0,0.175,1)] group-data-[panel-open]/run-summary:rotate-90 motion-reduce:transition-none" />
        <span>
          {toolCalls.length} tool calls, {steps.length} messages
        </span>
        <span className="flex min-w-0 items-center gap-1" aria-hidden="true">
          {toolCalls.map((step) => {
            const ToolIcon = toolIconFor(step)

            return (
              <ToolIcon
                key={step.id}
                className="size-3.5 shrink-0 text-muted-foreground/70"
              />
            )
          })}
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-2">
        {steps.map((step) => (
          <AssistantTurn key={step.id} step={step} phase="complete" />
        ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

const TOOL_ICONS: Record<string, IconComponent> = {
  part: PartIcon,
  stock: WarehouseIcon,
  suppliers: SearchIcon,
  prices: CostIcon,
  policy: ShieldCheck,
  outreach: Phone,
  strategy: Calculator,
}

function toolIconFor(step: ScriptStep): IconComponent {
  if (step.kind === "outreach") return Phone
  if (step.id.startsWith("web-")) return SearchIcon
  return TOOL_ICONS[step.id] ?? WrenchIcon
}

export function AssistantTurn({
  step,
  phase,
  text,
}: {
  step: ScriptStep
  phase: AssistantTurnPhase
  text?: string
}) {
  const pending = phase === "pending"
  const response = text ?? getStepResponse(step)

  if (pending && !(step.method && step.path)) return null

  return (
    <Message from="assistant" className="max-w-full">
      <MessageContent className="w-full max-w-full">
        {!pending && response ? (
          <MessageResponse isAnimating={phase === "streaming"}>
            {response}
          </MessageResponse>
        ) : null}
        {step.method && step.path ? (
          <Tool defaultOpen={false} className="mb-0">
            <ToolHeader
              type={`tool-${step.id}`}
              state={pending ? "input-available" : "output-available"}
              title={`${step.method} ${step.path}`}
            />
            {!pending ? (
              <ToolContent>
                <ToolOutput
                  output={<p className="p-3 text-pretty">{step.detail}</p>}
                  errorText={undefined}
                />
              </ToolContent>
            ) : null}
          </Tool>
        ) : null}
        {phase === "complete" ? <StepExtras step={step} /> : null}
      </MessageContent>
    </Message>
  )
}

function StepExtras({ step }: { step: ScriptStep }) {
  if (step.kind === "policy") {
    return (
      <Alert variant="destructive">
        <AlertTitle>Shenzhen Bearing Co rejected</AlertTitle>
        <AlertDescription>
          Rule <span className="font-mono">blocked_origin_country</span>. No
          Outreach Task.
        </AlertDescription>
      </Alert>
    )
  }

  if (step.kind === "deltas") {
    return (
      <p className="text-sm text-muted-foreground">
        Munich Motion Claim is{" "}
        <Badge variant="destructive">in_stock_allocated</Badge> — that stock is
        not ours.
      </p>
    )
  }

  return null
}
