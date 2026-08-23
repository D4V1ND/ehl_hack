"use client";

import Image from "next/image";
import {
  IconArrowsMaximize,
  IconArrowLeft,
  IconArrowRight,
  IconExternalLink,
  IconGridDots,
} from "@tabler/icons-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import styles from "@/components/prototype/slides-deck.module.css";

type SlideDeckProps = {
  hero: ReactNode;
  initialSlide?: number;
};

type SlideDefinition = {
  label: string;
  overviewTitle: string;
  revealCount: number;
  render: (revealed: number) => ReactNode;
};

const SLIDE_COUNT = 10;

export function SlideDeck({ hero, initialSlide = 0 }: SlideDeckProps) {
  const [current, setCurrent] = useState(() =>
    Math.min(Math.max(initialSlide, 0), SLIDE_COUNT - 1),
  );
  const [overview, setOverview] = useState(false);
  const [revealedBySlide, setRevealedBySlide] = useState<number[]>(() =>
    Array.from({ length: SLIDE_COUNT }, () => 0),
  );
  const touchStart = useRef<number | null>(null);

  const slides = useMemo<SlideDefinition[]>(
    () => [
      {
        label: "Opening",
        overviewTitle: "The engineer your supply chain was missing.",
        revealCount: 0,
        render: () => hero,
      },
      {
        label: "The problem",
        overviewTitle: "One late delivery can stop the factory.",
        revealCount: 4,
        render: (revealed) => <SituationSlide revealed={revealed} />,
      },
      {
        label: "Current tools",
        overviewTitle: "Current tools cannot move fast enough.",
        revealCount: 3,
        render: (revealed) => <CurrentToolsSlide revealed={revealed} />,
      },
      {
        label: "Solution",
        overviewTitle: "SupplyOS does the work.",
        revealCount: 6,
        render: (revealed) => <ProductSlide revealed={revealed} />,
      },
      {
        label: "Demo",
        overviewTitle: "Watch SupplyOS solve the problem.",
        revealCount: 1,
        render: (revealed) => <DemoSlide revealed={revealed} />,
      },
      {
        label: "Benchmark",
        overviewTitle: "From months of searching to minutes of evidence.",
        revealCount: 4,
        render: (revealed) => <BenchmarkSlide revealed={revealed} />,
      },
      {
        label: "Vision",
        overviewTitle: "One AI system for the whole supply chain.",
        revealCount: 3,
        render: (revealed) => <VisionSlide revealed={revealed} />,
      },
      {
        label: "Expansion",
        overviewTitle: "Start in Munich. Grow from there.",
        revealCount: 3,
        render: (revealed) => <GoToMarketSlide revealed={revealed} />,
      },
      {
        label: "Close",
        overviewTitle: "Thanks for organizing this EHL Hackathon.",
        revealCount: 0,
        render: () => <CloseSlide />,
      },
      {
        label: "Cognition",
        overviewTitle: "Thanks for this inspiring challenge, Cognition.",
        revealCount: 0,
        render: () => <CognitionCloseSlide />,
      },
    ],
    [hero],
  );

  const revealed = revealedBySlide[current] ?? 0;
  const revealCount = slides[current].revealCount;

  const show = useCallback(
    (index: number) => {
      const nextIndex = Math.min(Math.max(index, 0), slides.length - 1);
      setCurrent(nextIndex);
      setOverview(false);
      window.history.replaceState(null, "", `?slide=${nextIndex + 1}`);
    },
    [slides.length],
  );

  const previous = useCallback(() => show(current - 1), [current, show]);

  const next = useCallback(() => {
    if (revealed < revealCount) {
      setRevealedBySlide((values) =>
        values.map((value, index) =>
          index === current ? Math.min(value + 1, revealCount) : value,
        ),
      );
      return;
    }

    show(current + 1);
  }, [current, revealCount, revealed, show]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }

      if (["ArrowRight", "PageDown", " "].includes(event.key)) {
        event.preventDefault();
        next();
      } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
        event.preventDefault();
        previous();
      } else if (event.key === "Home") {
        event.preventDefault();
        show(0);
      } else if (event.key === "End") {
        event.preventDefault();
        show(slides.length - 1);
      } else if (event.key.toLowerCase() === "o") {
        setOverview((value) => !value);
      } else if (event.key.toLowerCase() === "f") {
        void toggleFullscreen();
      } else if (event.key === "Escape" && overview) {
        setOverview(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [next, overview, previous, show, slides.length]);

  function handleTouchEnd(event: React.TouchEvent) {
    if (touchStart.current === null) return;
    const distance = event.changedTouches[0].clientX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(distance) < 50) return;
    if (distance < 0) next();
    else previous();
  }

  function handleViewportClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest("a, button")) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const position = event.clientX - bounds.left;
    if (position < bounds.width / 3) previous();
    else next();
  }

  const hasNextAction = revealed < revealCount || current < slides.length - 1;

  return (
    <main
      className={styles.stage}
      onTouchStart={(event) => {
        touchStart.current = event.touches[0].clientX;
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
              data-active={index === current}
              onClick={() => show(index)}
              aria-label={`Open slide ${index + 1}: ${slide.label}`}
              aria-current={index === current ? "page" : undefined}
            >
              <span className={styles.thumbnailNumber}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className={styles.thumbnailTitle}>
                {slide.overviewTitle}
              </span>
              <span className={styles.thumbnailAction}>
                {slide.label}
                <IconArrowRight aria-hidden="true" size={16} stroke={1.8} />
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div
          className={styles.viewport}
          aria-live="polite"
          onClick={handleViewportClick}
          title="Click the left edge to go back or anywhere else to continue"
        >
          <div className={styles.slideMotion} key={current}>
            {slides[current].render(revealed)}
          </div>
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
          disabled={!hasNextAction}
          aria-label={
            revealed < revealCount ? "Reveal next point" : "Next slide"
          }
        >
          <IconArrowRight size={18} stroke={1.8} />
        </button>
        <button
          className={styles.controlButton}
          type="button"
          onClick={() => setOverview((value) => !value)}
          aria-label="Toggle slide overview"
          aria-pressed={overview}
          title="Slide overview (O)"
        >
          <IconGridDots size={18} stroke={1.8} />
        </button>
        <button
          className={styles.controlButton}
          type="button"
          onClick={() => void toggleFullscreen()}
          aria-label="Toggle fullscreen"
          title="Fullscreen (F)"
        >
          <IconArrowsMaximize size={18} stroke={1.8} />
        </button>
      </nav>
    </main>
  );
}

function SituationSlide({ revealed }: { revealed: number }) {
  const points = [
    "A supplier is late.",
    "A needed part is missing.",
    "The team has only hours to find it.",
    "The delay can cost thousands of dollars.",
  ];

  return (
    <section className={styles.slide}>
      <h2 className={`${styles.title} ${styles.titleWide}`}>
        One late delivery can stop the factory.
      </h2>
      <div className={styles.situationList}>
        {points.map((point, index) => (
          <p
            className={`${styles.situationPoint} ${revealClass(revealed > index)}`}
            key={point}
          >
            {point}
          </p>
        ))}
      </div>
    </section>
  );
}

function CurrentToolsSlide({ revealed }: { revealed: number }) {
  return (
    <section className={styles.slide}>
      <h2 className={`${styles.title} ${styles.titleWide}`}>
        Current tools cannot move fast enough.
      </h2>
      <div className={styles.problemGrid}>
        <ProblemItem title="Too slow" visible={revealed > 0}>
          ERP software stores the data. Employees still find and call suppliers
          by hand.
        </ProblemItem>
        <ProblemItem title="Too complex" visible={revealed > 1}>
          Few people can compare every detail and make a good choice.
        </ProblemItem>
        <ProblemItem title="Too costly" visible={revealed > 2}>
          More staff costs money. Every delay costs more.
        </ProblemItem>
      </div>
    </section>
  );
}

function ProblemItem({
  title,
  children,
  visible,
}: {
  title: string;
  children: ReactNode;
  visible: boolean;
}) {
  return (
    <article className={`${styles.problemItem} ${revealClass(visible)}`}>
      <h3 className={styles.problemWord}>{title}</h3>
      <p className={styles.problemCopy}>{children}</p>
    </article>
  );
}

function ProductSlide({ revealed }: { revealed: number }) {
  const steps = [
    ["Understands the need", "Reads which material or part is missing."],
    ["Checks current suppliers", "Looks for a supplier that already fits."],
    ["Researches the market", "Finds new suppliers that can help."],
    ["Calls suppliers", "Asks for price and delivery time."],
    ["Ranks the options", "Puts the best options first."],
    ["Shows a person", "A person makes the final choice."],
  ];

  return (
    <section className={styles.slide}>
      <h2 className={`${styles.title} ${styles.titleWide}`}>
        SupplyOS does the work.
      </h2>
      <div className={styles.flow}>
        {steps.map(([label, copy], index) => (
          <article
            className={`${styles.flowStep} ${revealClass(revealed > index)}`}
            key={label}
          >
            <span className={styles.flowNumber}>0{index + 1}</span>
            <h3 className={styles.flowLabel}>{label}</h3>
            <p className={styles.flowCopy}>{copy}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function DemoSlide({ revealed }: { revealed: number }) {
  return (
    <section className={styles.slide}>
      <h2 className={`${styles.title} ${styles.titleWide}`}>
        Watch SupplyOS solve the problem.
      </h2>
      <div className={`${styles.demoLayout} ${revealClass(revealed > 0)}`}>
        <div className={styles.demoFrame}>
          <Image
            src="/slides/supplyos-case.png"
            alt="SupplyOS shows each step and the suppliers it found"
            fill
            sizes="70vw"
            className={styles.demoImage}
          />
        </div>
        <aside className={styles.demoAside}>
          <p>See each step. See why a supplier passes or fails.</p>
          <a
            className={styles.buttonSecondary}
            href="/chat"
            target="_blank"
            rel="noreferrer"
          >
            Open live demo
            <IconExternalLink aria-hidden="true" size={18} stroke={1.8} />
          </a>
        </aside>
      </div>
    </section>
  );
}

function BenchmarkSlide({ revealed }: { revealed: number }) {
  return (
    <section className={styles.slide}>
      <h2 className={`${styles.title} ${styles.titleWide}`}>
        From months of searching to minutes of evidence.
      </h2>

      <div className={styles.benchmarkLayout}>
        <article
          className={`${styles.benchmarkExternal} ${revealClass(revealed > 0)}`}
        >
          <p className={styles.benchmarkLabel}>Typical supplier search</p>
          <p className={styles.benchmarkPrimary}>≈3 months</p>
          <p className={styles.benchmarkHours}>
            <strong>40+ hours</strong>
            <span>of sourcing work</span>
          </p>
          <a
            className={styles.benchmarkSource}
            href="https://www.mckinsey.com/capabilities/operations/our-insights/with-artificial-intelligence-find-new-suppliers-in-days-not-months"
            target="_blank"
            rel="noreferrer"
          >
            McKinsey, 2021
            <IconExternalLink aria-hidden="true" size={16} stroke={1.8} />
          </a>
        </article>

        <div className={styles.benchmarkCurrent}>
          <p className={styles.benchmarkLabel}>Current SupplyOS flow</p>
          <div
            className={`${styles.benchmarkStep} ${revealClass(revealed > 1)}`}
          >
            <strong>3–5 min</strong>
            <span>First supplier response</span>
          </div>
          <div
            className={`${styles.benchmarkStep} ${revealClass(revealed > 2)}`}
          >
            <strong>≈15 min</strong>
            <span>Initial data across the supplier shortlist</span>
          </div>
          <div
            className={`${styles.benchmarkStep} ${revealClass(revealed > 3)}`}
          >
            <strong className={styles.benchmarkResponseTime}>
              + response time
            </strong>
            <span>
              Hours or days when suppliers must answer because public data is
              unavailable.
            </span>
          </div>
          <p
            className={`${styles.benchmarkDecision} ${revealClass(revealed > 3)}`}
          >
            SupplyOS prepares the evidence. A human makes the final decision.
          </p>
        </div>
      </div>
    </section>
  );
}

function VisionSlide({ revealed }: { revealed: number }) {
  return (
    <section className={styles.slide}>
      <h2 className={`${styles.title} ${styles.titleWide}`}>
        One AI system for the whole supply chain.
      </h2>
      <div className={styles.visionList}>
        <p className={`${styles.visionPoint} ${revealClass(revealed > 0)}`}>
          It can source materials and find the right suppliers.
        </p>
        <p className={`${styles.visionPoint} ${revealClass(revealed > 1)}`}>
          It calls suppliers, ranks the options, and brings them to a person.
        </p>
        <p className={`${styles.visionPoint} ${revealClass(revealed > 2)}`}>
          It connects cleanly to the ERP the company already uses.
        </p>
      </div>
    </section>
  );
}

function GoToMarketSlide({ revealed }: { revealed: number }) {
  return (
    <section className={styles.slide}>
      <h2 className={`${styles.title} ${styles.titleWide}`}>
        Start in Munich. Grow from there.
      </h2>
      <div className={styles.gtmGrid}>
        <article className={`${styles.gtmStep} ${revealClass(revealed > 0)}`}>
          <h3>01. Start in Munich</h3>
          <p>
            Work with a few local factories. Solve one real problem at a time.
          </p>
          <span className={styles.gtmFoot}>Use real data from their ERP.</span>
        </article>
        <article className={`${styles.gtmStep} ${revealClass(revealed > 1)}`}>
          <h3>02. Expand manufacturing</h3>
          <p>
            Support more factory types, then more cities in Germany and abroad.
          </p>
          <span className={styles.gtmFoot}>Each new setup gets faster.</span>
        </article>
        <article className={`${styles.gtmStep} ${revealClass(revealed > 2)}`}>
          <h3>03. Enter new industries</h3>
          <p>Help construction teams when a late part could stop their work.</p>
          <span className={styles.gtmFoot}>
            Then solve the same problem elsewhere.
          </span>
        </article>
      </div>
    </section>
  );
}

function CloseSlide() {
  return (
    <section className={styles.close}>
      <Image
        src="/slides/ehl-logo.svg"
        alt="EHL Hackathon logo"
        width={360}
        height={182}
        className={styles.closeLogo}
      />
      <h2>Thanks for organizing this EHL Hackathon.</h2>
      <h3>It was stressful but fun.</h3>
    </section>
  );
}

function CognitionCloseSlide() {
  return (
    <section className={styles.close}>
      <p className={styles.closeWordmark}>Cognition</p>
      <h2>Thanks for this inspiring challenge, Cognition.</h2>
      <h3>SupplyOS was built around it.</h3>
    </section>
  );
}

function revealClass(visible: boolean) {
  return `${styles.reveal} ${visible ? styles.revealVisible : ""}`;
}

async function toggleFullscreen() {
  if (!document.fullscreenEnabled) return;

  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen();
    return;
  }
  await document.exitFullscreen();
}
