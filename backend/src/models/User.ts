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
    videoCount: number;
    imageCount: number;
    lastReset: Date;
  };
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
    
    return {
      id: doc.id,
      email: data.email,
      password: data.password,
      username: data.username,
      role: data.role || 'user',  // 默认为普通用户
      createdAt: data.createdAt.toDate(),
      lastLogin: data.lastLogin?.toDate(),
      quota: {
        dailyVideoLimit: data.quota.dailyVideoLimit,
        dailyImageLimit: data.quota.dailyImageLimit,
        videoCount: data.quota.videoCount,
        imageCount: data.quota.imageCount,
        lastReset: data.quota.lastReset.toDate(),
      },
    };
  }

  // 根据 ID 查找用户
  static async findById(id: string): Promise<IUser | null> {
    const db = getDB();
    const doc = await db.collection(this.COLLECTION).doc(id).get();
    
    if (!doc.exists) return null;
    
    const data = doc.data()!;
    return {
      id: doc.id,
      email: data.email,
      password: data.password,
      username: data.username,
      role: data.role || 'user',  // 默认为普通用户
      createdAt: data.createdAt.toDate(),
      lastLogin: data.lastLogin?.toDate(),
      quota: {
        dailyVideoLimit: data.quota.dailyVideoLimit,
        dailyImageLimit: data.quota.dailyImageLimit,
        videoCount: data.quota.videoCount,
        imageCount: data.quota.imageCount,
        lastReset: data.quota.lastReset.toDate(),
      },
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
