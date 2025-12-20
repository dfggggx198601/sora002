// Global type definitions for the app

interface ImportMeta {
  env: {
    VITE_API_URL?: string;
    [key: string]: string | undefined;
  };
}

interface AIStudio {
  hasSelectedApiKey(): Promise<boolean>;
  openSelectKey(): Promise<void>;
}

interface Window {
  aistudio?: AIStudio;
}

declare namespace NodeJS {
  interface ProcessEnv {
    API_KEY?: string;
    [key: string]: string | undefined;
  }
}

declare var process: {
  env: {
    API_KEY?: string;
    [key: string]: string | undefined;
  };
};
