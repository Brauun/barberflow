import type { BillingProvider } from './billingService.ts'

export type MercadoPagoPayment = Record<string, unknown> & {
  id: number | string
  status: string
  status_detail?: string | null
  external_reference?: string | null
  transaction_amount: number
  currency_id?: string | null
  payment_method_id?: string | null
  date_approved?: string | null
  date_created?: string | null
  date_of_expiration?: string | null
  order?: { id?: number | string | null } | null
}

export class MercadoPagoProvider implements BillingProvider {
  readonly name = 'mercadopago'

  constructor(private readonly accessToken: string) {}

  private unsupported(): never {
    throw new Error('Operação não suportada por este adaptador.')
  }

  authorize(_input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return Promise.reject(this.unsupported())
  }

  cancel(_input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return Promise.reject(this.unsupported())
  }

  capture(_input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return Promise.reject(this.unsupported())
  }

  async getPayment(providerPaymentId: string) {
    const response = await fetch(
      `https://api.mercadopago.com/v1/payments/${encodeURIComponent(providerPaymentId)}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Mercado Pago payment lookup failed: ${response.status}`)
    }

    return (await response.json()) as MercadoPagoPayment
  }

  getSubscription(_providerSubscriptionId: string): Promise<Record<string, unknown>> {
    return Promise.reject(this.unsupported())
  }

  refund(_input: Record<string, unknown>): Promise<Record<string, unknown>> {
    return Promise.reject(this.unsupported())
  }
}
