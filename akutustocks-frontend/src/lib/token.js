// Satu-satunya tempat yang tahu cara menyimpan token.
// Jika tim memilih cookie HttpOnly, cukup ubah file ini.
const KEY = "akutustocks_token";

export const tokenStore = {
  get: () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set: (t) => {
    try {
      localStorage.setItem(KEY, t);
    } catch {
      /* abaikan */
    }
  },
  clear: () => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* abaikan */
    }
  },
};
