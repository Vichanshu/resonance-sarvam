import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";
import LoadingAnimation from "@/features/loader/loader";

export default function SignInPage() {
    return (
        <Suspense fallback={<LoadingAnimation />}>
            <div className="flex min-h-screen items-center justify-center bg-background">
                <SignIn
                    appearance={{
                        elements: {
                            rootBox: "mx-auto",
                            card: "shadow-lg",
                        },
                    }}
                />
            </div>
        </Suspense>
    );
}