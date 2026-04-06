import { QueryClient } from "@tanstack/react-query";

function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    throw new Error(`${res.status}: ${res.statusText}`);
  }
}

// Store token from Privy authentication (set by the useAuth hook)
let cachedAuthToken: string | null = null;
let authTokenProvider: (() => Promise<string | null>) | null = null;

export function setAuthToken(token: string | null) {
  cachedAuthToken = token;
}

export function setAuthTokenProvider(provider: (() => Promise<string | null>) | null) {
  authTokenProvider = provider;
}

export function clearAuthTokenProvider(provider?: (() => Promise<string | null>) | null) {
  if (!provider || authTokenProvider === provider) {
    authTokenProvider = null;
  }
}

// Get the cached auth token that was set by useAuth hook
export function getAuthToken(): string | null {
  return cachedAuthToken;
}

async function resolveAuthToken(options?: { forceRefresh?: boolean }) {
  const forceRefresh = options?.forceRefresh ?? false;

  if ((forceRefresh || !cachedAuthToken) && authTokenProvider) {
    try {
      const nextToken = await authTokenProvider();
      cachedAuthToken = nextToken || null;
    } catch (error) {
      console.error("Failed to resolve auth token:", error);
      if (forceRefresh) {
        cachedAuthToken = null;
      }
    }
  }

  return cachedAuthToken;
}

function buildHeaders(authToken: string | null, includeJson = true): HeadersInit {
  return {
    ...(includeJson ? { "Content-Type": "application/json" } : {}),
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<any> {
  const makeRequest = async (authToken: string | null) => {
    const options: RequestInit = {
      method,
      headers: buildHeaders(authToken),
      credentials: "include",
    };

    if (data !== undefined) {
      options.body = JSON.stringify(data);
    }

    return fetch(url, options);
  };

  let authToken = await resolveAuthToken();
  let res = await makeRequest(authToken);

  if (res.status === 401 && authTokenProvider) {
    authToken = await resolveAuthToken({ forceRefresh: true });
    res = await makeRequest(authToken);
  }

  try {
    throwIfResNotOk(res);
  } catch (error) {
    let errorMessage = `Error: ${res.status}`;
    try {
      const errorData = await res.json();
      errorMessage += `: ${JSON.stringify(errorData)}`;
    } catch {
      errorMessage += `: ${res.statusText}`;
    }
    console.error("API Request Error:", errorMessage);
    throw new Error(errorMessage);
  }

  // Check if response has content
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json();
  }

  // If no JSON content, return empty object
  return {};
}

async function queryFetch(fullUrl: string) {
  const makeRequest = async (authToken: string | null) =>
    fetch(fullUrl, {
      credentials: "include",
      headers: buildHeaders(authToken, false),
    });

  let authToken = await resolveAuthToken();
  let res = await makeRequest(authToken);

  if (res.status === 401 && authTokenProvider) {
    authToken = await resolveAuthToken({ forceRefresh: true });
    res = await makeRequest(authToken);
  }

  return res;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const url = queryKey[0] as string;
        const params = queryKey[1] as Record<string, string> | undefined;

        let fullUrl = url;
        if (params) {
          const searchParams = new URLSearchParams(params);
          fullUrl += `?${searchParams.toString()}`;
        }

        const res = await queryFetch(fullUrl);

        try {
          throwIfResNotOk(res);
        } catch (error) {
          let errorMessage = `Error: ${res.status}`;
          try {
            const errorData = await res.json();
            errorMessage += `: ${JSON.stringify(errorData)}`;
          } catch {
            errorMessage += `: ${res.statusText}`;
          }
          console.error("Query Function Error:", errorMessage);
          throw new Error(errorMessage);
        }

        // Check if response has content
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return res.json();
        }

        return {};
      },
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});
