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

O endpoint atual aceita apenas envios de teste para o próprio usuário autenticado.
Eventos automáticos devem chamar esta função por uma camada confiável do backend,
nunca expondo a chave `SUPABASE_SERVICE_ROLE_KEY` no frontend.
