import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export type BillingOrigin =
  | 'WEBHOOK'
  | 'ADMIN'
  | 'SYSTEM'
  | 'TRIAL'
  | 'PAYMENT'
  | 'CANCELAMENTO'
  | 'REATIVACAO'

export type BillingEventType =
  | 'PAYMENT_APPROVED'
  | 'PAYMENT_REJECTED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_CANCELLED'
  | 'PAYMENT_REFUNDED'
  | 'SUBSCRIPTION_CREATED'
  | 'SUBSCRIPTION_RENEWED'
  | 'SUBSCRIPTION_CANCELLED'
  | 'SUBSCRIPTION_EXPIRED'
  | 'SUBSCRIPTION_REACTIVATED'

export type BillingCommandContext = {
  actorUserId?: string | null
  empresaId: string
  origin: BillingOrigin
  reason: string
}

export type BillingWebhookEvent = {
  empresaId: string
  eventType: BillingEventType
  payload: Record<string, unknown>
  provider: string
  providerEventId: string
}

export interface BillingProvider {
  readonly name: string
  authorize(input: Record<string, unknown>): Promise<Record<string, unknown>>
  cancel(input: Record<string, unknown>): Promise<Record<string, unknown>>
  capture(input: Record<string, unknown>): Promise<Record<string, unknown>>
  getPayment(providerPaymentId: string): Promise<Record<string, unknown>>
  getSubscription(providerSubscriptionId: string): Promise<Record<string, unknown>>
  refund(input: Record<string, unknown>): Promise<Record<string, unknown>>
}

export const billingEvents = {
  async onPaymentApproved(_result: unknown) {},
  async onPaymentRejected(_result: unknown) {},
  async onSubscriptionActivated(_result: unknown) {},
  async onSubscriptionCancelled(_result: unknown) {},
}

type BillingAction =
  | 'ACTIVATE_SUBSCRIPTION'
  | 'RENEW_SUBSCRIPTION'
  | 'CANCEL_SUBSCRIPTION'
  | 'PAUSE_SUBSCRIPTION'
  | 'RESUME_SUBSCRIPTION'
  | 'EXPIRE_SUBSCRIPTION'
  | 'REGISTER_PAYMENT'
  | 'REGISTER_PAYMENT_EVENT'
  | 'PROCESS_WEBHOOK'
  | 'CHANGE_PLAN'
  | 'START_GRACE_PERIOD'
  | 'FINISH_GRACE_PERIOD'
  | 'BLOCK_SUBSCRIPTION'
  | 'UNBLOCK_SUBSCRIPTION'

export class BillingService {
  constructor(private readonly client: SupabaseClient) {}

  private async execute(
    action: BillingAction,
    context: BillingCommandContext,
    payload: Record<string, unknown> = {},
  ) {
    const startedAt = Date.now()
    console.info(JSON.stringify({ action, area: 'billing', empresaId: context.empresaId }))

    const { data, error } = await this.client.rpc('billing_execute_command', {
      p_action: action,
      p_actor_user_id: context.actorUserId ?? null,
      p_empresa_id: context.empresaId,
      p_origin: context.origin,
      p_payload: payload,
      p_reason: context.reason,
    })

    if (error) {
      console.error(
        JSON.stringify({
          action,
          area: 'billing',
          code: error.code,
          durationMs: Date.now() - startedAt,
          empresaId: context.empresaId,
        }),
      )
      throw new Error(`Billing command failed: ${action}`)
    }

    console.info(
      JSON.stringify({
        action,
        area: 'billing',
        durationMs: Date.now() - startedAt,
        empresaId: context.empresaId,
        success: true,
      }),
    )
    return data
  }

  activateSubscription(context: BillingCommandContext, payload: Record<string, unknown>) {
    return this.execute('ACTIVATE_SUBSCRIPTION', context, payload)
  }

  renewSubscription(context: BillingCommandContext, payload: Record<string, unknown>) {
    return this.execute('RENEW_SUBSCRIPTION', context, payload)
  }

  cancelSubscription(context: BillingCommandContext, payload: Record<string, unknown> = {}) {
    return this.execute('CANCEL_SUBSCRIPTION', context, payload)
  }

  pauseSubscription(context: BillingCommandContext) {
    return this.execute('PAUSE_SUBSCRIPTION', context)
  }

