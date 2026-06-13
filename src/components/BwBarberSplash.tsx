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
        'bw-splash fixed inset-0 z-[9999] flex min-h-[100dvh] flex-col items-center justify-center bg-[#071426] text-white',
        isLeaving && 'bw-splash-leaving',
      )}
      role="status"
    >
      {/* Glow de fundo */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_40%,rgba(18,198,243,0.10),transparent)]" />

      {/* Conteúdo central */}
      <div className="relative flex flex-col items-center gap-0">

        {/* Anel decorativo + logo, sem sobreposição */}
        <div className="bw-splash-ring relative flex h-52 w-52 items-center justify-center rounded-full border border-[#12C6F3]/18 sm:h-60 sm:w-60">
          {/* Glow interno */}
          <div className="absolute inset-0 rounded-full bg-[#12C6F3]/5 blur-xl" />

          {/* Logo */}
          <div className="bw-splash-logo relative z-10 flex h-36 w-36 items-center justify-center sm:h-44 sm:w-44">
            <img
              alt="BW Barber"
              className="h-full w-full object-contain"
              decoding="async"
              src="/brand/bw-barber-login-logo.png"
            />
          </div>
        </div>

        {/* Textos */}
        <div className="bw-splash-text mt-10 flex flex-col items-center gap-2 text-center">
          <p className="text-[0.65rem] font-bold uppercase tracking-[0.36em] text-[#12C6F3]">
            BW Barber
          </p>
          <p className="text-sm font-medium tracking-wide text-[#B9D7E8]/80">
            Entrando no BW Barber
          </p>
        </div>

        {/* Barra de progresso */}
        <div className="bw-splash-progress mt-8 h-[2px] w-40 overflow-hidden rounded-full bg-white/8">
          <span className="block h-full rounded-full bg-gradient-to-r from-[#12C6F3]/60 via-[#12C6F3] to-[#12C6F3]/60" />
        </div>

        {/* Três pontos animados */}
        <div className="bw-splash-dots mt-5 flex items-center gap-1.5">
          <span className="bw-dot h-1 w-1 rounded-full bg-[#12C6F3]/50" />
          <span className="bw-dot bw-dot-2 h-1 w-1 rounded-full bg-[#12C6F3]/50" />
          <span className="bw-dot bw-dot-3 h-1 w-1 rounded-full bg-[#12C6F3]/50" />
        </div>
      </div>
    </div>
  )
}
