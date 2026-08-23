"use client"

import Image from "next/image"
import {
  IconArrowsMaximize,
  IconArrowLeft,
  IconArrowRight,
  IconGridDots,
} from "@tabler/icons-react"
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"

import styles from "@/components/prototype/slides-deck.module.css"

type SlideDeckProps = {
  hero: ReactNode
  initialSlide?: number
}

export function SlideDeck({ hero, initialSlide = 0 }: SlideDeckProps) {
  const [current, setCurrent] = useState(() =>
    Math.min(Math.max(initialSlide, 0), 6),
  )
  const [overview, setOverview] = useState(false)
  const touchStart = useRef<number | null>(null)

  const slides = useMemo(
    () => [
      { label: "Opening", content: hero },
      { label: "Problem", content: <ProblemSlide /> },
      { label: "Product", content: <ProductSlide /> },
      { label: "Demo", content: <DemoSlide /> },
      { label: "Vision", content: <VisionSlide /> },
      { label: "Go to market", content: <GoToMarketSlide /> },
      { label: "Close", content: <CloseSlide /> },
    ],
    [hero],
  )

  const show = useCallback(
    (index: number) => {
      const next = Math.min(Math.max(index, 0), slides.length - 1)
      setCurrent(next)
      setOverview(false)
      window.history.replaceState(null, "", `?slide=${next + 1}`)
    },
    [slides.length],
  )

  const previous = useCallback(() => show(current - 1), [current, show])
  const next = useCallback(() => show(current + 1), [current, show])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return
      }

      if (["ArrowRight", "PageDown", " "].includes(event.key)) {
        event.preventDefault()
        next()
      } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault()
        previous()
      } else if (event.key === "Home") {
        event.preventDefault()
        show(0)
      } else if (event.key === "End") {
        event.preventDefault()
        show(slides.length - 1)
      } else if (event.key.toLowerCase() === "o") {
        setOverview((value) => !value)
      } else if (event.key.toLowerCase() === "f") {
        void toggleFullscreen()
      } else if (event.key === "Escape" && overview) {
        setOverview(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [next, overview, previous, show, slides.length])

  function handleTouchEnd(event: React.TouchEvent) {
    if (touchStart.current === null) return
    const distance = event.changedTouches[0].clientX - touchStart.current
    touchStart.current = null
    if (Math.abs(distance) < 50) return
    if (distance < 0) next()
    else previous()
  }

  return (
    <main
      className={styles.stage}
      onTouchStart={(event) => {
        touchStart.current = event.touches[0].clientX
      }}
      onTouchEnd={handleTouchEnd}
    >
      {overview ? (
        <div className={styles.overview} aria-label="Slide overview">
          {slides.map((slide, index) => (
            <button
              type="button"
              className={styles.thumbnail}
              key={slide.label}
              onClick={() => show(index)}
              aria-label={`Open slide ${index + 1}: ${slide.label}`}
            >
              <div>{slide.content}</div>
              <span className={styles.thumbnailLabel}>
                {index + 1}. {slide.label}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className={styles.viewport} aria-live="polite">
          {slides[current].content}
        </div>
      )}

      <nav className={styles.controls} aria-label="Presentation controls">
        <button
          className={styles.controlButton}
          type="button"
          onClick={previous}
          disabled={current === 0}
          aria-label="Previous slide"
        >
          <IconArrowLeft size={18} stroke={1.8} />
        </button>
        <span className={styles.counter} aria-label="Current slide">
          {current + 1} / {slides.length}
        </span>
        <button
          className={styles.controlButton}
          type="button"
          onClick={next}
          disabled={current === slides.length - 1}
          aria-label="Next slide"
        >
          <IconArrowRight size={18} stroke={1.8} />
        </button>
        <button
          className={styles.controlButton}
          type="button"
          onClick={() => setOverview((value) => !value)}
          aria-label="Toggle slide overview"
        >
          <IconGridDots size={18} stroke={1.8} />
        </button>
        <button
          className={styles.controlButton}
          type="button"
          onClick={() => void toggleFullscreen()}
          aria-label="Toggle fullscreen"
        >
          <IconArrowsMaximize size={18} stroke={1.8} />
        </button>
      </nav>
    </main>
  )
}

function ProblemSlide() {
  return (
    <section className={styles.slide}>
      <h2 className={`${styles.title} ${styles.titleWide}`}>
        Shortages punish slow work.
      </h2>
      <div className={styles.problemGrid}>
        <ProblemItem title="Time">
          Buyers spend days calling suppliers while the line counts down at
          €18,400 an hour.
        </ProblemItem>
        <ProblemItem title="Blind spots">
          Lead time, MOQ, freight, duty and compliance change the answer. A
          spreadsheet misses the combinations.
        </ProblemItem>
        <ProblemItem title="Cost">
          The fallback is too much air freight, too much stock, or a stopped
          line.
        </ProblemItem>
      </div>
    </section>
  )
}

function ProblemItem({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <article className={styles.problemItem}>
      <h3 className={styles.problemWord}>{title}</h3>
      <p className={styles.problemCopy}>{children}</p>
    </article>
  )
}

function ProductSlide() {
  const steps = [
    [
      "Reads the ERP",
      "Stock, demand, the slipped PO and the BOM line at risk.",
    ],
    ["Checks suppliers", "Every vendor is screened against your own rules."],
    ["Calls the market", "The agent asks for price, MOQ, terms and lead time."],
    ["Ranks the plans", "Arrival date first, then full landed cost."],
  ]

  return (
    <section className={styles.slide}>
      <h2 className={`${styles.title} ${styles.titleWide}`}>
        SupplyOS runs the sourcing case.
      </h2>
      <div className={styles.flow}>
        {steps.map(([label, copy], index) => (
          <article className={styles.flowStep} key={label}>
            <span className={styles.flowNumber}>0{index + 1}</span>
            <h3 className={styles.flowLabel}>{label}</h3>
            <p className={styles.flowCopy}>{copy}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

function DemoSlide() {
  return (
    <section className={styles.slide}>
      <h2 className={`${styles.title} ${styles.titleWide}`}>
        Watch one shortage run.
      </h2>
      <div className={styles.demoLayout}>
        <div className={styles.demoFrame}>
          <Image
            src="/slides/supplyos-case.png"
            alt="SupplyOS sourcing case with the completed agent checklist and supplier candidates"
            fill
            sizes="70vw"
            className={styles.demoImage}
          />
        </div>
        <aside className={styles.demoAside}>
          <p>
            ERP facts and supplier screening stay visible. Failed policy checks
            are named.
          </p>
          <a
            className={styles.buttonSecondary}
            href="/chat"
            target="_blank"
            rel="noreferrer"
          >
            Open live cockpit
            <span aria-hidden="true">↗</span>
          </a>
        </aside>
      </div>
    </section>
  )
}

function VisionSlide() {
  return (
    <section className={styles.slide}>
      <h2 className={`${styles.title} ${styles.titleWide}`}>
        One AI operator across the supply chain, inside the ERP.
      </h2>
      <div className={styles.problemGrid}>
        <ProblemItem title="Starts with shortages">
          Fast feedback where every hour of delay is expensive.
        </ProblemItem>
        <ProblemItem title="Lives inside the ERP">
          It works with the data and approvals buyers already use.
        </ProblemItem>
        <ProblemItem title="Expands end to end">
          Reorder points, negotiation and supplier risk follow.
        </ProblemItem>
      </div>
    </section>
  )
}

function GoToMarketSlide() {
  return (
    <section className={styles.slide}>
      <h2 className={`${styles.title} ${styles.titleWide}`}>
        Start with Munich manufacturers.
      </h2>
      <div className={styles.gtmGrid}>
        <article className={styles.gtmStep}>
          <h3>Pilot in person</h3>
          <p>
            Work with a small group of manufacturers, inside their plants, one
            part family at a time.
          </p>
          <span className={styles.gtmFoot}>
            Built around real shortages and real ERP data.
          </span>
        </article>
        <article className={styles.gtmStep}>
          <h3>Scale the rollout</h3>
          <p>
            Each case improves supplier coverage, call playbooks and compliance
            setup. New plants start faster.
          </p>
          <span className={styles.gtmFoot}>
            Lower setup cost with every rollout.
          </span>
        </article>
      </div>
    </section>
  )
}

function CloseSlide() {
  return (
    <section className={styles.close}>
      <h2>Help us test the first workflow.</h2>
      <p>
        We are looking for manufacturers in Munich with real shortage cases and
        an ERP export.
      </p>
    </section>
  )
}

async function toggleFullscreen() {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen()
    return
  }
  await document.exitFullscreen()
}
