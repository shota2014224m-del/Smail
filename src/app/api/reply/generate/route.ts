import { NextRequest, NextResponse } from "next/server";
import { generateReply } from "@/lib/claude";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  const { emailId, userInstruction } = await request.json();

  const email = await prisma.email.findUnique({ where: { id: emailId } });
  if (!email) return NextResponse.json({ error: "Email not found" }, { status: 404 });

  try {
    const result = await generateReply({
      accountId: email.accountId,
      emailSubject: email.subject,
      emailFrom: email.from,
      emailBody: email.body,
      userInstruction,
    });

    return NextResponse.json({
      body: result.body,
      confidence: result.confidence,
      subject: email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
      to: email.from,
    });
  } catch (err: any) {
    console.error("Reply generation error:", err);
    return NextResponse.json(
      { error: err?.message ?? "Failed to generate reply" },
      { status: 500 }
    );
  }
}
