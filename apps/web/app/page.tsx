import { OpenChatButton } from "@/components/home/open-chat-button"
import { Logo } from "@/components/logo"

export default function Home() {
  return (
    <main className="relative min-h-svh overflow-hidden bg-background text-foreground">
      <div
        className="absolute inset-0 bg-cover bg-[position:center_44%] sm:bg-[position:center_38%] lg:bg-[position:center_34%]"
        style={{ backgroundImage: "url('/website/background-4.webp')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/5 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-background/25 via-transparent to-transparent" />
      <Logo className="absolute top-6 left-6 z-20 text-foreground sm:top-8 sm:left-10" />

      <section className="relative z-10 flex min-h-svh items-end px-6 pt-32 pb-16 sm:px-12 sm:pb-18 lg:px-20">
        <div className="grid w-full items-end gap-10 md:grid-cols-[minmax(0,1fr)_20rem] md:gap-16">
          <div className="max-w-3xl">
            <h1 className="text-5xl leading-[0.94] font-medium tracking-[-0.04em] text-balance sm:text-7xl lg:text-[6rem]">
              <span className="block">The engineer</span>
              <span className="block">your supply chain</span>
              <span className="block">was missing.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-foreground/70 sm:text-lg">
              Agents call suppliers, check every Claim, and bring you the best
              Strategy.
            </p>
          </div>
          <OpenChatButton />
        </div>
      </section>
    </main>
  )
}
