export async function apiClient(url, options = {}) {
  try {
    const {
      headers: customHeaders = {},
      ...rest
    } = options;

    const res = await fetch(url, {
      ...rest,
      headers: {
        "Content-Type": "application/json",
        ...customHeaders,
      },
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
