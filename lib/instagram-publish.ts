export type InstagramPublishInput = {
  accessToken: string;
  instagramUserId: string;
  imageUrl: string;
  caption?: string;
  graphApiVersion?: string;
};

export type InstagramPublishResult = {
  creationId: string;
  mediaId: string;
};

function getGraphApiBaseUrl(version: string) {
  return `https://graph.facebook.com/${version}`;
}

async function readGraphError(response: Response) {
  try {
    const data = (await response.json()) as { error?: { message?: string; type?: string; code?: number; error_subcode?: number } };
    const message = data.error?.message || response.statusText || "Unknown Graph API error";
    const suffix = [data.error?.type ? `type ${data.error.type}` : "", data.error?.code ? `code ${data.error.code}` : "", data.error?.error_subcode ? `subcode ${data.error.error_subcode}` : ""]
      .filter(Boolean)
      .join(", ");
    return suffix ? `${message} (${suffix})` : message;
  } catch {
    return response.statusText || "Unknown Graph API error";
  }
}

export async function publishInstagramImage(input: InstagramPublishInput): Promise<InstagramPublishResult> {
  const version = input.graphApiVersion || "v22.0";
  const baseUrl = getGraphApiBaseUrl(version);
  if (!input.accessToken.trim()) {
    throw new Error("Instagram access token is required.");
  }

  if (!input.instagramUserId.trim()) {
    throw new Error("Instagram user id is required.");
  }

  const formData = new URLSearchParams({
    image_url: input.imageUrl,
    access_token: input.accessToken,
  });

  if (input.caption?.trim()) {
    formData.set("caption", input.caption.trim());
  }

  const containerResponse = await fetch(`${baseUrl}/${input.instagramUserId}/media`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: formData,
  });

  if (!containerResponse.ok) {
    throw new Error(`Instagram media container failed: ${await readGraphError(containerResponse)}`);
  }

  const containerData = (await containerResponse.json()) as { id?: string };
  const creationId = containerData.id;

  if (!creationId) {
    throw new Error("Instagram media container did not return an id.");
  }

  const publishResponse = await fetch(`${baseUrl}/${input.instagramUserId}/media_publish`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      creation_id: creationId,
      access_token: input.accessToken,
    }),
  });

  if (!publishResponse.ok) {
    throw new Error(`Instagram publish failed: ${await readGraphError(publishResponse)}`);
  }

  const publishData = (await publishResponse.json()) as { id?: string };
  const mediaId = publishData.id;

  if (!mediaId) {
    throw new Error("Instagram publish did not return a media id.");
  }

  return {
    creationId,
    mediaId,
  };
}
