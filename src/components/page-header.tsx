import { Headphones, ThumbsUp } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function PageHeader({
    title,
    className,
}: {
    title: string;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "flex items-center justify-between border-b px-4 py-4",
                className,
            )}
        >
            <div className="flex items-center gap-2">
                <SidebarTrigger />
                <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            </div>
            <div className="flex items-center gap-3">
                <Link
                    href="mailto:vichanshu@gmail.com"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                    <ThumbsUp />
                    <span className="hidden lg:block">Feedback</span>
                </Link>
                <Link
                    href="mailto:vichanshu@gmail.com"
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                    <Headphones />
                    <span className="hidden lg:block">Need help?</span>
                </Link>
            </div>
        </div>
    );
};