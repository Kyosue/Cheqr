export const API_CONFIG = {
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'https://cheqr.onrender.com/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
}; 