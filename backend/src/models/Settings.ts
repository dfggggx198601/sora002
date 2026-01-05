import { getDB } from '../config/database';

export interface PaymentPackage {
    id: string;
    name: string;
    price: number;
    videoIncrease: number;
    imageIncrease: number;
    chatIncrease: number;
}

export interface ISettings {
    announcement: {
        message: string;
        enabled: boolean;
        type: 'info' | 'warning' | 'error';
    };
    maintenanceMode: boolean;
    initialQuota?: {
        dailyVideoLimit: number;
        dailyImageLimit: number;
        dailyChatLimit: number;
    };
    paymentPackages?: PaymentPackage[];
    paymentConfig?: {
        enabled: boolean;
        provider: 'manual' | 'epay';       // manual=人工审核, epay=易支付/码支付
        // Manual Config
        manualQrCodeUrl: string;           // 收款码图片地址
        // Epay Config
        epayApiUrl: string;
        epayPid: string;
        epayKey: string;
    };
    aiConfig?: {
        googleKeys: string[];  // Array of API Keys for rotation
        baseUrl?: string;      // Custom API Endpoint
        enabled: boolean;
        soraBaseUrl?: string; // Sora2API Endpoint
        soraApiKey?: string;  // Sora2API Key
    };
    updatedAt: Date;
}

export class SettingsModel {
    private static COLLECTION = 'settings';
    private static DOC_ID = 'global';

    static async getSettings(): Promise<ISettings> {
        const db = getDB();
        const doc = await db.collection(this.COLLECTION).doc(this.DOC_ID).get();

        const defaultSettings: ISettings = {
            announcement: { message: '', enabled: false, type: 'info' },
            maintenanceMode: false,
            initialQuota: {
                dailyVideoLimit: 10,
                dailyImageLimit: 50,
                dailyChatLimit: 50
            },
            paymentPackages: [],
            updatedAt: new Date()
        };

        if (!doc.exists) {
            return defaultSettings;
        }

        const data = doc.data()!;
        return {
            announcement: { ...defaultSettings.announcement, ...(data.announcement || {}) },
            maintenanceMode: data.maintenanceMode !== undefined ? data.maintenanceMode : defaultSettings.maintenanceMode,
            initialQuota: { ...defaultSettings.initialQuota!, ...(data.initialQuota || {}) },
            paymentPackages: data.paymentPackages || [],
            paymentConfig: {
                enabled: data.paymentConfig?.enabled || false,
                provider: data.paymentConfig?.provider || 'manual',
                manualQrCodeUrl: data.paymentConfig?.manualQrCodeUrl || '',
                epayApiUrl: data.paymentConfig?.epayApiUrl || '',
                epayPid: data.paymentConfig?.epayPid || '',
                epayKey: data.paymentConfig?.epayKey || ''
            },
            updatedAt: data.updatedAt ? data.updatedAt.toDate() : new Date(),
            aiConfig: {
                googleKeys: data.aiConfig?.googleKeys || [],
                baseUrl: data.aiConfig?.baseUrl || '',
                enabled: data.aiConfig?.enabled || false,
                soraBaseUrl: data.aiConfig?.soraBaseUrl || 'https://sora2api-584967513363.us-west1.run.app/v1',
                soraApiKey: data.aiConfig?.soraApiKey || 'han1234'
            }
        };
    }

    static async updateSettings(settings: Partial<ISettings>): Promise<void> {
        const db = getDB();
        const docRef = db.collection(this.COLLECTION).doc(this.DOC_ID);

        // 1. Get current data (or defaults if not exists)
        // We reuse getSettings() logic but need to avoid circular depending if we call getSettings here? 
        // Actually getSettings is static, so we can call it, but let's just do raw read to be safe and raw atomic update.
        // Better: Use a transaction or simply read-merge-write since traffic is low.

        const currentData = await this.getSettings();

        // 2. Deep Merge in Memory
        const mergedSettings: ISettings = {
            ...currentData,
            ...settings,
            // Handle nested objects specific merging
            announcement: {
                ...currentData.announcement,
                ...settings.announcement
            },
            initialQuota: {
                ...currentData.initialQuota!,
                ...settings.initialQuota
            },
            // Payment Packages is an array, usually replaced entirely, but let's be careful
            paymentPackages: settings.paymentPackages || currentData.paymentPackages || [],
            paymentConfig: {
                ...currentData.paymentConfig!,
                ...(settings.paymentConfig || {})
            },
            aiConfig: {
                googleKeys: settings.aiConfig?.googleKeys || currentData.aiConfig?.googleKeys || [],
                baseUrl: settings.aiConfig?.baseUrl !== undefined ? settings.aiConfig.baseUrl : (currentData.aiConfig?.baseUrl || ''),
                enabled: settings.aiConfig?.enabled !== undefined ? settings.aiConfig.enabled : (currentData.aiConfig?.enabled || false),
                soraBaseUrl: settings.aiConfig?.soraBaseUrl !== undefined ? settings.aiConfig.soraBaseUrl : (currentData.aiConfig?.soraBaseUrl || 'https://sora2api-584967513363.us-west1.run.app/v1'),
                soraApiKey: settings.aiConfig?.soraApiKey !== undefined ? settings.aiConfig.soraApiKey : (currentData.aiConfig?.soraApiKey || 'han1234')
            },
            updatedAt: new Date()
        };

        // 3. Write Full Object back
        await docRef.set(mergedSettings);
    }
}
