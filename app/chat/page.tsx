import type { Metadata } from "next"

import { CockpitChat } from "@/components/cockpit/cockpit-chat"

export const metadata: Metadata = {
  title: "Cockpit",
  description:
    "One chat. Launch a sourcing run and watch Claims, checks, and the Decision.",
}

export default function ChatPage() {
  return <CockpitChat />
}
