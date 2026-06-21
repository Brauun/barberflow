import { CheckCircle2, Download, Share, Smartphone } from 'lucide-react'
import { useState } from 'react'

import { usePWAInstall } from '../../hooks/usePWAInstall'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

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
  const [isIOSModalOpen, setIsIOSModalOpen] = useState(false)

  async function handleInstallClick() {
    setMessage(null)

    if (isInstalled) {
      setMessage('Aplicativo já instalado.')
      return
    }

    if (device.isIOS) {
      setIsIOSModalOpen(true)
      return
    }

    const result = await install()

    if (result === 'manual') {
      setIsIOSModalOpen(true)
    }
  }

  const label = isInstalled ? 'Aplicativo já instalado' : 'Instalar aplicativo'

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

      <Modal
        isOpen={isIOSModalOpen}
        onClose={() => setIsIOSModalOpen(false)}
        title={device.isIOS ? 'Instalar no iPhone' : 'Instalar aplicativo'}
      >
        <div className="space-y-5">
          <div className="rounded-[1.35rem] border border-brand-100 bg-brand-50/70 p-4 dark:border-brand-400/20 dark:bg-brand-400/10">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-600 dark:bg-slate-950 dark:text-brand-300">
                <Smartphone size={21} />
              </span>
              <div>
                <p className="font-black text-slate-950 dark:text-white">
                  Instale o BW Barber como app
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  No iPhone, a instalação é feita pelo Safari usando a opção de
                  adicionar à tela de início.
                </p>
              </div>
            </div>
          </div>

          <ol className="space-y-3">
            {[
              'Abra o BW Barber pelo Safari.',
              'Toque no botão Compartilhar.',
              'Toque em “Adicionar à Tela de Início”.',
              'Confirme em “Adicionar”.',
            ].map((step, index) => (
              <li
                className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                key={step}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-black text-white">
                  {index + 1}
                </span>
                <span className="flex-1">{step}</span>
                {index === 1 && <Share className="shrink-0 text-brand-600" size={17} />}
              </li>
            ))}
          </ol>

          {!device.isIOS && !canUseNativePrompt && (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              Se o botão nativo não aparecer, abra o menu do navegador e procure
              por “Instalar app” ou “Adicionar à tela inicial”.
            </p>
          )}
        </div>
      </Modal>
    </>
  )
}
