import { getDB } from '../config/database';

const updateAdminUser = async () => {
  try {
    const db = await getDB();
    
    // 查找用户并更新角色为管理员
    const usersSnapshot = await db.collection('users')
      .where('email', '==', 'admin@sora.studio')
      .limit(1)
      .get();
    
    if (usersSnapshot.empty) {
      console.log('❌ Admin user not found');
      return;
    }
    
    const userDoc = usersSnapshot.docs[0];
    await userDoc.ref.update({
      role: 'admin'
    });
    
    console.log('✅ User updated to admin role successfully');
    console.log('User ID:', userDoc.id);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating user:', error);
    process.exit(1);
  }
};

updateAdminUser();