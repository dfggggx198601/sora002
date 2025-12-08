import { CustomApiConfig } from "./types";

export const DEFAULT_CUSTOM_CONFIG: CustomApiConfig = {
  baseUrl: "https://sora2api-584967513363.us-west1.run.app/v1",
  apiKey: "han1234",
  endpointPath: "/chat/completions"
};

export const MOCK_IMAGES = [
  "https://picsum.photos/400/300",
  "https://picsum.photos/400/301",
  "https://picsum.photos/400/302"
];