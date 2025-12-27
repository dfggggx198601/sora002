import { getDB } from '../config/database';
import { PaymentPackage } from './Settings';

export interface IOrder {
    id: string;
    userId: string;
    packageId: string;
    packageSnapshot: PaymentPackage; // Snapshot price/quota in case settings change
    amount: number;
    status: 'pending' | 'paid' | 'cancelled';
    paymentMethod: 'alipay' | 'wechat' | 'epay' | 'manual';
    tradeNo?: string; // External transaction ID
    createdAt: Date;
    paidAt?: Date;
}

export class OrderModel {
    private static COLLECTION = 'orders';

    static async create(order: IOrder): Promise<IOrder> {
        const db = getDB();
        await db.collection(this.COLLECTION).doc(order.id).set({
            ...order,
            createdAt: order.createdAt || new Date()
        });
        return order;
    }

    static async findById(id: string): Promise<IOrder | null> {
        const db = getDB();
        const doc = await db.collection(this.COLLECTION).doc(id).get();
        if (!doc.exists) return null;
        return doc.data() as IOrder;
    }

    static async updateStatus(id: string, status: 'paid' | 'cancelled', tradeNo?: string): Promise<void> {
        const db = getDB();
        const updates: any = { status };
        if (tradeNo) updates.tradeNo = tradeNo;
        if (status === 'paid') updates.paidAt = new Date();

        await db.collection(this.COLLECTION).doc(id).update(updates);
    }

    static async getPendingOrders(): Promise<IOrder[]> {
        const db = getDB();
        const snapshot = await db.collection(this.COLLECTION)
            .where('status', '==', 'pending')
            .orderBy('createdAt', 'desc')
            .get();
        return snapshot.docs.map(doc => doc.data() as IOrder);
    }
}
