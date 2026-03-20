"use client"

import type { ComponentProps } from "react"
import { cn } from "~/lib/utils"

type ShimmerProps = ComponentProps<"span"> & {
  duration?: number
}

export const Shimmer = ({ duration = 1.2, className, children, ...props }: ShimmerProps) => {
  return (
    <span
      className={cn(
        "inline-block bg-[linear-gradient(110deg,currentColor,rgba(255,255,255,0.45),currentColor)] bg-[length:220%_100%] bg-clip-text text-transparent",
        className,
      )}
      style={{ animation: `ai-shimmer ${duration}s linear infinite` }}
      {...props}
    >
      {children}
    </span>
  )
}

export default Shimmer
