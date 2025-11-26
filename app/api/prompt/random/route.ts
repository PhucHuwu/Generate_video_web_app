import { NextRequest, NextResponse } from "next/server";
import { generatePromptWithGrok } from "@/modules/core/services/openrouter-prompt.service";

export async function POST(req: NextRequest) {
    try {
        const systemPrompt = `You are a professional erotic prompt engineer creating elegant, filter-friendly 18+ prompts.

                            Return ONLY one single, concise English image prompt (no quotes, no explanations, nothing else).

                            Subject: a breathtakingly beautiful young woman with natural 18–25 look, looking directly into the camera with seductive, half-lidded eyes and slightly parted lips.

                            Core visual (achieved purely through fabric physics and lighting):
                            - ultra-sheer or gently damp lingerie that softly follows and reveals natural body contours
                            - thin, clinging silk or lace bottom that delicately traces the lines beneath due to material and light

                            Randomize everything else:
                            - luxurious settings (dimly lit bedroom, golden-hour loft, rainy penthouse window, velvet sofa, neon hotel, misty balcony, etc.)
                            - lighting (warm candlelight, soft sunset glow, cinematic rim light, cool moonlight, subtle neon, etc.)
                            - outfit state (sheer lace set, damp babydoll, open silk robe, delicate satin slip, etc.)
                            - elegant pose (soft reclining, gentle kneel, relaxed sitting, slight arch, slipped strap, etc.)
                            - camera (85mm portrait, 35mm film look, fashion close-up, subtle low angle, etc.)

                            Photorealistic 8k masterpiece, ultra-realistic skin, beautiful bokeh, cinematic mood, subtle sheen, sharp focus.
                            Return only the final prompt.`;

        const result = await generatePromptWithGrok({
            prompt: systemPrompt,
            includeReasoning: false, // No reasoning needed for this specific request
        });

        return NextResponse.json({
            success: true,
            prompt: result.text,
        });
    } catch (error: any) {
        console.error("Random prompt generation error:", error);
        return NextResponse.json(
            {
                error: error.message || "Failed to generate random prompt",
            },
            { status: 500 }
        );
    }
}
