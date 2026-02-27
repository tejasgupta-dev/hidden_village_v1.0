export async function apiClient(url, options = {}) {
  try {
    const {
      headers: customHeaders = {},
      body,
      ...rest
    } = options;

    const headers = { ...customHeaders };

    // Only set JSON header if body is NOT FormData
    const isFormData = body instanceof FormData;

    if (!isFormData && body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      ...rest,
      body,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const error = new Error(data.message || "API Error");
      error.code = data.code;
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (err) {
    console.error("API Client Error:", err);
    throw err;
  }
}