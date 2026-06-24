import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <main className="bw-mobile-compact min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-[#071426] text-white">
      <section className="mx-auto flex min-h-[100dvh] w-full max-w-[28rem] items-center justify-center px-3 pb-[calc(0.85rem+env(safe-area-inset-bottom))] pt-[calc(0.85rem+env(safe-area-inset-top))] sm:max-w-[34rem] sm:px-4 sm:py-5 md:max-w-5xl md:px-6 md:py-6 lg:max-w-6xl lg:py-8">
        <div className="grid w-full max-w-full overflow-hidden rounded-[1.65rem] border border-white/[0.08] bg-[#0E1D32] shadow-[0_22px_70px_rgb(0_0_0/0.32)] sm:rounded-[2rem] md:min-h-[min(760px,calc(100dvh-3rem))] md:grid-cols-[0.92fr_1.08fr] lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative flex min-h-[9.5rem] items-center justify-center overflow-hidden bg-[#071426] px-6 py-5 sm:min-h-[12rem] sm:px-8 sm:py-7 md:min-h-full md:px-10 md:py-14 lg:px-12">
            <div className="absolute inset-0 opacity-[0.22] [background-image:linear-gradient(135deg,rgba(255,255,255,0.10)_0_1px,transparent_1px_42px),linear-gradient(45deg,rgba(18,198,243,0.12)_0_1px,transparent_1px_56px)]" />
            <div className="absolute inset-0 bg-[linear-gradient(145deg,rgba(18,198,243,0.12)_0%,rgba(7,20,38,0)_42%),linear-gradient(180deg,rgba(14,29,50,0)_0%,rgba(14,29,50,0.72)_100%)]" />
            <div className="absolute inset-x-[-12%] bottom-[-3.4rem] h-24 rounded-[50%] bg-[#0E1D32] sm:bottom-[-4.5rem] sm:h-32 md:hidden" />
            <div className="absolute left-6 top-6 h-16 w-16 rounded-[1.25rem] border border-white/[0.06] bg-white/[0.03]" />
            <div className="absolute bottom-8 right-8 hidden h-24 w-24 rounded-[1.75rem] border border-[#12C6F3]/10 bg-[#12C6F3]/[0.03] md:block" />
            <img
              alt="BW Barber"
              className="relative z-10 h-[4.7rem] w-auto max-w-[72%] object-contain sm:h-[6.5rem] md:h-[8.5rem] lg:h-[10rem]"
              src="/brand/bw-barber-login-logo.png"
            />
          </div>

          <div className="relative min-w-0 bg-[#0E1D32] px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 sm:px-8 sm:pb-[calc(1.75rem+env(safe-area-inset-bottom))] sm:pt-7 md:flex md:max-h-[calc(100dvh-3rem)] md:items-center md:overflow-y-auto md:px-10 md:py-10 lg:px-14">
            <div className="mx-auto w-full">
              <Outlet />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
