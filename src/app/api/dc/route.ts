// app/api/fc/message/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();

    // Required headers: Authorization + idempotency-key
    const authHeader = req.headers.get("authorization");
    const idempotencyKey = req.headers.get("idempotency-key");

    if (!idempotencyKey) {
      return NextResponse.json(
        { error: "Missing idempotency-key header" },
        { status: 400 }
      );
    }

    const response = await fetch("https://api.warpcast.com/fc/message", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WARCAST_API_KEY}`,
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || "Failed to send message" },
        { status: response.status }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}
