# Checkout Pro do Mercado Pago

O checkout é criado exclusivamente pela Edge Function
`create-mercadopago-checkout`. O Access Token nunca deve receber o prefixo
`VITE_` nem ser salvo nos arquivos `.env` do frontend.

## Secrets necessários

```powershell
supabase secrets set MERCADO_PAGO_ACCESS_TOKEN="SEU_ACCESS_TOKEN"
supabase secrets set MERCADO_PAGO_WEBHOOK_SECRET="SEU_SECRET_DE_WEBHOOK"
supabase secrets set APP_BASE_URL="https://barber.bwsolutech.com.br"
```

O secret de Webhook é exibido pelo Mercado Pago ao configurar a notificação da
aplicação. Ele não é o mesmo valor do Access Token.

## Banco de dados

Antes de publicar o webhook, aplique a migration:

```text
supabase/migrations/20260702100000_billing_payment_webhook_command.sql
```

## Publicação

```powershell
supabase functions deploy create-mercadopago-checkout --project-ref cxuxrczaxlchpcengxsf
supabase functions deploy mercadopago-webhook --no-verify-jwt --project-ref cxuxrczaxlchpcengxsf
```

O webhook é publicado sem a validação JWT do gateway porque a chamada parte do
Mercado Pago. A própria função valida a origem usando HMAC antes de processar o
evento.

## Configuração no Mercado Pago

Cadastre somente o evento `payment` usando a URL:

```text
https://cxuxrczaxlchpcengxsf.supabase.co/functions/v1/mercadopago-webhook
```

Copie a assinatura secreta exibida nessa configuração para
`MERCADO_PAGO_WEBHOOK_SECRET`.

## Comportamento

- A criação do checkout valida o JWT e confirma que o usuário é administrador.
- O retorno `/app/assinatura/retorno` nunca altera a assinatura.
- O webhook valida `x-signature`, `x-request-id` e `data.id`.
- O pagamento é consultado diretamente na API do Mercado Pago.
- Somente pagamentos aprovados ativam o plano, sempre pelo Billing Service.
- Evento, pagamento, período, assinatura e auditoria são gravados em uma única
  transação.
- Eventos pendentes, rejeitados, cancelados e estornados são registrados sem
  liberar acesso.
- Eventos repetidos retornam sucesso sem duplicar pagamento ou auditoria.
