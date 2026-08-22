import type { Metadata } from "next"

import { CockpitChat } from "@/components/cockpit/cockpit-chat"

export const metadata: Metadata = {
  title: "Cockpit",
  description:
    "Resolve a bearing shortage across the Munich and Stuttgart plants, from Claims to an approved Decision.",
}

export default function ChatPage() {
  return <CockpitChat />
}
