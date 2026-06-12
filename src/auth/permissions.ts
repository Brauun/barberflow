import type { UserRole } from '../types/database'

type AppRole = UserRole | 'cliente' | null | undefined

function isAdmin(role: AppRole) {
  return role === 'administrador'
}

function isManager(role: AppRole) {
  return role === 'gerente'
}

function isAdminOrManager(role: AppRole) {
  return isAdmin(role) || isManager(role)
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
  return isAdminOrManager(role)
}

export function canManageFinance(role: AppRole) {
  return isAdminOrManager(role)
}

export function canInviteEmployee(role: AppRole) {
  return isAdminOrManager(role)
}

export function canManageEmployees(role: AppRole) {
  return isAdminOrManager(role)
}

export function canManageClients(role: AppRole) {
  return role === 'administrador' || role === 'gerente' || role === 'recepcao'
}

export function canExportData(role: AppRole) {
  return isAdmin(role)
}

export function canManageSettings(role: AppRole) {
  return isAdmin(role)
}

export function canManageAppointments(role: AppRole) {
  return (
    role === 'administrador' ||
    role === 'gerente' ||
    role === 'barbeiro' ||
    role === 'recepcao'
  )
}

export function canViewReports(role: AppRole) {
  return isAdminOrManager(role)
}
