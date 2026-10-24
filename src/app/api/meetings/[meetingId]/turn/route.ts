import { NextResponse } from "next/server"

import { requireOrg } from "@/features/meet/data"
import { interviewError, interviewTurn } from "@/features/meet/session"
import { db } from "@/prisma/db"

export async function POST(
    request: Request,
    context: { params: Promise<{ meetingId: string }> },
) {
    try {
        const { meetingId } = await context.params
        const { orgId, name } = await requireOrg()
        const owned = await db.orm.public.Meeting.where({ id: meetingId, orgId }).first()
        if (!owned) return NextResponse.json({ error: "Meeting not found." }, { status: 404 })
        return interviewTurn(meetingId, await request.formData(), name)
    } catch (error) {
        console.error(error)
        return interviewError(error)
    }
}
