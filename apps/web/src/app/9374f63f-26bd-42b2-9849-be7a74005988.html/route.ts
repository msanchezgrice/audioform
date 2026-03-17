import { NextResponse } from "next/server";

const body = "9374f63f-26bd-42b2-9849-be7a74005988";

export async function GET() {
  return new NextResponse(body, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
}
