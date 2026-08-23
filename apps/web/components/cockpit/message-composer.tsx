import type { ChatStatus } from "ai";

import { ArrowUpIcon } from "@/components/icons";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";

export type ComposerState =
  | { status: "disabled"; reason: string }
  | { status: "ready" }
  | { status: "submitting" }
  | { status: "streaming" }
  | { status: "error"; message: string };

export function MessageComposer({
  value,
  state,
  onChange,
  onSend,
  onStop,
}: {
  value: string;
  state: ComposerState;
  onChange: (value: string) => void;
  onSend: (value: string) => void;
  onStop?: () => void;
}) {
  const disabled = state.status === "disabled";
  const submitDisabled = state.status !== "ready" || !value.trim();
  const status = chatStatus(state);
  const explanation =
    state.status === "disabled"
      ? state.reason
      : state.status === "error"
        ? state.message
        : null;

  return (
    <div className="border-t border-border/70 bg-background px-3 py-3 sm:px-4">
      <div className="mx-auto w-full max-w-3xl">
        <PromptInput
          aria-disabled={disabled}
          aria-describedby={explanation ? "composer-explanation" : undefined}
          className="w-full bg-card [&_[data-slot=input-group]]:border-border/70"
          onSubmit={({ text }) => {
            if (state.status === "ready" && text.trim()) onSend(text);
          }}
        >
          <PromptInputBody>
            <PromptInputTextarea
              aria-label="Message SupplyOS"
              placeholder="Message SupplyOS"
              value={value}
              disabled={disabled}
              readOnly={state.status === "submitting"}
              onChange={(event) => onChange(event.currentTarget.value)}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              {explanation ? (
                <p
                  id="composer-explanation"
                  className="truncate px-1 text-[11px] text-muted-foreground"
                >
                  {explanation}
                </p>
              ) : null}
            </PromptInputTools>
            <PromptInputSubmit
              disabled={submitDisabled}
              status={status}
              onStop={state.status === "streaming" ? onStop : undefined}
            >
              {state.status === "ready" ? (
                <ArrowUpIcon aria-hidden="true" />
              ) : undefined}
            </PromptInputSubmit>
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}

function chatStatus(state: ComposerState): ChatStatus {
  if (state.status === "submitting") return "submitted";
  if (state.status === "streaming") return "streaming";
  if (state.status === "error") return "error";
  return "ready";
}
