import { getAuthToken } from "@/lib/queryClient";

export async function uploadImage(file: File, token?: string | null): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);

  const authToken = token ?? getAuthToken();

  const response = await fetch("/api/upload/image", {
    method: "POST",
    body: formData,
    credentials: "include",
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined,
  });

  if (!response.ok) {
    let message = "Failed to upload image";
    try {
      const data = await response.json();
      message = data?.message || message;
    } catch {
      // Ignore JSON parsing issues and keep fallback message.
    }
    if (response.status === 401 && message === "Failed to upload image") {
      message = "Please sign in again to upload a profile photo.";
    }
    throw new Error(message);
  }

  const data = await response.json();
  if (!data?.imageUrl) {
    throw new Error("Upload succeeded but no image URL was returned");
  }

  return String(data.imageUrl);
}
