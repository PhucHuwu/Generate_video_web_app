# Generate Video Web App

Ứng dụng Next.js (Next 16) để tạo video từ prompt (văn bản) và/hoặc ảnh, với toàn bộ logic nghiệp vụ chạy ở phía server.

README này tóm tắt cấu trúc, cách chạy, API và những quy ước quan trọng khi phát triển hoặc triển khai.

## Tổng quan

-   Frontend (client): giao diện và gọi API (chỉ gọi `/api/*`).
    -   File chính UI chat: `frontend/chat-container.tsx` (client component).
-   Backend (server): mọi business logic, gọi KIE API, xử lý file, polling đều nằm trong `backend/` và các route API dưới `app/api/`.
    -   Tạo media & polling: `backend/generate-service.ts` (chứa `generateMedia`, `fetchTaskInfo`).
    -   API tạo media: `app/api/generate/route.ts`.
    -   API status (polling fallback): `app/api/generate/status/route.ts`.
    -   Ví dụ upload ảnh: `app/api/chat/route.ts` + `backend/chat-service.ts`.

## Các quy ước quan trọng

-   Frontend KHÔNG gọi trực tiếp tới KIE API hoặc dịch vụ bên thứ ba. Luôn gọi các route `/api/*` của Next.js.
-   Khi gửi ảnh từ client, gửi một trong hai giá trị:
    -   `imageBase64`: data URL (ví dụ `data:image/png;base64,...`) — backend sẽ lưu vào `public/uploads/` và trả URL công khai.
    -   `image_url`: URL công khai đến ảnh (server sẽ dùng trực tiếp).
-   Response lỗi chuẩn: trả JSON chứa trường `error` và HTTP status code tương ứng (400/500). Client sẽ parse `data.error`.
-   Polling mặc định (backend): 2s x 30 lần (~60s). Client có fallback gọi `/api/generate/status?taskId=...`.
-   Không commit API keys; dùng biến môi trường (ví dụ `KIE_API_KEY`).
-   Frontend giới hạn kích thước ảnh (ví dụ hiện tại: <5MB). Server có thể validate khi cần.

## Cài đặt & Chạy (Windows PowerShell)

1. Cài dependencies và chuẩn bị pnpm (PowerShell):

```powershell
corepack enable; corepack prepare pnpm@latest --activate; pnpm install
```

2. Tạo file môi trường (nếu có mẫu):

```powershell
copy .env.example .env.local
# hoặc tạo .env.local thủ công
```

3. Thiết lập biến môi trường quan trọng (ví dụ trong `.env.local`):

-   `KIE_API_KEY` — bắt buộc để gọi KIE API từ server.
-   (Tùy chọn) `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` nếu sử dụng Cloudinary cho upload.

4. Chạy dev server:

```powershell
pnpm dev
```

5. Build cho production:

```powershell
pnpm build
```

Mặc định ứng dụng mở tại http://localhost:3000

## API chính (ví dụ)

1. POST /api/generate

Request JSON body (ví dụ):

```json
{
    "prompt": "A calm sunset over mountains",
    "imageBase64": "data:image/png;base64,..." // hoặc "image_url": "https://..."
}
```

Response (success):

```json
{
    "taskId": "abc123",
    "state": "pending"
}
```

Response (error): HTTP 400/500

```json
{ "error": "Mô tả lỗi rõ ràng" }
```

2. GET /api/generate/status?taskId=abc123

Response:

```json
{
    "taskId": "abc123",
    "state": "succeeded|running|failed",
    "resultUrls": ["/uploads/video1.mp4"],
    "raw": {
        /* raw response từ KIE API nếu cần */
    }
}
```

3. Upload ảnh (ví dụ dùng trong chat): POST /api/chat

Body JSON: `imageBase64` hoặc `image_url`.
Server sẽ trả URL công khai (nếu lưu file vào `public/uploads/`).

## Cấu trúc tệp quan trọng

-   `frontend/chat-container.tsx` — UI chat và gọi API.
-   `backend/generate-service.ts` — chứa `generateMedia`, `fetchTaskInfo` và logic poll nội bộ.
-   `backend/chat-service.ts` — xử lý upload ảnh và các logic chat.
-   `app/api/generate/route.ts` — route tạo tác vụ (entrypoint client gọi).
-   `app/api/generate/status/route.ts` — route kiểm tra trạng thái tác vụ.
-   `app/api/chat/route.ts` — ví dụ upload ảnh từ client.

## Vấn đề thường gặp & lưu ý

-   KIE API key bắt buộc cho backend; nếu thiếu, `generate-service` sẽ throw.
-   Nếu thay đổi shape response backend, nhớ cập nhật cả `app/api/generate/route.ts` và client (`frontend/chat-container.tsx`) vì client dựa vào `taskId`, `state`, `resultUrls`.
-   Frontend chỉ gửi `imageBase64` hoặc `image_url` — không gửi `multipart/form-data` vào các route này.

## Testing / Development tips

-   Khi phát triển, mở DevTools Network để theo dõi các request tới `/api/generate` và `/api/generate/status`.
-   Để debug KIE API calls, in `raw` response trong `generate-service` (chỉ local, KHÔNG log API keys).

## Triển khai

-   Đảm bảo biến môi trường (`KIE_API_KEY`, credentials upload) được cấu hình trên server host.
-   Tối ưu: bật CDN cho `public/uploads` nếu lưu nhiều file lớn.

## Đóng góp

Vui lòng tạo Pull Request trên branch `main`. Nếu bạn muốn mở rộng tính năng (ví dụ: thêm model, tăng timeout polling, thêm tests), hãy mô tả rõ thay đổi trong PR.

## Simple login page

This repository includes a minimal login page available at `/login` which checks credentials against environment variables.

-   Server API: `POST /api/login` — expects JSON { "username": string, "password": string }.
-   Env variables (set them in your `.env.local` or `.ENV` as used in this repo): `LOGIN_USER` and `LOGIN_PASS`.
-   On success the API returns `{ ok: true }` and the client redirects to `/`.

Example (in `.env.local` or `.ENV`):

```
LOGIN_USER=admin
LOGIN_PASS=admin123
```

## **API Docs**

-   **Path**: `public/swagger/index.html` (bật dev server và mở `http://localhost:3000/swagger` hoặc `http://localhost:3000/swagger/index.html`).
-   **Spec**: `public/openapi.json` chứa OpenAPI (minimal) cho các endpoint chính: `/api/describe`, `/api/generate`, `/api/credits`.
-   **Usage**: Mở trang, chọn endpoint, điền body (JSON) và gửi thử để kiểm tra response nhanh.

Lưu ý: một vài endpoint yêu cầu API key (ví dụ KIE API key) được cấu hình trên server để hoạt động đúng — nếu thiếu, API sẽ trả lỗi tương ứng.

Change those to whatever values you want. This login is intentionally minimal (no sessions/cookies) — it's just a simple credential check for local/demo purposes.
