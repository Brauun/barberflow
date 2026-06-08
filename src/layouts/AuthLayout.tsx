import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#071426] text-white">
      <section className="mx-auto flex min-h-[100dvh] w-full max-w-[31rem] items-start px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-[calc(0.75rem+env(safe-area-inset-top))] sm:items-center sm:px-6 sm:py-6 lg:max-w-5xl lg:py-8">
        <div className="grid w-full max-w-full overflow-hidden rounded-[1.5rem] border border-white/[0.08] bg-[#0E1D32] shadow-[0_24px_80px_rgb(0_0_0/0.30)] sm:rounded-[2.25rem] lg:min-h-[42rem] lg:grid-cols-[1.05fr_0.95fr] lg:shadow-[0_30px_110px_rgb(0_0_0/0.35)]">
          <div className="relative flex min-h-[8.75rem] items-center justify-center overflow-hidden bg-[#071426] px-6 py-4 sm:min-h-[13rem] sm:px-8 sm:py-8 lg:min-h-full">
            <div className="absolute inset-x-[-12%] bottom-[-2.75rem] h-20 rounded-[50%] bg-[#0E1D32] sm:bottom-[-4.5rem] sm:h-32" />
            <div className="absolute left-5 top-4 h-16 w-16 rounded-full border border-[#12C6F3]/15 bg-[#12C6F3]/5 blur-2xl sm:left-6 sm:top-6 sm:h-20 sm:w-20" />
            <div className="absolute bottom-8 right-6 h-20 w-20 rounded-full border border-[#2B6FFF]/15 bg-[#2B6FFF]/10 blur-3xl sm:bottom-10 sm:right-8 sm:h-28 sm:w-28" />
            <img
              alt="BW Barber"
              className="relative z-10 h-28 w-auto max-w-[92%] object-contain sm:h-[165px] lg:h-[300px]"
              src="/brand/bw-barber-login-logo.png"
            />
          </div>

          <div className="relative px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-5 sm:px-8 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pt-7 lg:flex lg:items-center lg:px-10 lg:py-10">
            <div className="w-full">
              <Outlet />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
