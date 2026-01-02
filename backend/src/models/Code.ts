import db from '../config/database';

export interface ICode {
    code: string;
    type: 'quota' | 'invite';
    value: number; // quota amount
    used: boolean;
    usedBy?: string;
    usedAt?: Date;
}

const COLLECTION = 'codes';

class CodeModel {
    static async findOne(query: { code: string }): Promise<ICode | null> {
        const snapshot = await db.collection(COLLECTION)
            .where('code', '==', query.code)
            .limit(1)
            .get();

        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        return { ...doc.data() } as ICode;
    }

    static async updateOne(query: { code: string }, update: any) {
        // Assuming query is unique code. Firestore specific update needs doc ID.
        // We must find the doc ID first.
        const snapshot = await db.collection(COLLECTION).where('code', '==', query.code).limit(1).get();
        if (snapshot.empty) return;

        const docId = snapshot.docs[0].id;
        const data = update.$set || update;
        await db.collection(COLLECTION).doc(docId).set(data, { merge: true });
    }

    // Helper to create code
    static async create(data: ICode) {
        await db.collection(COLLECTION).add(data);
    }
}

export default CodeModel;
