import api from './axios'

export async function login(email: string, password: string) {
  const res = await api.post('/login', { email, password })
  localStorage.setItem('token', res.data.token)
  return res.data
}

export async function logout() {
  await api.post('/logout')
  localStorage.removeItem('token')
}

export async function getMe() {
  const res = await api.get('/me')
  return res.data
}

export async function updatePassword(currentPassword: string, password: string, passwordConfirmation: string) {
  const res = await api.patch('/me/password', {
    current_password: currentPassword,
    password,
    password_confirmation: passwordConfirmation,
  })
  return res.data
}

export async function updateOnDutyStatus(onDuty: boolean) {
  const res = await api.patch('/me/on-duty', { on_duty: onDuty })
  return res.data as { on_duty: boolean }
}

export async function updatePreferences(preferences: Record<string, unknown>) {
  const res = await api.patch('/me/preferences', { preferences })
  return res.data as { preferences: Record<string, unknown> }
}

export async function updateAvatar(file: File) {
  const form = new FormData()
  form.append('avatar', file)
  const res = await api.post('/me/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function removeAvatar() {
  const res = await api.delete('/me/avatar')
  return res.data
}
