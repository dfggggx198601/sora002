import { Firestore } from '@google-cloud/firestore';

let db: Firestore;

const connectDB = async (): Promise<Firestore> => {
  try {
    // Firestore 会自动使用 Google Cloud 环境的凭证
    db = new Firestore({
      projectId: process.env.GCP_PROJECT_ID || 'genvideo-sora',
      ignoreUndefinedProperties: true, // 忽略 undefined 字段，防止报错
      // Cloud Run 上会自动使用服务账号认证
    });

    console.log('✅ Firestore connected successfully');
    console.log(`📁 Project: ${process.env.GCP_PROJECT_ID || 'genvideo-sora'}`);

    return db;
  } catch (error) {
    console.error('❌ Firestore connection failed:', error);
    throw error;
  }
};

export const getDB = (): Firestore => {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB first.');
  }
  return db;
};

export default connectDB;
