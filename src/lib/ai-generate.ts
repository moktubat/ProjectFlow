import DOMPurify from "dompurify";

export async function generateWithGemini(prompt: string): Promise<string> {
    const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || `AI generation failed (${res.status}).`);
    }

    return DOMPurify.sanitize(data.text ?? "");
}