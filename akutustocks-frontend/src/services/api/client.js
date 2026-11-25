import axios from "axios";
import { tokenStore } from "@/lib/token";

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const onLogin = window.location.pathname.startsWith("/login");
    const isPasswordChange = err.config?.url?.includes("/auth/password");
    if (err.response?.status === 401 && !onLogin && !isPasswordChange) {
      tokenStore.clear();
      window.location.assign("/login");
    }
    return Promise.reject(err);
  }
);

/** Ubah error axios / mock menjadi pesan yang bisa dipahami pengguna. */
export function getErrorMessage(err, fallback = "Terjadi kesalahan. Coba lagi.") {
  if (err?.response?.data?.message) return err.response.data.message;
  if (err?.code === "ECONNABORTED") return "Server terlalu lama merespons. Coba lagi.";
  if (err?.message === "Network Error") return "Tidak dapat terhubung ke server. Periksa koneksi Anda.";
  return fallback;
}

/** Ambil error per-field bila backend mengirim errors: [{ field, message }]. */
export function getFieldErrors(err) {
  const list = err?.response?.data?.errors;
  return Array.isArray(list) ? list.filter((e) => e?.field && e?.message) : [];
}
