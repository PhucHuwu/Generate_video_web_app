# Generate Video Web App

A modern, AI-powered web application for generating videos from text prompts or images. Built with Next.js 16 and powered by multiple AI services including KIE AI, Google Gemini, and GROQ.

## Features

-   **Text-to-Video Generation**: Convert text prompts into engaging videos using AI
-   **Image-to-Video Generation**: Transform static images into dynamic video content
-   **AI-Powered Image Description**: Automatic image captioning using Google Gemini
-   **Chatbot Interface**: Interactive chat-based UI for seamless video generation
-   **Real-time Status Tracking**: Monitor your video generation progress in real-time
-   **Credit System**: Built-in credit management for video generation
-   **Secure Authentication**: Cookie-based authentication system
-   **API Documentation**: Comprehensive API documentation with Swagger UI (development mode)
-   **Dark Mode Support**: Beautiful UI with dark/light theme switching

## Tech Stack

### Frontend

-   **Framework**: [Next.js 16](https://nextjs.org/) (App Router)
-   **Language**: TypeScript
-   **UI Library**: React 19
-   **Styling**: Tailwind CSS 4
-   **Component Library**: [shadcn/ui](https://ui.shadcn.com/) (Radix UI)
-   **Icons**: Lucide React
-   **Form Handling**: React Hook Form + Zod validation
-   **Notifications**: Sonner

### Backend Services

-   **Video Generation**: [KIE AI](https://kie.ai)
-   **AI Image Description**: Google Gemini / OpenRouter
-   **Language Processing**: GROQ
-   **Image Storage**: Cloudinary
-   **API Documentation**: Swagger UI + OpenAPI 3.0

    **Note:** Image description uses Google Gemini as the primary service. `OpenRouter` is available as a fallback for image description when Gemini fails or is unavailable.

## Prerequisites

Before you begin, ensure you have the following installed:

-   **Node.js** 18.x or higher
-   **pnpm** (recommended) or npm/yarn
-   **Git**

You'll also need API keys from:

-   [KIE AI](https://kie.ai) - for video generation
-   [Google Cloud](https://console.developers.google.com) - for Gemini API
-   [Cloudinary](https://cloudinary.com) - for image uploads
-   [OpenRouter](https://openrouter.ai) - optional fallback for image description
-   [GROQ](https://www.sanity.io/manage) - for language processing (optional)

## Installation

1. **Clone the repository**

    ```bash
    git clone <repository-url>
    cd Generate_video_web_app
    ```

2. **Install dependencies**

    ```bash
    pnpm install
    # or
    npm install
    # or
    yarn install
    ```

3. **Set up environment variables**

    Copy the example environment file:

    ```bash
    cp .env.example .env
    ```

    Then edit `.env` with your actual API keys:

    ```env
    # KIE API Key for video generation
    KIE_API_KEY=your_kie_api_key_here

    # Cloudinary credentials for image upload
    CLOUDINARY_CLOUD_NAME=your_cloud_name
    CLOUDINARY_API_KEY=your_api_key
    CLOUDINARY_API_SECRET=your_api_secret

    # Google API Key for Gemini
    GEMINI_API_KEY=your_google_api_key_here

    # GROQ API Key (optional)
    GROQ_API_KEY=your_groq_api_key_here

    # Login credentials
    LOGIN_USER=your_username
    LOGIN_PASS=your_secure_password
    ```

## Usage

### Development Mode

Start the development server:

```bash
pnpm dev
# or
npm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

**Note**: In development mode, you can access:

-   **API Documentation**: http://localhost:3000/api/docs
-   **OpenAPI JSON**: http://localhost:3000/api/docs/openapi.json

### Production Mode

1. **Build the application**

    ```bash
    pnpm build
    ```

2. **Start the production server**
    ```bash
    pnpm start
    ```

**Note**: API documentation is automatically disabled in production for security.

## API Endpoints

The application provides the following REST API endpoints:

### Authentication

-   `POST /api/login` - User login
-   `POST /api/logout` - User logout
-   `GET /api/auth` - Check authentication status

### Video Generation

-   `POST /api/generate` - Generate video from text or image
-   `GET /api/generate/status` - Check video generation status
-   `GET /api/credits` - Get remaining credits

### Image Processing

-   `POST /api/describe` - Generate description for an image

For detailed API documentation with request/response examples, see:

-   [API Documentation (Vietnamese)](./api_doc.md)
-   [Text-to-Video API (Vietnamese)](./api_document_text_to_video.md)
-   [Image-to-Video API (Vietnamese)](./api_document_img_to_video.md)

Or visit `/api/docs` in development mode for interactive Swagger UI.

## Development

### Available Scripts

-   `pnpm dev` - Start development server
-   `pnpm build` - Build for production
-   `pnpm start` - Start production server
-   `pnpm lint` - Run ESLint

### Code Quality

This project uses:

-   **TypeScript** for type safety
-   **ESLint** for code linting
-   **Tailwind CSS** for consistent styling
-   **Zod** for runtime validation

### Environment Variables

| Variable                | Description                                       | Required                 |
| ----------------------- | ------------------------------------------------- | ------------------------ |
| `KIE_API_KEY`           | KIE AI API key for video generation               | Yes                      |
| `GEMINI_API_KEY`        | Google Gemini API key for image description       | Yes                      |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name                             | Yes (for image-to-video) |
| `CLOUDINARY_API_KEY`    | Cloudinary API key                                | Yes (for image-to-video) |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret                             | Yes (for image-to-video) |
| `GROQ_API_KEY`          | GROQ API key for language processing              | Optional                 |
| `LOGIN_USER`            | Username for authentication                       | Yes                      |
| `LOGIN_PASS`            | Password for authentication                       | Yes                      |
| `OPENROUTER_API_KEY`    | OpenRouter API key for image description fallback | Optional                 |

## Features in Detail

### Video Generation

-   Supports both text-to-video and image-to-video generation
-   Real-time progress tracking
-   Automatic retry mechanism
-   Credit-based usage system

### Image Description

-   AI-powered image captioning using Google Gemini
-   Support for public image URLs and base64 data URLs
-   Automatic image upload to Cloudinary
-   Optional GROQ integration for enhanced descriptions

-   Uses Google Gemini for primary image captioning; falls back to OpenRouter when Gemini errors or is unavailable.

### Authentication

-   Cookie-based session management
-   HTTP-only cookies for security
-   Protected API routes
-   Automatic session expiration

### API Security

-   CSRF protection
-   Rate limiting ready
-   Environment-based API documentation access
-   Secure credential storage

## Browser Support

-   Chrome (latest)
-   Firefox (latest)
-   Safari (latest)
-   Edge (latest)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is private and proprietary.

## Troubleshooting

### Common Issues

**Video generation fails:**

-   Check your KIE_API_KEY is valid
-   Ensure you have sufficient credits
-   Verify your internet connection

**Image upload fails:**

-   Verify Cloudinary credentials are correct
-   Check image size (max 10MB recommended)
-   Ensure image format is supported (JPEG, PNG, WebP)

**Authentication issues:**

-   Clear browser cookies and try again
-   Verify LOGIN_USER and LOGIN_PASS in .env
-   Check if session has expired

## Support

For issues and questions:

-   Review troubleshooting section above
-   Open an issue in the repository

---

**Built with** Next.js, React, and AI
