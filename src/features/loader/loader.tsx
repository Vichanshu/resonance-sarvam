
"use client"

import { Lottie } from "lottie-react"

export default function LoadingAnimation() {
    return (
        <div
            role="status"
            aria-label="Loading..."
            className="flex h-svh w-full items-center justify-center"
        >
            <div className="size-48">
                <Lottie
                    src="/loading.json"
                    autoplay
                    loop
                />
            </div>
        </div>
    )
}
