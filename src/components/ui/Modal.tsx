import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect } from 'react'

import { Button } from './Button'

type ModalProps = {
  children: ReactNode
  isOpen: boolean
  onClose: () => void
  title: string
}

export function Modal({ children, isOpen, onClose, title }: ModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:px-4 sm:py-6">
      <div className="flex max-h-[100dvh] w-full flex-col overflow-hidden border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:max-w-lg sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="pr-4 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            {title}
          </h2>
          <Button
            aria-label="Fechar modal"
            className="min-h-11 min-w-11 shrink-0 px-0"
            onClick={onClose}
            variant="ghost"
          >
            <X size={20} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  )
}
