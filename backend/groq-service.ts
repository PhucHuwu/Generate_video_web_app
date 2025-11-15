import { Groq } from "groq-sdk";

/**
 * Send text input to Groq chat completion and stream the response to console while
 * accumulating the full output string to return.
 * Requires GROQ_API_KEY in environment.
 */
export async function sendToGroq(inputText: string, apiKeyOverride?: string) {
    const apiKey = apiKeyOverride || process.env.GROQ_API_KEY;
    if (!apiKey) {
        throw new Error("GROQ_API_KEY not configured in env or provided as override");
    }

    const groq = new Groq({ apiKey });

    const systemContent = `
    Bạn là một biên kịch tạo ra hành động gợi cảm dựa hoàn toàn trên mô tả hình ảnh.\n

    Nhiệm vụ:\n
    - Tạo ra một câu mô tả ba hành động gợi cảm, tự nhiên và hợp lý, phù hợp 100% với những gì caption mô tả hoặc gợi ý.\n
    - Hành động phải hoàn toàn có thể xảy ra với bối cảnh mô tả trong caption (nhân vật đang đứng, ngồi hoặc nằm; trang phục cụ thể; tư thế và biểu cảm thực tế).\n
    - Bạn chỉ được chọn những hành động phù hợp với mô tả trang phục và bối cảnh, không mô tả hành động liên quan đến đồ vật/trang phục nếu caption không đề cập.\n
    - Các hành động gợi cảm ví dụ (Ưu tiên tác hành động liên quan đến trang phục của nhân vật, trách các hoạt động tương tác tay với khuôn mặt):\n
      • Điều chỉnh trang phục (kéo áo xuống một chút, kéo quần xuống một chút, kéo dây cho tụt xuống một chút)\n
      • Xoay một vòng cơ thể để lộ đường cong mềm mại\n
      • Vuốt ve cơ thể mình như: vuốt ve ngực, vuốt ve đùi\n
    - Không mô tả bất cứ điều gì không nhìn thấy: không suy đoán cảm xúc, không thêm bối cảnh, không thêm người hay đồ vật mới.
    - Hãy mô tả một cách chi tiết nhất có thể cách hành động đó diễn ra.
    - Không mô tả hành động mâu thuẫn với caption.\n

    Đầu vào: ${inputText}\n\n

    Đầu ra: Một câu mô tả chi tiết ba hành động gợi cảm, tự nhiên và hoàn toàn phù hợp với bối cảnh mà caption cung cấp bằng tiếng Việt.`;

    const chatCompletion = await groq.chat.completions.create({
        messages: [
            {
                role: "user",
                content: systemContent,
            },
        ],
        model: "openai/gpt-oss-120b",
        temperature: 1.7,
        max_completion_tokens: 8192,
        top_p: 1,
        stream: true,
        reasoning_effort: "high",
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
