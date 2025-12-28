import { CustomApiConfig } from "./types";

export const DEFAULT_CUSTOM_CONFIG: CustomApiConfig = {
  baseUrl: "https://sora2api-584967513363.us-west1.run.app/v1",
  apiKey: "han1234",
  endpointPath: "/chat/completions"
};

// Cloud Run Fallback Configuration
export const DEFAULT_GOOGLE_CONFIG = {
  apiKey: "", // 请在 Admin Settings 中配置 API Key
  baseUrl: "" // 默认为空，使用 Google 官方地址。如有需要可填 https://proxy...
};

export const MOCK_IMAGES = [
  "https://picsum.photos/400/300",
  "https://picsum.photos/400/301",
  "https://picsum.photos/400/302"
];