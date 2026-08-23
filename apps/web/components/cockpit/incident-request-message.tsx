import { Message, MessageContent } from "@/components/ai-elements/message"
import { INCIDENT } from "@/lib/case-001"

export function IncidentRequestMessage() {
  return (
    <Message from="user">
      <MessageContent>
        <p className="leading-6">
          Resolve{" "}
          <span className="inline-flex items-center gap-1 rounded-md bg-primary/30 px-1 py-[1px] align-baseline text-xs font-medium text-primary">
            @
            <span className="text-foreground">
              {INCIDENT.caseId} · {INCIDENT.partId}
            </span>
          </span>{" "}
          by finding Candidates, gathering Claims, and recommending a Decision.
        </p>
      </MessageContent>
    </Message>
  )
}
