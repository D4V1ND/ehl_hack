"use client"

import { useEffect } from "react"
import { PrototypeSwitcher } from "@/components/prototype/prototype-switcher"
import {
  VARIANTS,
  type VariantKey,
} from "@/components/prototype/website-prototype-config"
import { VARIANT_COMPONENTS } from "@/components/prototype/website-prototype-variants"

export function WebsitePrototype({
  initialVariant,
}: {
  initialVariant?: string
}) {
  const normalized = initialVariant?.toUpperCase()
  const currentKey: VariantKey = isVariantKey(normalized) ? normalized : "A"
  const currentIndex = VARIANTS.findIndex(
    (variant) => variant.key === currentKey
  )
  const previousKey =
    VARIANTS[(currentIndex - 1 + VARIANTS.length) % VARIANTS.length].key
  const nextKey = VARIANTS[(currentIndex + 1) % VARIANTS.length].key

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isEditing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable

      if (isEditing) return
      if (event.key === "ArrowLeft") {
        window.location.assign(`/prototype/website?variant=${previousKey}`)
      }
      if (event.key === "ArrowRight") {
        window.location.assign(`/prototype/website?variant=${nextKey}`)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [nextKey, previousKey])

  const CurrentVariant = VARIANT_COMPONENTS[currentKey]
  const currentVariant = VARIANTS[currentIndex]

  return (
    <>
      <CurrentVariant />
      <PrototypeSwitcher
        currentIndex={currentIndex}
        label={`${currentVariant.key} (${currentVariant.label})`}
        total={VARIANTS.length}
        previousHref={`/prototype/website?variant=${previousKey}`}
        nextHref={`/prototype/website?variant=${nextKey}`}
      />
    </>
  )
}

function isVariantKey(value: string | undefined): value is VariantKey {
  return VARIANTS.some((variant) => variant.key === value)
}
