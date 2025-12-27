import { getDB } from '../config/database';
import { Timestamp } from '@google-cloud/firestore';

export interface IUser {
  id?: string;  // Firestore document ID
  email: string;
  password: string;
  username: string;
  role: 'user' | 'admin';  // 添加角色字段
  createdAt: Date;
  lastLogin?: Date;
  quota: {
    dailyVideoLimit: number;
    dailyImageLimit: number;
    dailyChatLimit: number; // Add chat limit
    videoCount: number;
    imageCount: number;
    chatCount: number; // Add chat count
    lastReset: Date;
  };
  status?: 'active' | 'banned'; // Add status field
}

export class UserModel {
  private static COLLECTION = 'users';

  // 创建用户
  static async create(userData: Omit<IUser, 'id'>): Promise<IUser> {
    const db = getDB();
    const docRef = await db.collection(this.COLLECTION).add({
      ...userData,
      createdAt: Timestamp.fromDate(userData.createdAt),
      lastLogin: userData.lastLogin ? Timestamp.fromDate(userData.lastLogin) : null,
      quota: {
        ...userData.quota,
        lastReset: Timestamp.fromDate(userData.quota.lastReset),
      },
    });

    return { ...userData, id: docRef.id };
  }

  // 辅助函数：安全地转换 FirestoreTimestamp
  private static toDateSafe(val: any): Date {
    if (!val) return new Date();
    if (typeof val.toDate === 'function') {
      return val.toDate();
    }
    if (typeof val === 'string' || typeof val === 'number') {
      return new Date(val);
    }
    if (val instanceof Date) {
      return val;
    }
    return new Date();
  }

  // 根据邮箱查找用户
  static async findByEmail(email: string): Promise<IUser | null> {
    const db = getDB();
    const snapshot = await db.collection(this.COLLECTION)
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const data = doc.data();

    // Safe Quota Handling
    const q = data.quota || {};

    return {
      id: doc.id,
      email: data.email,
      password: data.password,
      username: data.username,
      role: data.role || 'user',
      createdAt: this.toDateSafe(data.createdAt),
      lastLogin: data.lastLogin ? this.toDateSafe(data.lastLogin) : undefined,
      quota: {
        dailyVideoLimit: q.dailyVideoLimit || 10,
        dailyImageLimit: q.dailyImageLimit || 50,
        dailyChatLimit: q.dailyChatLimit || 50,
        videoCount: q.videoCount || 0,
        imageCount: q.imageCount || 0,
        chatCount: q.chatCount || 0,
        lastReset: this.toDateSafe(q.lastReset),
      },
      status: data.status || 'active',
    };
  }

  // 根据 ID 查找用户
  static async findById(id: string): Promise<IUser | null> {
    const db = getDB();
    const doc = await db.collection(this.COLLECTION).doc(id).get();

    if (!doc.exists) return null;

    const data = doc.data()!;
    const q = data.quota || {};

    return {
      id: doc.id,
      email: data.email,
      password: data.password,
      username: data.username,
      role: data.role || 'user',
      createdAt: this.toDateSafe(data.createdAt),
      lastLogin: data.lastLogin ? this.toDateSafe(data.lastLogin) : undefined,
      quota: {
        dailyVideoLimit: q.dailyVideoLimit || 10,
        dailyImageLimit: q.dailyImageLimit || 50,
        dailyChatLimit: q.dailyChatLimit || 50,
        videoCount: q.videoCount || 0,
        imageCount: q.imageCount || 0,
        chatCount: q.chatCount || 0,
        lastReset: this.toDateSafe(q.lastReset),
      },
      status: data.status || 'active',
    };
  }

  // 更新用户
  static async update(id: string, updates: Partial<IUser>): Promise<void> {
    const db = getDB();
    const updateData: any = { ...updates };

    // 转换日期为 Timestamp
    if (updateData.createdAt) {
      updateData.createdAt = Timestamp.fromDate(updateData.createdAt);
    }
    if (updateData.lastLogin) {
      updateData.lastLogin = Timestamp.fromDate(updateData.lastLogin);
    }
    if (updateData.quota?.lastReset) {
      updateData.quota.lastReset = Timestamp.fromDate(updateData.quota.lastReset);
    }

    await db.collection(this.COLLECTION).doc(id).update(updateData);
  }

  // 删除用户
  static async delete(id: string): Promise<void> {
    const db = getDB();
    await db.collection(this.COLLECTION).doc(id).delete();
  }
}
