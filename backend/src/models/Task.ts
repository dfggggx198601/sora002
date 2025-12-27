import { getDB } from '../config/database';
import { Timestamp } from '@google-cloud/firestore';

export interface ITask {
  id?: string;  // Firestore document ID
  userId: string;
  type: 'VIDEO' | 'IMAGE';
  status: 'GENERATING' | 'COMPLETED' | 'FAILED';
  prompt: string;
  modelName: string;
  createdAt: Date;
  completedAt?: Date;
  videoUrl?: string;
  imageUrl?: string;
  imagePreviewUrl?: string;
  error?: string;
  messages?: any[]; // Store chat messages
}

export class TaskModel {
  private static COLLECTION = 'tasks';

  // 创建任务
  static async create(taskData: Omit<ITask, 'id'>): Promise<ITask> {
    const db = getDB();
    const docRef = await db.collection(this.COLLECTION).add({
      ...taskData,
      createdAt: Timestamp.fromDate(taskData.createdAt),
      completedAt: taskData.completedAt ? Timestamp.fromDate(taskData.completedAt) : null,
    });

    return { ...taskData, id: docRef.id };
  }

  // 根据 ID 查找任务
  static async findById(id: string): Promise<ITask | null> {
    const db = getDB();
    const doc = await db.collection(this.COLLECTION).doc(id).get();

    if (!doc.exists) return null;

    const data = doc.data()!;
    return this.docToTask(doc.id, data);
  }

  // 查找用户的所有任务
  static async findByUserId(userId: string): Promise<ITask[]> {
    const db = getDB();
    const snapshot = await db.collection(this.COLLECTION)
      .where('userId', '==', userId)
      .get();

    const tasks = snapshot.docs.map(doc => this.docToTask(doc.id, doc.data()));
    // 按创建时间倒序排序 (内存排序，避免需要复合索引)
    return tasks.sort((a: ITask, b: ITask) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // 按条件查询任务
  static async findByUserIdAndStatus(userId: string, status: string): Promise<ITask[]> {
    const db = getDB();
    const snapshot = await db.collection(this.COLLECTION)
      .where('userId', '==', userId)
      .where('status', '==', status)
      .get();

    const tasks = snapshot.docs.map(doc => this.docToTask(doc.id, doc.data()));
    return tasks.sort((a: ITask, b: ITask) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // 按时间范围查询（用于同步）
  static async findByUserIdSince(userId: string, since: Date): Promise<ITask[]> {
    const db = getDB();
    const snapshot = await db.collection(this.COLLECTION)
      .where('userId', '==', userId)
      .where('createdAt', '>=', Timestamp.fromDate(since))
      .get();

    const tasks = snapshot.docs.map(doc => this.docToTask(doc.id, doc.data()));
    return tasks.sort((a: ITask, b: ITask) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  // 更新任务
  static async update(id: string, updates: Partial<ITask>): Promise<void> {
    const db = getDB();
    const updateData: any = { ...updates };

    // 转换日期为 Timestamp
    if (updateData.createdAt) {
      updateData.createdAt = Timestamp.fromDate(updateData.createdAt);
    }
    if (updateData.completedAt) {
      updateData.completedAt = Timestamp.fromDate(updateData.completedAt);
    }

    await db.collection(this.COLLECTION).doc(id).update(updateData);
  }

  // 删除任务
  static async delete(id: string): Promise<void> {
    const db = getDB();
    await db.collection(this.COLLECTION).doc(id).delete();
  }

  // 清空用户所有任务
  static async clearAllByUserId(userId: string): Promise<void> {
    const db = getDB();
    const snapshot = await db.collection(this.COLLECTION)
      .where('userId', '==', userId)
      .get();

    if (snapshot.empty) return;

    const batch = db.batch();
    snapshot.docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  }

  // 批量创建任务
  static async createMany(tasks: Omit<ITask, 'id'>[]): Promise<ITask[]> {
    const db = getDB();
    const batch = db.batch();
    const results: ITask[] = [];

    for (const taskData of tasks) {
      const docRef = db.collection(this.COLLECTION).doc();
      batch.set(docRef, {
        ...taskData,
        createdAt: Timestamp.fromDate(taskData.createdAt),
        completedAt: taskData.completedAt ? Timestamp.fromDate(taskData.completedAt) : null,
      });
      results.push({ ...taskData, id: docRef.id });
    }

    await batch.commit();
    return results;
  }

  // 辅助函数：将 Firestore 文档转换为 Task 对象
  private static docToTask(id: string, data: any): ITask {
    // 鲁棒性防御：处理可能的日期解析失败
    let createdAt: Date;
    try {
      if (data.createdAt && typeof data.createdAt.toDate === 'function') {
        createdAt = data.createdAt.toDate();
      } else if (data.createdAt instanceof Date) {
        createdAt = data.createdAt;
      } else if (typeof data.createdAt === 'number') {
        createdAt = new Date(data.createdAt);
      } else {
        createdAt = new Date(); // 回退
      }
    } catch (e: any) {
      createdAt = new Date();
    }

    let completedAt: Date | undefined;
    if (data.completedAt) {
      try {
        if (typeof data.completedAt.toDate === 'function') {
          completedAt = data.completedAt.toDate();
        } else if (data.completedAt instanceof Date) {
          completedAt = data.completedAt;
        } else if (typeof data.completedAt === 'number') {
          completedAt = new Date(data.completedAt);
        }
      } catch (e: any) {
        // ignore
      }
    }

    return {
      id,
      userId: data.userId,
      type: data.type,
      status: data.status,
      prompt: data.prompt,
      modelName: data.modelName,
      createdAt,
      completedAt,
      videoUrl: data.videoUrl,
      imageUrl: data.imageUrl,
      imagePreviewUrl: data.imagePreviewUrl,
      error: data.error,
      messages: data.messages,
    };
  }
}
