// api/client.js
// -----------------------------------------------------------------------
// A single configured axios instance for all our backend calls.
// Centralizing this means we set the base URL and auth header logic once,
// instead of repeating it in every component.
// -----------------------------------------------------------------------

import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const client = axios.create({
  baseURL: API_BASE_URL,
});

// Axios "interceptor": runs before every request is sent. We use it to
// automatically attach the JWT token (if we have one) to every request's
// Authorization header, so we don't have to do it manually in every call.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default client;
export { API_BASE_URL };
