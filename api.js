(() => {
  const defaultBase =
    window.location.protocol === "file:"
      ? "http://127.0.0.1:8000"
      : `${window.location.protocol}//${window.location.hostname}:8000`;
  const baseUrl = (window.HEALTHMONITOR_API_URL || defaultBase).replace(/\/+$/, "");
  const tokenKey = "healthMonitorToken";

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    if (options.body !== undefined) headers.set("Content-Type", "application/json");

    const token = localStorage.getItem(tokenKey);
    if (token) headers.set("Authorization", `Bearer ${token}`);

    let response;
    try {
      response = await fetch(`${baseUrl}${path}`, { ...options, headers });
    } catch {
      throw new Error(`Could not connect to the API at ${baseUrl}. Start the Python backend and try again.`);
    }

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = data?.detail;
      const message = Array.isArray(detail)
        ? detail.map(item => item.msg).join(" ")
        : detail || `Request failed (${response.status}).`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return data;
  }

  window.HealthMonitorAPI = {
    baseUrl,
    request,
    getToken: () => localStorage.getItem(tokenKey),
    setToken: token => localStorage.setItem(tokenKey, token),
    clearToken: () => localStorage.removeItem(tokenKey)
  };
})();
