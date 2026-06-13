import { bwBarberSplashLottie } from '../assets/bwBarberSplash.lottie'
import { cn } from '../utils/cn'

type BwBarberSplashProps = {
  isLeaving?: boolean
}

export function BwBarberSplash({ isLeaving = false }: BwBarberSplashProps) {
  return (
    <div
      aria-busy="true"
      aria-label="Entrando no BW Barber"
      className={cn(
        'bw-splash fixed inset-0 z-[9999] flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#071426] px-6 py-[calc(env(safe-area-inset-top)+1.5rem)] text-white',
        isLeaving && 'bw-splash-leaving',
      )}
      data-lottie-name={bwBarberSplashLottie.nm}
      data-lottie-version={bwBarberSplashLottie.v}
      role="status"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(18,198,243,0.16),transparent_34%),linear-gradient(180deg,#071426_0%,#08182b_48%,#050b14_100%)]" />
      <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#12C6F3]/10 blur-3xl sm:h-80 sm:w-80" />

      <div className="relative flex w-full max-w-sm flex-col items-center">
        <div className="bw-splash-orbit absolute top-12 h-52 w-52 rounded-full border border-[#12C6F3]/10 sm:h-64 sm:w-64" />

        <svg
          aria-hidden="true"
          className="bw-splash-symbol absolute top-8 h-48 w-48 overflow-visible text-[#12C6F3] sm:h-60 sm:w-60"
          fill="none"
          viewBox="0 0 220 220"
        >
          <path
            className="bw-splash-line bw-splash-line-soft"
            d="M48 132C54 82 82 54 124 58C154 61 171 78 169 104C167 132 144 145 113 141H75"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.2"
          />
          <path
            className="bw-splash-line"
            d="M78 153L112 72C116 63 126 58 136 62C146 66 151 76 147 86L112 168"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2.6"
          />
          <path
            className="bw-splash-line bw-splash-line-bright"
            d="M124 88L150 156L178 86"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="3"
          />
        </svg>

        <div className="bw-splash-logo relative mt-16 flex h-44 w-44 items-center justify-center sm:mt-12 sm:h-56 sm:w-56">
          <img
            alt="BW Barber"
            className="h-full w-full object-contain"
            decoding="async"
            src="/brand/bw-barber-login-logo.png"
          />
        </div>

        <div className="bw-splash-text mt-8 text-center">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.32em] text-[#12C6F3]">
            BW Barber
          </p>
          <p className="mt-3 text-sm font-semibold tracking-normal text-[#B9D7E8]">
            Entrando no BW Barber
          </p>
        </div>

        <div className="bw-splash-progress mt-8 h-px w-44 overflow-hidden rounded-full bg-white/10">
          <span className="block h-full rounded-full bg-[#12C6F3]" />
        </div>
      </div>
    </div>
  )
}
