import { Groq } from "groq-sdk";

/**
 * Send text input to Groq chat completion and stream the response to console while
 * accumulating the full output string to return.
 * Requires GROQ_API_KEY in environment.
 */
export async function sendToGroq(inputText: string) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error("GROQ_API_KEY not configured in env");
    }

    const groq = new Groq({ apiKey });

    const systemContent = `Bạn là một nhà biên kịch miêu tả hành động quyến rũ ngắn dựa trên mô tả hình ảnh.\n
                        Nhiệm vụ của bạn là tạo ra một câu mô tả hành động quyến rũ ngắn, tự nhiên và hợp lý, phù hợp hoàn toàn với nội dung của caption.\n
                        Hành động nên mang tính gợi cảm, sinh động, không vượt ngoài những gì caption ngụ ý.\n
                        **Lưu ý: Ưu tiên các hành động liên quan đến trang phục của nhân vật**.\n
                        Không được thêm nhân vật hoặc đồ vật mới nếu caption không đề cập.\n\n
                        Đầu vào: ${inputText}\n\n
                        Đầu ra: Một câu hành động gợi cảm ngắn, tự nhiên, phù hợp ngữ cảnh.`;

    const chatCompletion = await groq.chat.completions.create({
        messages: [
            {
                role: "user",
                content: systemContent,
            },
        ],
        model: "openai/gpt-oss-120b",
        temperature: 1,
        max_completion_tokens: 8192,
        top_p: 1,
        stream: true,
        reasoning_effort: "medium",
        stop: null,
    });

    let accumulated = "";
    try {
        for await (const chunk of chatCompletion) {
            const text = chunk.choices?.[0]?.delta?.content || "";
            // Stream to server stdout as chunks arrive
            process.stdout.write(text);
            accumulated += text;
        }
    } catch (e) {
        console.error("Error streaming Groq response:", e);
        throw e;
    }

    process.stdout.write("\n");
    return accumulated.trim();
}

export default sendToGroq;
