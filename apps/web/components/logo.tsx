import type { ComponentPropsWithoutRef } from "react"

import { cn } from "@/lib/utils"

type LogoIconProps = ComponentPropsWithoutRef<"svg">

export function LogoIcon({
  className,
  "aria-label": ariaLabel,
  ...props
}: LogoIconProps) {
  return (
    <svg
      aria-hidden={ariaLabel ? undefined : true}
      aria-label={ariaLabel}
      role={ariaLabel ? "img" : undefined}
      viewBox="0 0 42 38"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      {...props}
    >
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M14.7735 0C11.5581 0 8.58697 1.71539 6.97927 4.5L1.20577 14.5C-0.401922 17.2846 -0.401925 20.7154 1.20577 23.5L6.97927 33.5C8.58697 36.2846 11.5581 38 14.7735 38H26.3205C29.5359 38 32.507 36.2846 34.1147 33.5L39.8882 23.5C41.4959 20.7154 41.4959 17.2846 39.8882 14.5L34.1147 4.5C32.507 1.71539 29.5359 0 26.3205 0H14.7735ZM26.3205 6L19.1036 6C17.9489 6 17.2274 7.24989 17.8056 8.24939C19.5896 11.3332 21.3779 14.4147 23.1592 17.5C23.6951 18.4282 23.6951 19.5718 23.1592 20.5C21.3779 23.5853 19.5896 26.6668 17.8056 29.7506C17.2274 30.7501 17.9489 32 19.1036 32H26.3205C27.3923 32 28.3827 31.4282 28.9186 30.5L34.6921 20.5C35.228 19.5718 35.228 18.4282 34.6921 17.5L28.9186 7.5C28.3827 6.5718 27.3923 6 26.3205 6Z"
        fill="currentColor"
      />
    </svg>
  )
}

type LogoProps = ComponentPropsWithoutRef<"div"> & {
  iconClassName?: string
  wordmarkClassName?: string
}

export function Logo({
  className,
  iconClassName,
  wordmarkClassName,
  ...props
}: LogoProps) {
  return (
    <div
      role="img"
      aria-label="SupplyOS"
      className={cn("inline-flex items-center gap-2.5", className)}
      {...props}
    >
      <LogoIcon className={cn("h-7 w-auto", iconClassName)} />
      <span
        className={cn(
          "font-sans text-lg font-semibold tracking-[-0.025em]",
          wordmarkClassName
        )}
      >
        SupplyOS
      </span>
    </div>
  )
}
