"use client"

import type { ChatStatus, FileUIPart } from "ai"
import {
  useCallback,
  useState,
  type ComponentProps,
  type FormEvent,
  type HTMLAttributes,
  type KeyboardEventHandler,
} from "react"
import { CornerDownLeftIcon, SquareIcon, XIcon } from "@/components/icons"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export interface PromptInputMessage {
  text: string
  files: FileUIPart[]
}

export type PromptInputProps = Omit<
  HTMLAttributes<HTMLFormElement>,
  "onSubmit"
> & {
  onSubmit: (
    message: PromptInputMessage,
    event: FormEvent<HTMLFormElement>
  ) => void | Promise<void>
}

export function PromptInput({
  className,
  onSubmit,
  children,
  ...props
}: PromptInputProps) {
  return (
    <form
      className={cn("w-full", className)}
      onSubmit={(event) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        void onSubmit(
          { files: [], text: String(formData.get("message") ?? "") },
          event
        )
      }}
      {...props}
    >
      <InputGroup className="overflow-hidden">{children}</InputGroup>
    </form>
  )
}

export type PromptInputBodyProps = HTMLAttributes<HTMLDivElement>

export function PromptInputBody({ className, ...props }: PromptInputBodyProps) {
  return <div className={cn("contents", className)} {...props} />
}

export type PromptInputTextareaProps = ComponentProps<typeof InputGroupTextarea>

export function PromptInputTextarea({
  onKeyDown,
  className,
  placeholder = "What would you like to know?",
  ...props
}: PromptInputTextareaProps) {
  const [isComposing, setIsComposing] = useState(false)
  const handleKeyDown: KeyboardEventHandler<HTMLTextAreaElement> = useCallback(
    (event) => {
      onKeyDown?.(event)
      if (event.defaultPrevented || event.key !== "Enter") return
      if (isComposing || event.nativeEvent.isComposing || event.shiftKey) return

      event.preventDefault()
      const submit = event.currentTarget.form?.querySelector(
        'button[type="submit"]'
      ) as HTMLButtonElement | null
      if (!submit?.disabled) event.currentTarget.form?.requestSubmit()
    },
    [isComposing, onKeyDown]
  )

  return (
    <InputGroupTextarea
      className={cn("field-sizing-content max-h-48 min-h-16", className)}
      name="message"
      onCompositionEnd={() => setIsComposing(false)}
      onCompositionStart={() => setIsComposing(true)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      {...props}
    />
  )
}

export type PromptInputFooterProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "align"
>

export function PromptInputFooter({
  className,
  ...props
}: PromptInputFooterProps) {
  return (
    <InputGroupAddon
      align="block-end"
      className={cn("justify-between gap-1", className)}
      {...props}
    />
  )
}

export function PromptInputTools(props: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn("flex min-w-0 items-center gap-1", props.className)}
    />
  )
}

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  status?: ChatStatus
  onStop?: () => void
}

export function PromptInputSubmit({
  status,
  onStop,
  children,
  onClick,
  ...props
}: PromptInputSubmitProps) {
  const generating = status === "submitted" || status === "streaming"
  const icon =
    status === "submitted" ? (
      <Spinner />
    ) : status === "streaming" ? (
      <SquareIcon className="size-4" />
    ) : status === "error" ? (
      <XIcon className="size-4" />
    ) : (
      <CornerDownLeftIcon className="size-4" />
    )

  return (
    <InputGroupButton
      aria-label={generating ? "Stop" : "Submit"}
      size="icon-sm"
      type={generating && onStop ? "button" : "submit"}
      variant="default"
      onClick={(event) => {
        if (generating && onStop) {
          event.preventDefault()
          onStop()
        } else {
          onClick?.(event)
        }
      }}
      {...props}
    >
      {children ?? icon}
    </InputGroupButton>
  )
}
