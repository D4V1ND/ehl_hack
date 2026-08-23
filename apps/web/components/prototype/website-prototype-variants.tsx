import type { VariantKey } from "@/components/prototype/website-prototype-config"
import {
  MockEmailField,
  PrototypeLogo,
} from "@/components/prototype/website-prototype-elements"

function VariantA() {
  return (
    <main className="relative h-dvh overflow-hidden bg-background text-background">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/website/background-1.png')" }}
      />
      <div className="absolute inset-0 bg-background/15" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,var(--background)_145%)]" />
      <PrototypeLogo inverse />
      <section className="relative z-10 flex h-full items-center justify-center px-6 pb-16 text-center">
        <div className="flex w-full max-w-4xl flex-col items-center">
          <h1 className="max-w-3xl text-5xl leading-[0.94] font-medium tracking-[-0.065em] text-balance sm:text-7xl lg:text-[6.5rem]">
            Sourcing, before the line stops.
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-background/70 sm:text-lg">
            SupplyOS turns shortages into checked supplier options and one
            approval-ready Decision.
          </p>
          <div className="mt-9 flex w-full justify-center text-foreground">
            <MockEmailField
              placeholder="Work email"
              buttonLabel="Request beta access"
            />
          </div>
        </div>
      </section>
    </main>
  )
}

function VariantB() {
  return (
    <main className="relative h-dvh overflow-hidden bg-background text-foreground">
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center"
        style={{ backgroundImage: "url('/website/background-1.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-background/20 to-background/5" />
      <div className="absolute inset-0 bg-gradient-to-t from-background/55 via-transparent to-transparent" />
      <PrototypeLogo />
      <section className="relative z-10 flex h-full items-end px-6 pt-28 pb-24 sm:px-12 sm:pb-18 lg:px-20">
        <div className="grid w-full items-end gap-9 md:grid-cols-[minmax(0,1fr)_24rem] md:gap-16">
          <div className="max-w-3xl">
            <h1 className="text-5xl leading-[0.93] font-medium tracking-[-0.065em] text-balance sm:text-7xl lg:text-[6rem]">
              Meet the engineer your supply chain was missing.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-foreground/70 sm:text-lg">
              Agents call suppliers, check every Claim, and bring you the best
              Strategy.
            </p>
          </div>
          <MockEmailField
            placeholder="you@company.com"
            buttonLabel="Join the private beta"
            stacked
          />
        </div>
      </section>
    </main>
  )
}

function VariantC() {
  return (
    <main className="relative h-dvh overflow-hidden bg-background text-foreground">
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center"
        style={{ backgroundImage: "url('/website/background-2.jpeg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-background/5" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/15 via-transparent to-background/45" />
      <PrototypeLogo />
      <section className="relative z-10 flex h-full items-center px-6 pb-14 sm:px-12 lg:px-20">
        <div className="w-full max-w-2xl">
          <h1 className="text-5xl leading-[0.94] font-medium tracking-[-0.06em] text-balance sm:text-7xl lg:text-[6rem]">
            When stock runs out, SupplyOS starts.
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-foreground/70 sm:text-lg">
            From Incident to recorded Decision, every sourcing step stays
            visible.
          </p>
          <div className="mt-9">
            <MockEmailField
              placeholder="Your work email"
              buttonLabel="Get early access"
            />
          </div>
        </div>
      </section>
    </main>
  )
}

function VariantD() {
  return (
    <main className="relative h-dvh overflow-hidden bg-background text-background">
      <div
        className="absolute inset-0 scale-110 bg-cover bg-center"
        style={{ backgroundImage: "url('/website/background-2.jpeg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-l from-foreground/85 via-foreground/25 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-foreground/35 via-transparent to-transparent" />
      <PrototypeLogo inverse />
      <section className="relative z-10 flex h-full items-center justify-end px-6 pb-16 sm:px-12 lg:px-20">
        <div className="flex w-full max-w-xl flex-col items-end text-right">
          <h1 className="text-6xl leading-[0.9] font-medium tracking-[-0.07em] text-balance sm:text-8xl lg:text-[7rem]">
            The shortage ends here.
          </h1>
          <p className="mt-6 max-w-md text-base leading-relaxed text-background/70 sm:text-lg">
            Auditable sourcing that moves at machine speed, with humans in
            control.
          </p>
          <div className="mt-9 flex w-full justify-end text-foreground">
            <MockEmailField
              placeholder="Email address"
              buttonLabel="Enter the beta"
              inverse
            />
          </div>
        </div>
      </section>
    </main>
  )
}

function VariantE() {
  return (
    <main className="relative h-dvh overflow-hidden bg-background text-foreground">
      <div
        className="absolute inset-0 bg-cover bg-[position:center_44%] sm:bg-[position:center_38%] lg:bg-[position:center_34%]"
        style={{ backgroundImage: "url('/website/background-4.png')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-background/65 via-background/5 to-transparent" />
      <PrototypeLogo />
      <section className="relative z-10 flex h-full items-end px-6 pt-28 pb-24 sm:px-12 sm:pb-18 lg:px-20">
        <div className="grid w-full items-end gap-9 md:grid-cols-[minmax(0,1fr)_24rem] md:gap-16">
          <div className="max-w-3xl">
            <h1 className="text-5xl leading-[0.93] font-medium tracking-[-0.065em] sm:text-7xl lg:text-[6rem]">
              <span className="block">The engineer</span>
              <span className="block">your supply chain</span>
              <span className="block">was missing.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-foreground/70 sm:text-lg">
              Agents call suppliers, check every Claim, and bring you the best
              Strategy.
            </p>
          </div>
          <MockEmailField
            placeholder="you@company.com"
            buttonLabel="Join the private beta"
            stacked
          />
        </div>
      </section>
    </main>
  )
}

export const VARIANT_COMPONENTS: Record<VariantKey, () => React.JSX.Element> = {
  A: VariantA,
  B: VariantB,
  C: VariantC,
  D: VariantD,
  E: VariantE,
}
