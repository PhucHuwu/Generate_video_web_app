export interface GenerateInput {
    prompt: string;
    // when provided, use the image-to-video API
    image_url?: string;
    duration?: "5" | "10";
    negative_prompt?: string;
    cfg_scale?: number;
}

export interface GenerateResult {
    taskId: string;
    state: string;
    resultUrls?: string[];
    raw?: any;
    geminiDescription?: string;
    groqOutput?: string;
}

import { describeImageWithGemini } from "./gemini-service";
import { sendToGroq } from "./groq-service";

const API_BASE = "https://api.kie.ai/api/v1/jobs";
const API_KEY = process.env.KIE_API_KEY || "";

if (!API_KEY) {
    // don't throw here — route will return helpful error. But log to help debug.
    console.warn(
        "KIE_API_KEY is not set. generate-service will fail until configured."
    );
}

export async function createTask(
    model: string,
    input: any,
    callBackUrl?: string
) {
    const body: any = { model, input };
    if (callBackUrl) body.callBackUrl = callBackUrl;

    const res = await fetch(`${API_BASE}/createTask`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`CreateTask failed: ${res.status} ${text}`);
    }

    const json = await res.json();
    return json;
}

async function getRecordInfo(taskId: string) {
    const url = `${API_BASE}/recordInfo?taskId=${encodeURIComponent(taskId)}`;
    const res = await fetch(url, {
        method: "GET",
        headers: {
            Authorization: `Bearer ${API_KEY}`,
        },
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`recordInfo failed: ${res.status} ${text}`);
    }

    return res.json();
}

/**
 * Fetch task info for a given taskId and return a normalized object
 */
export async function fetchTaskInfo(taskId: string) {
    if (!API_KEY) throw new Error("KIE_API_KEY not configured on server");
    const info = await getRecordInfo(taskId);
    const state = info?.data?.state;
    let resultUrls: string[] | undefined;
    try {
        const resultJson = info?.data?.resultJson;
        if (typeof resultJson === "string") {
            const parsed = JSON.parse(resultJson);
            resultUrls = parsed?.resultUrls;
        } else if (typeof resultJson === "object") {
            resultUrls = resultJson?.resultUrls;
        }
    } catch (e) {
        // ignore
    }

    return { taskId, state, resultUrls, raw: info };
}

/**
 * Generate media from a prompt. This function will create a task and poll until completion
 * or timeout. If the task doesn't complete in time, it returns the taskId and current state.
 */
