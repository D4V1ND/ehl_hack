import type { Metadata } from "next"

import { CockpitChat } from "@/components/cockpit/cockpit-chat"

export const metadata: Metadata = {
  title: "Cockpit",
  description:
    "Review an Incident sourcing run from Claims to an approved Decision.",
}

export default function ChatPage() {
  return <CockpitChat />
}
