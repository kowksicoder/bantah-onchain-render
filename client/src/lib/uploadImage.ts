import { getAuthToken } from "@/lib/queryClient";

export async function uploadImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("image", file);

  const authToken = getAuthToken();

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
    throw new Error(message);
  }

  const data = await response.json();
  if (!data?.imageUrl) {
    throw new Error("Upload succeeded but no image URL was returned");
  }

  return String(data.imageUrl);
}
