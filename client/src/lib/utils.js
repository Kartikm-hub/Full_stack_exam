import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Merge conditional class names and de-duplicate conflicting Tailwind classes.
 * Every component in `components/ui` composes its final `className` with `cn()`
 * so callers can always override styling without `!important` or forks.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs))
}