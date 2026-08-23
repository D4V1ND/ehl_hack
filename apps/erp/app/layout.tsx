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
  title: "ERP — system of record",
  description:
    "The ERP the sourcing agent reads: the item master, stock cover, approved suppliers, open orders, and the cases opened against them.",
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
