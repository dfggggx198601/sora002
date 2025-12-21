import { Storage } from '@google-cloud/storage';
import axios from 'axios';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID || 'genvideo-sora',
});

const bucketName = process.env.GCS_BUCKET_NAME || `${process.env.GCP_PROJECT_ID || 'genvideo-sora'}-assets`;
const bucket = storage.bucket(bucketName);

export class StorageService {
    /**
     * 从 URL 下载并上传到 GCS
     */
    static async uploadFromUrl(url: string, prefix: string = 'videos'): Promise<string> {
        try {
            console.log(`[Storage] Downloading from URL: ${url}`);
            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'arraybuffer',
                timeout: 30000, // 30s timeout
            });

            const contentType = response.headers['content-type'] || 'video/mp4';
            const ext = path.extname(new URL(url).pathname) || (contentType.includes('video') ? '.mp4' : '.jpg');
            const filename = `${prefix}/${uuidv4()}${ext}`;

            const file = bucket.file(filename);
            await file.save(response.data, {
                metadata: { contentType },
                resumable: false,
            });

            // 设置为公共可读 (或者你可以使用签名 URL，但为了简单这里设为公共)
            // 在生产环境中，建议使用更好的权限控制
            // await file.makePublic(); 

            // 返回 GCS URL (由于是私有的或需要身份验证，返回特定的存储 URI 或者后续由后端生成签名 URL)
            // 这里我们为了演示，假设 bucket 已经配置为公共可读，或者返回一个可以被后端识别的标识符
            // 实际上，为了安全，我们通常返回 https://storage.googleapis.com/BUCKET/FILE
            return `https://storage.googleapis.com/${bucketName}/${filename}`;
        } catch (error) {
            console.error('[Storage] Upload error:', error);
            throw new Error(`Failed to upload to Cloud Storage: ${error}`);
        }
    }

    /**
     * 从 Base64 上传到 GCS (主要用于图片)
     */
    static async uploadFromBase64(base64Data: string, prefix: string = 'images'): Promise<string> {
        try {
            // data:image/jpeg;base64,xxxx
            const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                throw new Error('Invalid base64 string');
            }

            const contentType = matches[1];
            const buffer = Buffer.from(matches[2], 'base64');
            const ext = contentType.includes('png') ? '.png' : '.jpg';
            const filename = `${prefix}/${uuidv4()}${ext}`;

            const file = bucket.file(filename);
            await file.save(buffer, {
                metadata: { contentType },
                resumable: false,
            });

            return `https://storage.googleapis.com/${bucketName}/${filename}`;
        } catch (error) {
            console.error('[Storage] Base64 upload error:', error);
            throw new Error(`Failed to upload base64 to Cloud Storage: ${error}`);
        }
    }
}
