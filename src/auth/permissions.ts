import type { UserRole } from '../types/database'

type AppRole = UserRole | 'cliente' | null | undefined

function isAdmin(role: AppRole) {
  return role === 'administrador'
}

export function canManageServices(role: AppRole) {
  return isAdmin(role)
}

export function canCreateService(role: AppRole) {
  return canManageServices(role)
}

export function canEditService(role: AppRole) {
  return canManageServices(role)
}

export function canDeleteService(role: AppRole) {
  return canManageServices(role)
}

export function canViewFinance(role: AppRole) {
  return isAdmin(role)
}

export function canManageFinance(role: AppRole) {
  return isAdmin(role)
}

export function canInviteEmployee(role: AppRole) {
  return isAdmin(role)
}

export function canManageEmployees(role: AppRole) {
  return isAdmin(role)
}

export function canManageClients(role: AppRole) {
  return isAdmin(role)
}

export function canExportData(role: AppRole) {
  return isAdmin(role)
}

export function canManageSettings(role: AppRole) {
  return isAdmin(role)
}

export function canManageAppointments(role: AppRole) {
  return role === 'administrador' || role === 'barbeiro'
}

export function canViewReports(role: AppRole) {
  return isAdmin(role)
}
