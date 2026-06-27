export async function uploadFileToCloudinary(
    file: File
): Promise<{ url: string; simulated?: boolean }> {
    const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

    const res = await fetch("/api/cloudinary/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64Data, filename: file.name }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    return data;
}