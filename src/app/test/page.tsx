
import { Suspense } from "react";
import { connection } from "next/server";
import { db } from "@/prisma/db";
import LoadingAnimation from "@/features/loader/loader";

async function VoicesList() {
    await connection();

    const voices = await db.orm.public.Voice.all();

    return (
        <>
            <h1 className="text-2xl font-bold mb-4">
                Voices ({voices.length})
            </h1>

            <ul className="space-y-2">
                {voices.map((voice) => (
                    <li key={voice.id}>
                        {voice.name} - {voice.variant}
                    </li>
                ))}
            </ul>
        </>
    );
}

export default function TestPage() {
    return (
        <div className="p-8">
            <Suspense fallback={<LoadingAnimation />}>
                <VoicesList />
            </Suspense>
        </div>
    );
}
