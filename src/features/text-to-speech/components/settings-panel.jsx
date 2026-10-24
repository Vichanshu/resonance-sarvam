import { Settings } from "lucide-react";
export function SettingsPanel() {
    return (
        <div className="hidden w-105 min-h-0 flex-col border-l lg:flex">
            <div className="flex items-center gap-2 border-b px-4 h-12">
                <Settings className="size-4" />
                <span className="text-sm font-medium">Settings</span>
            </div>
            <div className="flex flex-1 items-center justify-center p-4">
                <p className="text-sm text-muted-foreground">
                    Voice settings will appear here
                </p>
            </div>
        </div>
    );
};