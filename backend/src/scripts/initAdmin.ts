import bcrypt from 'bcryptjs';
import { UserModel } from '../models/User';
import { getDB } from '../config/database';

const initializeAdminUser = async () => {
  try {
    // 连接数据库
    const db = await getDB();
    console.log('✅ Connected to Firestore');
    
    // 检查是否已存在管理员账户
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const adminUsername = process.env.ADMIN_USERNAME || 'Administrator';
    
    const existingAdmin = await UserModel.findByEmail(adminEmail);
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists');
      return;
    }
    
    // 创建管理员账户
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    
    const adminUser = await UserModel.create({
      email: adminEmail,
      password: hashedPassword,
      username: adminUsername,
      role: 'admin',
      createdAt: new Date(),
      quota: {
        dailyVideoLimit: 100,
        dailyImageLimit: 500,
        videoCount: 0,
        imageCount: 0,
        lastReset: new Date(),
      },
    });
    
    console.log('✅ Admin user created successfully');
    console.log('📧 Email:', adminEmail);
    console.log('🔑 Password:', adminPassword);
    console.log('👤 Username:', adminUsername);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
};

initializeAdminUser();