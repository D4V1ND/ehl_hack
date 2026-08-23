import type { Metadata } from "next"
import Link from "next/link"

import "./globals.css"

export const metadata: Metadata = {
  title: "ERP",
  description: "SupplyOS mock ERP inventory and supplier records.",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="font-sans antialiased">
      <body className="bg-canvas text-ink">
        <header className="border-b border-hairline bg-surface-card">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-8">
            <div className="flex items-baseline gap-3">
              <Link
                className="text-lg font-semibold tracking-[-0.03em]"
                href="/inventory"
              >
                ERP
              </Link>
              <span className="text-xs text-muted-ink">
                Mock system of record
              </span>
            </div>
            <nav aria-label="ERP">
              <Link
                className="text-sm font-medium hover:text-primary"
                href="/inventory"
              >
                Inventory
              </Link>
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  )
}
