import { Inter, JetBrains_Mono } from "next/font/google"

import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@/lib/utils"

// DESIGN.md names Inter as the open-source substitute for CursorGothic, at
// weight 400 with negative tracking on display sizes. JetBrains Mono carries
// every code, identifier and number surface -- and in a procurement cockpit
// that is most of the page.
const fontSans = Inter({ subsets: ["latin"], variable: "--font-sans" })
const fontMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" })

export const metadata = {
  title: "Stockout — autonomous sourcing",
  description:
    "A production line is twelve days from standing still. Stockout reads the ERP, calls suppliers, costs the options and ships the decision as a pull request.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontSans.variable, fontMono.variable, "font-sans")}
    >
      <body className="bg-canvas text-ink">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
