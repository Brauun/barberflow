import {
  CheckCircle2,
  Download,
  EllipsisVertical,
  ExternalLink,
  Share2,
  Smartphone,
  SquarePlus,
  X,
} from 'lucide-react'
import { useState } from 'react'

import { usePWAInstall } from '../../hooks/usePWAInstall'
import { cn } from '../../utils/cn'
import { Button } from '../ui/Button'

type PWAInstallButtonProps = {
  className?: string
  compact?: boolean
  iconOnly?: boolean
  variant?: 'primary' | 'secondary' | 'ghost'
}

export function PWAInstallButton({
  className,
  compact = false,
  iconOnly = false,
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
  const isIOSSafari = device.isIOS && device.isSafari
  const isAndroidBrowser = device.isAndroid
  const tutorialTitle = device.isIOS
    ? 'Instalar no iPhone'
    : isAndroidBrowser
      ? 'Instalar no Android'
      : 'Instalar aplicativo'
  const tutorialIntro = isIOSSafari
    ? 'No iPhone, a instalação é feita pelo Safari usando a opção de adicionar à tela de início.'
    : device.isIOS
      ? 'No iPhone, abra o BW Barber pelo Safari para usar a opção de adicionar à tela de início.'
      : isAndroidBrowser
        ? 'No Android, use o Chrome ou outro navegador compatível para instalar o BW Barber.'
        : 'Se o prompt nativo não aparecer, use um navegador compatível e procure a opção de instalar o app.'
  const tutorialSteps = isIOSSafari
    ? [
        { icon: Share2, text: 'Toque no ícone de compartilhar na barra inferior do Safari.' },
        { icon: SquarePlus, text: 'Role para baixo e toque em “Adicionar à Tela de Início”.' },
        { icon: CheckCircle2, text: 'Toque em “Adicionar” no canto superior direito.' },
      ]
    : device.isIOS
      ? [
          { icon: ExternalLink, text: 'Abra o BW Barber pelo Safari.' },
          { icon: Share2, text: 'Toque no ícone de compartilhar na barra inferior do Safari.' },
          { icon: SquarePlus, text: 'Toque em “Adicionar à Tela de Início”.' },
          { icon: CheckCircle2, text: 'Confirme em “Adicionar”.' },
        ]
      : isAndroidBrowser
        ? [
            { icon: EllipsisVertical, text: 'Toque no menu do Chrome no canto superior direito.' },
            { icon: Download, text: 'Toque em “Instalar app” ou “Adicionar à tela inicial”.' },
            { icon: CheckCircle2, text: 'Confirme a instalação.' },
          ]
        : [
            { icon: Smartphone, text: 'Abra o BW Barber em um navegador compatível com PWA.' },
            { icon: Download, text: 'Procure a opção “Instalar app” ou “Adicionar à tela inicial”.' },
            { icon: CheckCircle2, text: 'Confirme a instalação quando o navegador solicitar.' },
          ]

  return (
    <>
      <div className={cn('max-w-full', className)}>
        <Button
          aria-label={label}
          leftIcon={
            iconOnly ? undefined : isInstalled ? <CheckCircle2 size={17} /> : <Download size={17} />
          }
          onClick={handleInstallClick}
          size={iconOnly ? 'icon-md' : compact ? 'sm' : 'md'}
          tooltipPosition="bottom"
          title={label}
          variant={variant}
        >
          {iconOnly ? (
            isInstalled ? <CheckCircle2 size={17} /> : <Download size={17} />
          ) : compact ? (
            isInstalled ? 'Instalado' : 'Instalar'
          ) : (
            label
          )}
        </Button>
        {message && !iconOnly && (
          <p className="mt-2 text-xs font-semibold text-brand-600 dark:text-brand-300">
            {message}
          </p>
        )}
      </div>

      {isInstallGuideOpen && (
        <div
          aria-modal="true"
          className="fixed inset-0 z-[80] isolate flex h-[100dvh] max-h-[100dvh] max-w-[100vw] items-end justify-center overflow-hidden overscroll-contain bg-slate-950/55 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur-sm sm:items-center sm:p-6"
          role="dialog"
        >
          <button
            aria-label="Fechar orientação de instalação"
            className="absolute inset-0 z-0 cursor-default"
            onClick={() => setIsInstallGuideOpen(false)}
            type="button"
          />

          <section className="relative z-10 box-border flex max-h-[min(78dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1.5rem))] w-full max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-[1.35rem] border border-slate-200 bg-white shadow-[0_24px_80px_rgb(15_23_42/0.22)] sm:max-h-[min(88dvh,calc(100dvh-3rem))] sm:max-w-[27rem] dark:border-slate-800 dark:bg-slate-950">
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

            <div className="min-w-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4">
              <div className="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-brand-100 bg-brand-50/70 p-3 dark:border-brand-400/20 dark:bg-brand-400/10">
                <p className="text-sm font-black text-slate-950 dark:text-white">
                  Instale o BW Barber como app
                </p>
                <p className="mt-1 break-words text-xs leading-5 text-slate-600 dark:text-slate-300">
                  {tutorialIntro}
                </p>
              </div>

              <ol className="w-full min-w-0 max-w-full space-y-2 overflow-hidden">
                {tutorialSteps.map((step, index) => {
                  const StepIcon = step.icon

                  return (
                    <li
                      className="box-border flex w-full min-w-0 max-w-full items-start gap-3 overflow-hidden rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold leading-5 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                      key={step.text}
                    >
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-black text-white">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 whitespace-normal break-words">
                        {step.text}
                      </span>
                      <StepIcon
                        aria-hidden="true"
                        className="mt-1 h-4 w-4 shrink-0 text-brand-600"
                        size={17}
                      />
                    </li>
                  )
                })}
              </ol>

              {!device.isIOS && !canUseNativePrompt && (
                <p className="min-w-0 break-words rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  {isAndroidBrowser
                    ? 'Se o botão nativo não aparecer, abra o menu do Chrome e procure por “Instalar app” ou “Adicionar à tela inicial”.'
                    : 'Se a instalação não aparecer, abra o BW Barber em um navegador compatível com PWA, como Chrome ou Edge.'}
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  )
}

