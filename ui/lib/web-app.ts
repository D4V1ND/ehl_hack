const DEFAULT_UI_PORT = "3000"

/** Build the web UI destination for a case selected in the ERP cockpit. */
export function chatUrl(caseId: string, erpOrigin: string): string {
  const url = new URL("/chat", erpOrigin)
  url.port = process.env.UI_PORT?.trim() || DEFAULT_UI_PORT
  url.searchParams.set("case", caseId)
  return url.toString()
}

export function openChat(
  caseId: string,
  erpOrigin: string,
  navigate: (url: string) => void
): void {
  navigate(chatUrl(caseId, erpOrigin))
}
