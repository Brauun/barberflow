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

export function maskPhoneChange(event: ChangeEvent<HTMLInputElement>) {
  event.target.value = formatPhone(event.target.value)
}

export function maskCpfChange(event: ChangeEvent<HTMLInputElement>) {
  event.target.value = formatCpf(event.target.value)
}
