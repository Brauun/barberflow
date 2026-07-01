# Checkout Pro do Mercado Pago

O checkout é criado exclusivamente pela Edge Function
`create-mercadopago-checkout`. O Access Token nunca deve receber o prefixo
`VITE_` nem ser salvo nos arquivos `.env` do frontend.

## Secrets necessários

```powershell
supabase secrets set MERCADO_PAGO_ACCESS_TOKEN="SEU_ACCESS_TOKEN"
supabase secrets set APP_BASE_URL="https://barber.bwsolutech.com.br"
```

Para desenvolvimento publicado, `APP_BASE_URL` precisa ser uma URL acessível
pelo Mercado Pago. `localhost` pode ser usado somente em testes locais de
criação da preferência, pois as URLs de retorno não serão acessíveis fora da
máquina.

## Publicação

```powershell
supabase functions deploy create-mercadopago-checkout --project-ref cxuxrczaxlchpcengxsf
```

## Comportamento desta etapa

- A função valida o JWT e confirma que o usuário é administrador da empresa.
- O plano e a assinatura são lidos diretamente do banco.
- O cliente é redirecionado usando o `init_point` retornado pelo Mercado Pago.
- O retorno abre `/app/assinatura/retorno`.
- Nenhuma assinatura ou pagamento é alterado nesta etapa.
- A URL `mercadopago-webhook` fica reservada para a próxima fase; o webhook
  ainda não está implementado e não libera acesso.
