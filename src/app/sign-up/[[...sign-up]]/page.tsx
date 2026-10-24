import { SignUp } from "@clerk/nextjs";
import LoadingAnimation from "@/features/loader/loader";
import { Suspense } from "react";
export default function SignUpPage() {
    return (
        <Suspense fallback={<LoadingAnimation />}>
            <div className="flex min-h-screen items-center justify-center bg-background">
                <SignUp
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