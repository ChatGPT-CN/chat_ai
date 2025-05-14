# Kimi-Clone Web Application

This project is a web application similar to Kimi.moonshot.cn, built with Next.js. It supports multiple AI provider integrations, custom API configurations, and a multilingual user interface.

## Features

- **Chat Interface**: Modern and responsive chat UI.
- **Session Management**: Create new chat sessions and switch between them. Conversation history is stored locally.
- **Multi-Language Support**: UI translated into Chinese (zh), English (en), Korean (ko), Japanese (ja), French (fr), German (de), and Russian (ru). Language can be switched dynamically.
- **Multiple AI Provider Support**:
    - Pre-configured support for DeepSeek, OpenAI, Anthropic, and Gemini.
    - Users can enter their API keys for these services in the settings panel.
- **Custom API Extension**:
    - Users can define and add their own compatible AI API configurations.
    - Configuration includes API Name, Endpoint URL, API Key, API Key Header Name, API Key Prefix, Model Parameter Name, Messages Parameter Name, and Response Path for extracting the AI's message.
- **API Key Management**: API keys for both pre-configured and custom services are stored locally in the browser's localStorage.

## Project Structure

- `src/pages/`: Contains the main application pages (e.g., `index.tsx` for the chat interface).
- `src/components/`: Reusable React components (if any were explicitly created outside of the main page structure).
- `src/contexts/AppContext.tsx`: Manages global application state, including sessions, API keys, and custom API configurations.
- `src/app/api/chat/route.ts`: Backend API route that proxies requests to the selected AI provider (pre-configured or custom).
- `public/locales/`: Contains JSON files for i18n translations for each supported language.
- `next.config.js`: Next.js configuration file, including i18n settings.
- `next-i18next.config.js`: Configuration for `next-i18next`.
- `todo.md`: Task checklist used during development.

## Getting Started (Development)

1.  **Prerequisites**:
    *   Node.js (version 20.x or later recommended)
    *   pnpm (or npm/yarn)

2.  **Clone the repository (or extract the provided source code archive).**

3.  **Navigate to the project directory**:
    ```bash
    cd kimi_clone
    ```

4.  **Install dependencies**:
    ```bash
    pnpm install
    ```

5.  **Run the development server**:
    ```bash
    pnpm dev
    ```
    The application will typically be available at `http://localhost:3000`.

## Configuration

- **API Keys**: API keys for AI services (DeepSeek, OpenAI, Anthropic, Gemini, and custom APIs) must be configured through the application's settings panel. These keys are stored in the browser's localStorage.

## Deployment

This Next.js application can be deployed to any platform that supports Next.js (e.g., Vercel, Netlify, AWS Amplify, or a custom Node.js server).

1.  **Build the application**:
    ```bash
    pnpm build
    ```

2.  **Start the production server**:
    ```bash
    pnpm start
    ```

For static site generation (if applicable to all pages, though dynamic API routes require a server):
```bash
pnpm next export
```
However, given the API routes for AI interaction, a Node.js environment is required for full functionality.

## Notes

- **Replicate.com and OpenRouter.ai**: While placeholders for these services exist in the UI and context, the specific backend API call functions (`callReplicateAPI`, `callOpenRouterAPI`) in `src/app/api/chat/route.ts` were not fully implemented in this phase. Users can leverage the "Custom API" feature to configure these or similar services if their API structure is compatible.
- **Title Tag Warning**: During development, a React warning related to the `<title>` tag's children was observed in the browser console: `React expects the 'children' prop of <title> tags to be a string... but found an Array...`. This is a minor issue and does not affect functionality but can be optimized by ensuring the content of the `<title>` tag in `src/pages/index.tsx` resolves to a single string (e.g., using template literals if dynamic content is involved).

This README provides a basic overview. Further customization and enhancements can be made as needed.

