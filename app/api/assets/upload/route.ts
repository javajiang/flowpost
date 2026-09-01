import { NextResponse } from "next/server";

import { saveAsset } from "@/lib/assets";

export async function POST(req: Request) {
  let formData: FormData;

  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "Only image files are supported" }, { status: 400 });
  }

  const asset = await saveAsset(file);
  const url = new URL(`/api/assets/${asset.id}`, req.url).toString();

  return NextResponse.json({
    id: asset.id,
    url,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
    size: asset.size,
  });
}

