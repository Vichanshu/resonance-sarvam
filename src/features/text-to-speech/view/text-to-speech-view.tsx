import { TextPanel } from "../components/text-panel";
import { VoicePreviewPlaceholder } from "../components/voice-preview-placeholder";
import { SettingsPanel } from "../components/settings-panel";


export function TextToSpeechView() {
    return (
        <div className="flex min-h-0 flex-1 overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col">
                <TextPanel />
                <VoicePreviewPlaceholder />
            </div>
            <SettingsPanel />
        </div>
    );
};