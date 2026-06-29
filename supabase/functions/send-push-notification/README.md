# Push Notifications

Configure os segredos da Edge Function antes de enviar notificações reais:

```text
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:suporte@suaempresa.com
```

O frontend também precisa da chave pública:

```text
VITE_VAPID_PUBLIC_KEY=
```

O endpoint aceita:

- envio de teste para o próprio usuário autenticado;
- evento `appointment_created`, recebendo somente `appointment_id`.
- evento `appointment_cancelled`, recebendo somente `appointment_id`.

No evento de agendamento, destinatários, mensagem e empresa são derivados no
backend. O cliente não pode escolher usuários arbitrários e a chave
`SUPABASE_SERVICE_ROLE_KEY` nunca é exposta no frontend.
