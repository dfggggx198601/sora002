import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import connectDB, { getDB } from './config/database';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import adminRoutes from './routes/admin';
import settingsRoutes from './routes/settings';
import aiRoutes from './routes/ai';

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(helmet()); // 安全头
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow configured origin or any Cloud Run URL (for multiple URL formats)
    const configuredOrigin = process.env.CORS_ORIGIN;
    // Fix: If env is '*', allow all (logic was previously strict equality)
    if (configuredOrigin === '*' || origin === configuredOrigin || origin.endsWith('.run.app') || origin.includes('localhost')) {
      return callback(null, true);
    }

    console.warn(`Blocked by CORS: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(compression()); // 响应压缩
app.use(morgan('dev')); // 日志
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// 临时管理端点 - 用于更新用户角色为管理员
app.get('/admin/init', async (req, res) => {
  try {
    const db = await getDB();

    // 查找用户并更新角色为管理员
    const usersSnapshot = await db.collection('users')
      .where('email', '==', 'admin@sora.studio')
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      return res.status(404).json({ error: 'Admin user not found' });
    }

    const userDoc = usersSnapshot.docs[0];
    await userDoc.ref.update({
      role: 'admin'
    });

    res.json({ message: 'User updated to admin role successfully', userId: userDoc.id });
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// API 路由
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/ai', aiRoutes);

// 错误处理
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// 启动服务器
const startServer = async () => {
  try {
    // 连接数据库
    await connectDB();

    // 启动服务器
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🌐 CORS Origin: ${process.env.CORS_ORIGIN || '*'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server gracefully');
  process.exit(0);
});

startServer();
