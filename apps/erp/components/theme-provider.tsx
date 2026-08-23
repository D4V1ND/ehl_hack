"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * Pinned to light on purpose.
 *
 * DESIGN.md is a light system -- the warm cream canvas *is* the brand. With the
 * system theme enabled, a viewer on a dark OS got the stock shadcn dark palette
 * while every brand token stayed light, which reads as broken rather than as a
 * theme.
 */
function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      forcedTheme="light"
      enableSystem={false}
      disableTransitionOnChange
      {...props}
    >
      {children}
    </NextThemesProvider>
  )
}

export { ThemeProvider }
