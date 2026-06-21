// VERSAO TEMPORARIA "KILL SWITCH"
// Objetivo unico: se desinstalar e limpar todo cache de qualquer cliente
// (inclusive apps instalados no iOS) que ainda esteja com uma versao antiga
// presa. Depois que todo mundo tiver passado por essa versao, podemos
// trocar por uma versao com cache de novo (o arquivo antigo esta salvo
// em public/sw.js.backup-v4-cache-logic).

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map((name) => caches.delete(name)))

      await self.registration.unregister()
    })(),
  )
})

// Nao intercepta nenhum fetch - deixa tudo passar direto pra rede.
// Nao forca reload aqui: isso evitaria um loop (cada reload registraria
// esse mesmo script de novo). O usuario so precisa reabrir o app uma vez
// depois do deploy pra ficar livre do service worker antigo de vez.