  resumeSubscription(context: BillingCommandContext) {
    return this.execute('RESUME_SUBSCRIPTION', context)
  }

  expireSubscription(context: BillingCommandContext) {
    return this.execute('EXPIRE_SUBSCRIPTION', context)
  }

  registerPayment(context: BillingCommandContext, payload: Record<string, unknown>) {
    return this.execute('REGISTER_PAYMENT', context, payload)
  }

  registerPaymentEvent(context: BillingCommandContext, payload: Record<string, unknown>) {
    return this.execute('REGISTER_PAYMENT_EVENT', context, payload)
  }

  async processWebhook(event: BillingWebhookEvent) {
    const startedAt = Date.now()
    const payload = event.payload
    console.info(JSON.stringify({
      action: 'PROCESS_PAYMENT_WEBHOOK',
      area: 'billing',
      empresaId: event.empresaId,
      eventType: event.eventType,
      provider: event.provider,
    }))

    const { data: result, error } = await this.client.rpc(
      'billing_process_payment_webhook',
      {
        p_amount: payload.amount,
        p_currency: payload.currency,
        p_current_period_end: payload.current_period_end,
        p_current_period_start: payload.current_period_start,
        p_due_at: payload.due_at ?? null,
        p_empresa_id: event.empresaId,
        p_event_type: event.eventType,
        p_external_reference: payload.external_reference ?? null,
        p_next_payment_at: payload.next_payment_at ?? null,
        p_paid_at: payload.paid_at ?? null,
        p_payment_method: payload.payment_method ?? null,
        p_payment_status: payload.payment_status,
        p_payload: payload.event_payload ?? {},
        p_plan_id: payload.plan_id,
        p_provider: event.provider,
        p_provider_event_id: event.providerEventId,
        p_provider_invoice_id: payload.provider_invoice_id ?? null,
        p_provider_payment_id: payload.provider_payment_id,
        p_subscription_id: payload.subscription_id,
      },
    )

    if (error) {
      console.error(JSON.stringify({
        action: 'PROCESS_PAYMENT_WEBHOOK',
        area: 'billing',
        code: error.code,
        durationMs: Date.now() - startedAt,
        empresaId: event.empresaId,
        eventType: event.eventType,
        provider: event.provider,
      }))
      throw new Error('Billing payment webhook command failed.')
    }

    console.info(JSON.stringify({
      action: 'PROCESS_PAYMENT_WEBHOOK',
      area: 'billing',
      durationMs: Date.now() - startedAt,
      empresaId: event.empresaId,
      eventType: event.eventType,
      provider: event.provider,
      success: true,
    }))

    if (event.eventType === 'PAYMENT_APPROVED') {
      await billingEvents.onPaymentApproved(result)
    } else if (event.eventType === 'PAYMENT_REJECTED') {
      await billingEvents.onPaymentRejected(result)
    } else if (event.eventType === 'SUBSCRIPTION_CANCELLED') {
      await billingEvents.onSubscriptionCancelled(result)
    } else if (
      event.eventType === 'SUBSCRIPTION_CREATED' ||
      event.eventType === 'SUBSCRIPTION_REACTIVATED'
    ) {
      await billingEvents.onSubscriptionActivated(result)
    }

    return result
  }

  changePlan(context: BillingCommandContext, planId: string) {
    return this.execute('CHANGE_PLAN', context, { plan_id: planId })
  }

  startGracePeriod(context: BillingCommandContext, graceEndsAt: string) {
    return this.execute('START_GRACE_PERIOD', context, { grace_ends_at: graceEndsAt })
  }

  finishGracePeriod(context: BillingCommandContext) {
    return this.execute('FINISH_GRACE_PERIOD', context)
  }

  blockSubscription(context: BillingCommandContext) {
    return this.execute('BLOCK_SUBSCRIPTION', context)
  }

  unblockSubscription(context: BillingCommandContext, payload: Record<string, unknown> = {}) {
    return this.execute('UNBLOCK_SUBSCRIPTION', context, payload)
  }

  async getSubscriptionState(empresaId: string) {
    const { data, error } = await this.client
      .from('subscriptions')
      .select('*')
      .eq('empresa_id', empresaId)
      .single()

    if (error) {
      throw new Error('Unable to load subscription state.')
    }

    return data
  }
}
