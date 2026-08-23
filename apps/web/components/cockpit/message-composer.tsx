import type { ChatStatus } from "ai"

import { ArrowUpIcon } from "@/components/icons"
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input"

type MessageComposerProps = {
  value: string
  status: ChatStatus
  onChange: (value: string) => void
  onSend: (value: string) => void
  onStop: () => void
}

export function MessageComposer({
  value,
  status,
  onChange,
  onSend,
  onStop,
}: MessageComposerProps) {
  const sendDisabled =
    status === "submitted" || (status === "ready" && !value.trim())

  return (
    <div className="mx-auto w-full max-w-[50vw] px-4 py-3">
      <PromptInput
        className="w-full bg-card [&_[data-slot=input-group]]:border-border/70"
        onSubmit={({ text }) => onSend(text)}
      >
        <PromptInputBody>
          <PromptInputTextarea
            aria-label="Message SupplyOS"
            placeholder="Message SupplyOS"
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools />
          <PromptInputSubmit
            disabled={sendDisabled}
            status={status}
            onStop={status === "streaming" ? onStop : undefined}
          >
            {status === "ready" ? (
              <ArrowUpIcon aria-hidden="true" />
            ) : undefined}
          </PromptInputSubmit>
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}
