import { useTranslation } from 'react-i18next'
import { useState } from 'react'

function Skeleton({ className = '', width, height, circle = false, ...props }) {
  const sizeStyle = {}
  if (width) sizeStyle.width = width
  if (height) sizeStyle.height = height

  return (
    <div
      className={`animate-pulse rounded-lg bg-ink/10 dark:bg-white/10 ${circle ? 'rounded-full' : ''} ${className}`}
      style={sizeStyle}
      {...props}
    />
  )
}

export function DepositFlowSkeleton() {
  const { t } = useTranslation()

  return (
    <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6 flex flex-col gap-5">
      {/* Title skeleton */}
      <div>
        <Skeleton height="1.5rem" width="60%" />
        <Skeleton height="0.875rem" width="80%" className="mt-2" />
      </div>

      {/* Amount input skeleton */}
      <div>
        <Skeleton height="0.75rem" width="40%" className="mb-2" />
        <Skeleton height="3rem" width="100%" />
      </div>

      {/* Quick amount buttons skeleton */}
      <div className="flex gap-2 flex-wrap">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} height="1.5rem" width="3rem" />
        ))}
      </div>

      {/* CTA button skeleton */}
      <Skeleton height="3rem" width="100%" className="rounded-xl" />

      {/* CLABE info block skeleton (shown during polling) */}
      <div className="bg-brand/5 border border-brand/20 rounded-xl p-4 flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <Skeleton height="0.75rem" width="20%" />
          <Skeleton height="1rem" width="40%" />
        </div>
        <div className="flex justify-between items-center">
          <Skeleton height="0.75rem" width="15%" />
          <Skeleton height="1rem" width="50%" />
        </div>
        <div className="flex justify-between items-center">
          <Skeleton height="0.75rem" width="15%" />
          <Skeleton height="1rem" width="25%" />
        </div>
        <div className="flex justify-between items-center">
          <Skeleton height="0.75rem" width="20%" />
          <Skeleton height="1rem" width="35%" />
        </div>
      </div>

      {/* Status indicator skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton height="0.5rem" width="0.5rem" circle />
        <Skeleton height="0.875rem" width="50%" />
      </div>
    </div>
  )
}

export function WithdrawalFlowSkeleton() {
  const { t } = useTranslation()

  return (
    <div className="bg-white dark:bg-white/5 border border-ink/8 dark:border-white/8 rounded-2xl p-6 flex flex-col gap-5">
      {/* Title skeleton */}
      <div>
        <Skeleton height="1.5rem" width="55%" />
        <Skeleton height="0.875rem" width="75%" className="mt-2" />
      </div>

      {/* Progress bar skeleton */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <Skeleton height="0.875rem" width="40%" />
          <Skeleton height="0.875rem" width="20%" />
        </div>
        <Skeleton height="0.5rem" width="100%" className="rounded-full" />
      </div>

      {/* Steps list skeleton (5 steps) */}
      <div className="flex flex-col gap-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="flex items-start gap-3">
            {/* Step number circle */}
            <Skeleton height="1.5rem" width="1.5rem" circle />
            <div className="flex-1 flex flex-col gap-2">
              <Skeleton height="1rem" width="60%" />
              <Skeleton height="0.875rem" width="80%" />
            </div>
          </div>
        ))}
      </div>

      {/* CTA button skeleton */}
      <Skeleton height="3rem" width="100%" className="rounded-xl" />
    </div>
  )
}

export default Skeleton
