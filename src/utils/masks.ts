import type { ChangeEvent } from 'react'

export function onlyDigits(value: string | null | undefined) {
  return String(value ?? '').replace(/\D/g, '')
}

export function formatPhone(value: string | null | undefined) {
  const digits = onlyDigits(value).slice(0, 11)

  if (digits.length <= 2) {
    return digits ? `(${digits}` : ''
  }

  if (digits.length <= 3) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  }

  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3)}`
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 3)} ${digits.slice(3, 7)}-${digits.slice(7)}`
}

export function formatCpf(value: string | null | undefined) {
  const digits = onlyDigits(value).slice(0, 11)

  if (digits.length <= 3) {
    return digits
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`
  }

  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

export function formatCnpj(value: string | null | undefined) {
  const digits = onlyDigits(value).slice(0, 14)

  if (digits.length <= 2) {
    return digits
  }

  if (digits.length <= 5) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`
  }

  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  }

  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

export function formatCep(value: string | null | undefined) {
  const digits = onlyDigits(value).slice(0, 8)

  if (digits.length <= 5) {
    return digits
  }

  return `${digits.slice(0, 5)}-${digits.slice(5)}`
}

export function maskPhoneChange(event: ChangeEvent<HTMLInputElement>) {
  event.target.value = formatPhone(event.target.value)
}

export function maskCpfChange(event: ChangeEvent<HTMLInputElement>) {
  event.target.value = formatCpf(event.target.value)
}

export function maskCnpjChange(event: ChangeEvent<HTMLInputElement>) {
  event.target.value = formatCnpj(event.target.value)
}

export function maskCepChange(event: ChangeEvent<HTMLInputElement>) {
  event.target.value = formatCep(event.target.value)
}
