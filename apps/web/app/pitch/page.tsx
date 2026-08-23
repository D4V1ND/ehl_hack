import type { Metadata } from "next";

import { HomeHero } from "@/components/home/home-hero";
import { SlideDeck } from "@/components/pitch/slides-deck";

export const metadata: Metadata = {
  title: "Pitch deck",
  robots: {
    index: false,
    follow: false,
  },
};

type SlidesPageProps = {
  searchParams: Promise<{ slide?: string }>;
};

export default async function SlidesPage({ searchParams }: SlidesPageProps) {
  const requestedSlide = Number.parseInt((await searchParams).slide ?? "1", 10);
  const initialSlide = Number.isFinite(requestedSlide) ? requestedSlide - 1 : 0;

  return (
    <SlideDeck hero={<HomeHero presentation />} initialSlide={initialSlide} />
  );
}
