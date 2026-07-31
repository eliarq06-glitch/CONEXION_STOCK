import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const drafts = await prisma.draft.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, name: true, updatedAt: true } // Don't fetch giant JSON strings for the list
    });
    return NextResponse.json(drafts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { name, data, id } = await req.json();
    
    if (id) {
      // Update existing draft
      const draft = await prisma.draft.update({
        where: { id },
        data: { name, data: JSON.stringify(data) }
      });
      return NextResponse.json(draft);
    } else {
      // Create new draft
      const draft = await prisma.draft.create({
        data: {
          name,
          data: JSON.stringify(data)
        }
      });
      return NextResponse.json(draft);
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
