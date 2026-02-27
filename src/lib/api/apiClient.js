export async function apiClient(url, options = {}) {
  try {
    const { headers: customHeaders = {}, body, ...rest } = options;

    const isFormData =
      typeof FormData !== "undefined" && body instanceof FormData;

    // Only set JSON content-type if we're NOT sending FormData
    const headers = {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...customHeaders,
    };

    const res = await fetch(url, {
      ...rest,
      body,
      headers,
    });

    // Try to parse JSON when possible
    const contentType = res.headers.get("content-type") || "";
    const data = contentType.includes("application/json")
      ? await res.json().catch(() => ({}))
      : await res.text().catch(() => "");

    if (!res.ok) {
      const message =
        (data && typeof data === "object" && data.message) ||
        (typeof data === "string" && data) ||
        "API Error";

      const error = new Error(message);
      error.code = data?.code;
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