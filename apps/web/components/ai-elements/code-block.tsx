import type { HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

export type CodeBlockProps = HTMLAttributes<HTMLDivElement> & {
  code: string
  language: string
}

export function CodeBlock({
  code,
  language,
  className,
  ...props
}: CodeBlockProps) {
  return (
    <div className={cn("overflow-x-auto rounded-md", className)} {...props}>
      <pre className="p-3 font-mono text-xs">
        <code data-language={language}>{code}</code>
      </pre>
    </div>
  )
}
