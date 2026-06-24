import DOMPurify from "dompurify";

export async function generateWithGemini(prompt: string, token: string | null): Promise<string> {
    if (!token) throw new Error("You must be signed in to use AI generation.");

    const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt }),
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.error || `AI generation failed (${res.status}).`);
    }

    return DOMPurify.sanitize(data.text ?? "");
}