import type { RefObject } from 'react'
import { useEffect } from 'react'

type UseClickOutsideOptions = {
  enabled?: boolean
  ignoreRefs?: Array<RefObject<HTMLElement | null>>
  includeEscape?: boolean
}

function isInsideRef(target: EventTarget | null, ref: RefObject<HTMLElement | null>) {
  return target instanceof Node && Boolean(ref.current?.contains(target))
}

export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  callback: () => void,
  options: UseClickOutsideOptions = {},
) {
  const { enabled = true, ignoreRefs = [], includeEscape = true } = options

  useEffect(() => {
    if (!enabled) {
      return
    }

    function handlePointerStart(event: MouseEvent | TouchEvent) {
      const target = event.target

      if (isInsideRef(target, ref)) {
        return
      }

      if (ignoreRefs.some((ignoredRef) => isInsideRef(target, ignoredRef))) {
        return
      }

      callback()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (includeEscape && event.key === 'Escape') {
        callback()
      }
    }

    document.addEventListener('mousedown', handlePointerStart)
    document.addEventListener('touchstart', handlePointerStart, { passive: true })
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerStart)
      document.removeEventListener('touchstart', handlePointerStart)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [callback, enabled, ignoreRefs, includeEscape, ref])
}
