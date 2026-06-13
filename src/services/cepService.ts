import { onlyDigits } from '../utils/masks'

export type CepAddress = {
  bairro: string
  cep: string
  cidade: string
  estado: string
  rua: string
}

type ViaCepResponse = {
  bairro?: string
  cep?: string
  erro?: boolean
  localidade?: string
  logradouro?: string
  uf?: string
}

export async function lookupCep(value: string): Promise<CepAddress> {
  const cep = onlyDigits(value)

  if (cep.length !== 8) {
    throw new Error('Informe um CEP com 8 digitos.')
  }

  const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`)

  if (!response.ok) {
    throw new Error('Não foi possivel consultar o CEP agora.')
  }

  const data = (await response.json()) as ViaCepResponse

  if (data.erro) {
    throw new Error('CEP nao encontrado.')
  }

  return {
    bairro: data.bairro ?? '',
    cep,
    cidade: data.localidade ?? '',
    estado: data.uf ?? '',
    rua: data.logradouro ?? '',
  }
}
