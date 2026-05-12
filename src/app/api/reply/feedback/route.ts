import { NextRequest, NextResponse } from "next/server";
import { updateReplyFeedback } from "@/lib/claude";

export async function POST(request: NextRequest) {
  const { patternId, delta } = await request.json();
  await updateReplyFeedback(patternId, delta);
  return NextResponse.json({ ok: true });
}
