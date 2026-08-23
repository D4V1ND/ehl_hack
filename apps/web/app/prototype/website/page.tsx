import type { Metadata } from "next"

import { WebsitePrototype } from "@/components/prototype/website-prototype"

export const metadata: Metadata = {
  title: "Beta website prototype",
  robots: {
    index: false,
    follow: false,
  },
}

type PrototypePageProps = {
  searchParams: Promise<{ variant?: string }>
}

export default async function PrototypePage({
  searchParams,
}: PrototypePageProps) {
  const { variant } = await searchParams

  return <WebsitePrototype initialVariant={variant} />
}
