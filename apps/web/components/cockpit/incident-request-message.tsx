import { Message, MessageContent } from "@/components/ai-elements/message"
import { INCIDENT } from "@/lib/case-001"

export function IncidentRequestMessage() {
  return (
    <Message from="user">
      <MessageContent>
        <p className="leading-6">
          Resolve{" "}
          <span className="inline-flex items-center gap-1.5 rounded-md bg-input px-1.5 py-[1px] align-baseline text-xs font-medium text-foreground">
            <span
              aria-hidden="true"
              className="size-1.5 rounded-full bg-accent-foreground"
            />
            <span>
              @{INCIDENT.caseId} · {INCIDENT.partId}
            </span>
          </span>{" "}
          by finding Candidates, gathering Claims, and recommending a Decision.
        </p>
      </MessageContent>
    </Message>
  )
}