export async function generateMedia(
    input: GenerateInput,
    opts: {
        pollIntervalMs?: number;
        maxAttempts?: number;
        callBackUrl?: string;
    } = {}
): Promise<GenerateResult> {
    if (!API_KEY) {
        throw new Error("KIE_API_KEY not configured on server");
    }

    // Disallow missing prompt here. The application flow now requires the client to
    // generate a prompt first (via `/api/describe`) or provide one manually.
    if (!input.image_url) {
        throw new Error(
            "Dịch vụ chỉ hỗ trợ tạo video từ ảnh hoặc ảnh+kèm prompt. Trường hợp chỉ nhập prompt không được hỗ trợ."
        );
    }

    // Defensive check: KIE only accepts https image URLs. Reject non-https inputs early.
    if (input.image_url && !/^https:\/\//i.test(input.image_url)) {
        throw new Error(
            "KIE chỉ chấp nhận image_url bắt đầu bằng https://. Vui lòng cung cấp URL công khai (https) hoặc gửi imageBase64 để upload."
        );
    }

    const { pollIntervalMs = 2000, maxAttempts = 30 } = opts;

    // Require a non-empty prompt. The client is responsible for obtaining a prompt
    // (image -> Gemini -> Groq) and sending it with the request. This prevents the
    // server from implicitly calling Gemini/Groq during generation.
    if (typeof input.prompt !== "string" || input.prompt.trim() === "") {
        throw new Error(
            "Cần prompt để tạo media. Vui lòng nhấn 'Gen Prompt' để tự động sinh prompt từ ảnh hoặc nhập mô tả thủ công."
        );
    }

    // choose model based on presence of image_url
    const model = input.image_url
        ? "kling/v2-5-turbo-image-to-video-pro"
        : "kling/v2-5-turbo-text-to-video-pro";

    const createPayload: any = {
        prompt: input.prompt,
        // Use default 10 seconds when not provided. Keep explicit "5" if requested.
        duration: input.duration ?? "10",
        negative_prompt:
            input.negative_prompt ?? "blur, distort, and low quality",
        cfg_scale: typeof input.cfg_scale === "number" ? input.cfg_scale : 0.5,
    };

    // aspect_ratio parameter removed: do not forward aspect_ratio to KIE

    if (input.image_url) {
        createPayload.image_url = input.image_url;
    }

    let createResp: any;
    try {
        createResp = await createTask(model, createPayload, opts.callBackUrl);
    } catch (err: any) {
        const msg = String(err?.message || err);
        // If KIE returns 503 (service unavailable / model overloaded), fallback to a lighter Gemini model
        if (msg.includes("503") || /unavailab/i.test(msg)) {
            console.warn(
                "createTask failed with 503/unavailable — falling back to gemini-2.0-flash-lite",
                { err: msg }
            );
            const fallbackModel = "gemini-2.0-flash-lite";
            createResp = await createTask(
                fallbackModel,
                createPayload,
                opts.callBackUrl
            );
        } else {
            throw err;
        }
    }
    // Support a few possible response shapes and log response if missing
    const taskId =
        createResp?.data?.taskId ||
        createResp?.taskId ||
        createResp?.data?.id ||
        createResp?.id;
    if (!taskId) {
        console.error("createTask returned no taskId", { createResp });
        // include summarized response in the error to help debugging caller
        let summary = "";
        try {
            summary = JSON.stringify(createResp);
        } catch (e) {
            summary = String(createResp);
        }
        throw new Error(
            `No taskId returned from createTask; response: ${summary}`
        );
    }

    // Poll with initial fast interval
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const info = await getRecordInfo(taskId);
        const state = info?.data?.state;
        if (state === "success") {
            let resultJson = info?.data?.resultJson;
            let resultUrls: string[] | undefined;
            try {
                if (typeof resultJson === "string") {
                    const parsed = JSON.parse(resultJson);
                    resultUrls = parsed?.resultUrls;
                } else if (typeof resultJson === "object") {
                    resultUrls = resultJson?.resultUrls;
                }
            } catch (e) {
                // ignore parse error
            }

            return {
                taskId,
                state: "success",
                resultUrls,
                raw: info,
            };
        }

        if (state === "fail" || state === "failed") {
            return {
                taskId,
                state: "fail",
                raw: info,
            };
        }

        // waiting -> sleep and retry
        await new Promise((r) => setTimeout(r, pollIntervalMs));
    }

    // Fast polling timeout - switch to extended polling with longer interval
    // Poll thêm 20 lần với interval 5s (tổng thêm ~100s) để đảm bảo lấy được kết quả cuối cùng
    console.log(
        `Task ${taskId}: Fast polling timeout, switching to extended polling...`
    );
    const extendedPollInterval = 5000; // 5 giây
    const extendedMaxAttempts = 20; // thêm 20 lần nữa

    for (let attempt = 0; attempt < extendedMaxAttempts; attempt++) {
        await new Promise((r) => setTimeout(r, extendedPollInterval));

        const info = await getRecordInfo(taskId).catch(() => null);
        const state = info?.data?.state;

        if (state === "success") {
            let resultJson = info?.data?.resultJson;
            let resultUrls: string[] | undefined;
            try {
                if (typeof resultJson === "string") {
                    const parsed = JSON.parse(resultJson);
                    resultUrls = parsed?.resultUrls;
                } else if (typeof resultJson === "object") {
                    resultUrls = resultJson?.resultUrls;
                }
            } catch (e) {
                // ignore parse error
            }

            return {
                taskId,
                state: "success",
                resultUrls,
                raw: info,
            };
        }

        if (state === "fail" || state === "failed") {
            return {
                taskId,
                state: "fail",
                raw: info,
            };
        }
    }

    // Sau extended polling vẫn chưa xong -> trả về fail với message rõ ràng
    console.error(
        `Task ${taskId}: Extended polling timeout - task không hoàn thành sau ~160s`
    );
    const lastInfo = await getRecordInfo(taskId).catch(() => null);
    return {
        taskId,
        state: "fail",
        resultUrls: undefined,
        raw: lastInfo,
    };
}

export default generateMedia;
