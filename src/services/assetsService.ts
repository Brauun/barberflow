import { supabase } from '../lib/supabase'

const allowedImageTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
const maxImageSizeBytes = 2 * 1024 * 1024

function assertImageFile(file: File) {
  if (!allowedImageTypes.includes(file.type)) {
    throw new Error('Use uma imagem PNG, JPG, JPEG ou WEBP.')
  }

  if (file.size > maxImageSizeBytes) {
    throw new Error('A imagem deve ter no maximo 2MB.')
  }
}

function fileExtension(file: File) {
  const byName = file.name.split('.').pop()?.toLowerCase()

  if (byName && ['png', 'jpg', 'jpeg', 'webp'].includes(byName)) {
    return byName
  }

  if (file.type === 'image/webp') {
    return 'webp'
  }

  if (file.type === 'image/png') {
    return 'png'
  }

  return 'jpg'
}

export function isStoragePath(value: string | null | undefined) {
  return Boolean(value && !value.startsWith('http') && !value.startsWith('blob:'))
}

export async function resolveAssetUrl(
  bucket: 'company-assets' | 'user-avatars',
  value: string | null | undefined,
) {
  if (!value) {
    return null
  }

  if (!isStoragePath(value)) {
    return value
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(value, 60 * 60)

  if (error) {
    console.error(`Falha ao carregar imagem do bucket ${bucket}:`, error.message)
    return null
  }

  return data.signedUrl
}

export async function uploadCompanyLogo(empresaId: string, file: File) {
  assertImageFile(file)

  const path = `empresas/${empresaId}/logo/logo-${Date.now()}.${fileExtension(file)}`
  const { error } = await supabase.storage
    .from('company-assets')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (error) {
    throw new Error(`Nao foi possivel enviar a logo: ${error.message}`)
  }

  return path
}

export async function uploadUserAvatar(userId: string, file: File) {
  assertImageFile(file)

  const path = `usuarios/${userId}/avatar/avatar-${Date.now()}.${fileExtension(file)}`
  const { error } = await supabase.storage
    .from('user-avatars')
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
    })

  if (error) {
    throw new Error(`Nao foi possivel enviar a foto: ${error.message}`)
  }

  return path
}
