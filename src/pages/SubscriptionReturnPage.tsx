import { Clock3 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { Badge, Card, CardContent } from '../components/ui'

const resultLabels: Record<string, string> = {
  failure: 'Pagamento não concluído',
  pending: 'Pagamento pendente',
  success: 'Pagamento enviado',
}

export function SubscriptionReturnPage() {
  const [searchParams] = useSearchParams()
  const result = searchParams.get('resultado') ?? ''

  return (
    <div className="mx-auto w-full max-w-2xl">
      <Card>
        <CardContent className="py-8 text-center md:py-12">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-400/10 dark:text-brand-300">
            <Clock3 size={25} />
          </span>
          {resultLabels[result] && (
            <div className="mt-5">
              <Badge variant={result === 'failure' ? 'danger' : 'warning'}>
                {resultLabels[result]}
              </Badge>
            </div>
          )}
          <h2 className="mt-5 text-xl font-black text-slate-950 md:text-2xl dark:text-white">
            Estamos confirmando seu pagamento.
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500 dark:text-slate-400">
            A liberação será feita automaticamente após a confirmação do Mercado Pago.
            Até lá, o plano e o estado atual da assinatura permanecem inalterados.
          </p>
          <Link
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-brand-500 dark:text-slate-950 dark:hover:bg-brand-400"
            to="/app/assinatura"
          >
            Voltar para Assinatura
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
