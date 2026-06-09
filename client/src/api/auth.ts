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
