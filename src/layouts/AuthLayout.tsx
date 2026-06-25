import { Outlet } from 'react-router-dom'

export function AuthLayout() {
  return (
    <main className="dark bw-mobile-compact min-h-[100dvh] w-full max-w-full overflow-x-hidden bg-[var(--bf-background)] text-[var(--bf-text-primary)]">
      <section className="mx-auto flex min-h-[100dvh] w-full max-w-[26rem] items-center px-2.5 pb-[calc(0.6rem+env(safe-area-inset-bottom))] pt-[calc(0.6rem+env(safe-area-inset-top))] sm:max-w-[32rem] sm:px-4 sm:py-4 md:max-w-5xl md:items-start md:px-6 md:py-6 lg:max-w-6xl lg:py-8 xl:max-w-7xl">
        <div className="grid w-full max-w-full overflow-hidden rounded-2xl border border-[var(--bf-border)] bg-[var(--bf-surface)] shadow-[0_18px_56px_rgb(0_0_0/0.26)] sm:rounded-[1.75rem] md:max-h-[calc(100dvh-3rem)] md:grid-cols-[0.78fr_1.22fr] md:rounded-[2rem] lg:grid-cols-[0.82fr_1.18fr] lg:shadow-[0_30px_110px_rgb(0_0_0/0.35)]">
          <div className="bw-barber-grain bw-barber-mark relative flex min-h-[7.5rem] items-center justify-center overflow-hidden bg-[var(--bf-background)] px-5 py-4 sm:min-h-[11rem] sm:px-8 sm:py-6 md:min-h-[calc(100dvh-3rem)] md:px-8 md:py-14 lg:px-10 lg:py-16">
            <div className="absolute inset-x-[-12%] bottom-[-2.75rem] h-20 rounded-[50%] bg-[var(--bf-surface)] sm:bottom-[-4.5rem] sm:h-32 md:hidden" />
            <div className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#12C6F3]/12 blur-3xl sm:h-64 sm:w-64" />
            <div className="absolute left-4 top-3 h-20 w-20 rounded-full border border-[#12C6F3]/18 bg-[#12C6F3]/8 blur-2xl sm:left-6 sm:top-6 sm:h-24 sm:w-24" />
            <div className="absolute bottom-6 right-5 h-24 w-24 rounded-full border border-[#2B6FFF]/18 bg-[#2B6FFF]/12 blur-3xl sm:bottom-10 sm:right-8 sm:h-32 sm:w-32" />
            <img
              alt="BW Barber"
              className="relative z-10 h-20 w-auto max-w-[78%] object-contain drop-shadow-[0_8px_24px_rgba(18,198,243,0.25)] sm:h-[150px] sm:max-w-[80%] md:h-[150px] lg:h-[190px]"
              src="/brand/bw-barber-login-logo.png"
            />
          </div>

          <div className="relative min-w-0 bg-[var(--bf-surface)] px-3.5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3.5 sm:px-6 sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pt-6 md:max-h-[calc(100dvh-3rem)] md:overflow-y-auto md:px-8 md:py-8 lg:px-10 lg:py-10">
            <div className="w-full">
              <Outlet />
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
