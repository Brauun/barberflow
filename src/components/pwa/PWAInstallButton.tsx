import { CheckCircle2, Download, Share, Smartphone, X } from 'lucide-react'
import { useState } from 'react'

import { usePWAInstall } from '../../hooks/usePWAInstall'
import { cn } from '../../utils/cn'
import { Button } from '../ui/Button'

type PWAInstallButtonProps = {
  className?: string
  compact?: boolean
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function PWAInstallButton({
  className,
  compact = false,
  variant = 'secondary',
}: PWAInstallButtonProps) {
  const { canUseNativePrompt, device, install, isInstalled, message, setMessage } =
    usePWAInstall()
  const [isInstallGuideOpen, setIsInstallGuideOpen] = useState(false)

  async function handleInstallClick() {
    setMessage(null)

    if (isInstalled) {
      setMessage('Aplicativo já instalado.')
      return
    }

    if (device.isIOS) {
      setIsInstallGuideOpen(true)
      return
    }

    const result = await install()

    if (result === 'manual') {
      setIsInstallGuideOpen(true)
    }
  }

  const label = isInstalled ? 'Aplicativo já instalado' : 'Instalar aplicativo'
  const tutorialTitle = device.isIOS ? 'Instalar no iPhone' : 'Instalar aplicativo'
  const tutorialSteps = device.isIOS
    ? [
        'Abra o BW Barber pelo Safari.',
        'Toque no botão Compartilhar.',
        'Toque em “Adicionar à Tela de Início”.',
        'Confirme em “Adicionar”.',
      ]
    : [
        'Abra o BW Barber no Chrome.',
        'Toque no menu do navegador.',
        'Toque em “Instalar app”.',
        'Confirme a instalação.',
      ]

  return (
    <>
      <div className={className}>
        <Button
          aria-label={label}
          leftIcon={isInstalled ? <CheckCircle2 size={17} /> : <Download size={17} />}
          onClick={handleInstallClick}
          size={compact ? 'sm' : 'md'}
          variant={variant}
        >
          {compact ? (isInstalled ? 'Instalado' : 'Instalar') : label}
        </Button>
        {message && (
          <p className="mt-2 text-xs font-semibold text-brand-600 dark:text-brand-300">
            {message}
          </p>
        )}
      </div>

      {isInstallGuideOpen && (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/55 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-sm sm:items-center sm:p-6"
          role="dialog"
        >
          <button
            aria-label="Fechar orientação de instalação"
            className="absolute inset-0 cursor-default"
            onClick={() => setIsInstallGuideOpen(false)}
            type="button"
          />

          <section className="relative flex max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1.5rem)] w-full max-w-[27rem] flex-col overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgb(15_23_42/0.22)] dark:border-slate-800 dark:bg-slate-950">
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-400/12 dark:text-brand-300">
                  <Smartphone size={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand-600 dark:text-brand-300">
                    PWA
                  </p>
                  <h2 className="truncate text-base font-black text-slate-950 dark:text-white">
                    {tutorialTitle}
                  </h2>
                </div>
              </div>
              <button
                aria-label="Fechar"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white"
                onClick={() => setIsInstallGuideOpen(false)}
                type="button"
              >
                <X size={19} />
              </button>
            </header>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <div className="rounded-2xl border border-brand-100 bg-brand-50/70 p-3 dark:border-brand-400/20 dark:bg-brand-400/10">
                <p className="text-sm font-black text-slate-950 dark:text-white">
                  Instale o BW Barber como app
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                  {device.isIOS
                    ? 'No iPhone, a instalação é feita pelo Safari usando a opção de adicionar à tela de início.'
                    : 'Se o prompt nativo não aparecer, use o menu do navegador para instalar.'}
                </p>
              </div>

              <ol className="space-y-2">
                {tutorialSteps.map((step, index) => (
                  <li
                    className="flex min-h-12 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold leading-5 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                    key={step}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-black text-white">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1">{step}</span>
                    <Share
                      className={cn('shrink-0 text-brand-600', index !== 1 && 'invisible')}
                      size={17}
                    />
                  </li>
                ))}
              </ol>

              {!device.isIOS && !canUseNativePrompt && (
                <p className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  Se o botão nativo não aparecer, abra o menu do navegador e procure
                  por “Instalar app” ou “Adicionar à tela inicial”.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  )
}
