import { Bubble, BubbleContent } from "@/components/ui/bubble"
import { Message, MessageContent, MessageHeader } from "@/components/ui/message"
import {
  MessageScroller,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from "@/components/ui/message-scroller"
import { INCIDENT, type RehearsalCall } from "@/lib/case-001"

export function CallTranscript({ call }: { call: RehearsalCall }) {
  const disclosure = call.transcript[0]?.text ?? ""
  const systemPrompt = `Outreach Task: call ${call.supplier} at ${call.maskedPhone} in rehearsal mode about ${INCIDENT.partId}. Begin with the mandatory disclosure: “${disclosure}” Then gather quantity, earliest readiness, unit price, free-versus-allocated stock, exact part confirmation, and certification status. Do not make commitments.`

  return (
    <section
      className="call-sidebar flex size-full min-h-0 flex-col"
      aria-labelledby="transcript-heading"
    >
      <div className="flex h-11 shrink-0 items-center border-b border-border px-4">
        <h2 id="transcript-heading" className="text-sm font-medium">
          Transcript
        </h2>
      </div>
      <MessageScrollerProvider>
        <MessageScroller>
          <MessageScrollerViewport>
            <MessageScrollerContent className="gap-6 p-4 sm:p-5">
              <MessageScrollerItem>
                <div className="flex flex-col gap-3 px-1">
                  <MessageHeader className="px-0">System</MessageHeader>
                  <p className="max-w-[70ch] text-sm leading-6 text-pretty text-muted-foreground">
                    {systemPrompt}
                  </p>
                </div>
              </MessageScrollerItem>
              {call.transcript.map((turn, index) => {
                const isAgent = turn.speaker === "Agent"

                return (
                  <MessageScrollerItem key={`${turn.speaker}-${index}`}>
                    <Message align={isAgent ? "start" : "end"}>
                      <MessageContent>
                        <MessageHeader
                          className={isAgent ? "px-0" : "justify-end px-0"}
                        >
                          {isAgent ? "Agent" : call.supplier}
                        </MessageHeader>
                        {isAgent ? (
                          <p className="max-w-[80%] text-sm leading-6 text-pretty">
                            {turn.text}
                          </p>
                        ) : (
                          <Bubble variant="secondary" align="end">
                            <BubbleContent>{turn.text}</BubbleContent>
                          </Bubble>
                        )}
                      </MessageContent>
                    </Message>
                  </MessageScrollerItem>
                )
              })}
            </MessageScrollerContent>
          </MessageScrollerViewport>
        </MessageScroller>
      </MessageScrollerProvider>
    </section>
  )
}
