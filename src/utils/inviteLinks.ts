function getAppBaseUrl() {
  const envUrl = import.meta.env.VITE_APP_URL

  if (typeof envUrl === 'string' && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, '')
  }

  return window.location.origin.replace(/\/+$/, '')
}

export function buildEmployeeInviteLink(token: string) {
  return `${getAppBaseUrl()}/convite/${token}`
}

export function buildEmployeeInviteMessage(input: {
  barbershopName: string
  link: string
}) {
  return `Olá, você foi convidado para acessar o BW Barber da ${input.barbershopName}. Clique no link para criar sua senha: ${input.link}`
}
