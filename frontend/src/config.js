export const API_URL = import.meta.env.VITE_API_URL || (
  window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
    ? 'http://localhost:5000'
    : window.location.origin
);
