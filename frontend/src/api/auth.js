import apiClient from './client';

/**
 * Check if an error was caused by the backend being offline/unreachable
 */
export function isNetworkError(err) {
  return (
    !err.response ||
    err.code === 'ERR_NETWORK' ||
    err.code === 'ECONNABORTED' ||
    err.code === 'ECONNREFUSED' ||
    err.message?.toLowerCase().includes('network error') ||
    err.message?.toLowerCase().includes('failed to fetch')
  );
}

// Offline dev bypass helper (commented out per user request)
// function createDevBypassUser(userId) { ... }

/**
 * Login user with userId and password
 * Calls POST /api/auth/login
 * Returns { token, user: { id, role, name }, isDevBypass?: boolean }
 */
export async function login(userId, password) {
  const res = await apiClient.post('/api/auth/login', { userId, password });
  const { token, user } = res.data;
  if (token) {
    localStorage.setItem('sarathi_token', token);
  }
  if (user) {
    localStorage.setItem('sarathi_user', JSON.stringify(user));
  }
  return { token, user, isDevBypass: false };
}

/**
 * Hydrates and validates session using current JWT
 * Calls GET /api/auth/me
 * Returns { user: { id, role, name } }
 */
export async function getProfile() {
  const res = await apiClient.get('/api/auth/me');
  const { user } = res.data;
  if (user) {
    localStorage.setItem('sarathi_user', JSON.stringify(user));
  }
  return user;
}

/**
 * Clears stored auth tokens and user data
 */
export function logout() {
  localStorage.removeItem('sarathi_token');
  localStorage.removeItem('sarathi_user');
}

/**
 * Retrieves stored token from localStorage
 */
export function getStoredToken() {
  return localStorage.getItem('sarathi_token');
}

/**
 * Retrieves cached user object from localStorage
 */
export function getStoredUser() {
  try {
    const raw = localStorage.getItem('sarathi_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
