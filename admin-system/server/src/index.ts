import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'node:http';

// 导入路由
import authRoutes from './routes/auth';
import authCasdoorRoutes from './routes/auth-casdoor';
import adminRoutes from './routes/admin';
import statsRouter from './routes/stats';
import aiProvidersRouter from './routes/ai-providers';
import adminPlansRoutes from './routes/plans';
import adminPricingRoutes from './routes/pricing';
import userRoutes from './routes/users-simplified';
import dashboardRoutes from './routes/dashboard';
import subscriptionRoutes from './routes/subscriptions';

// 加载环境变量
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 8002;

// 安全中间件
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS配置
const corsOptions = {
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  origin: process.env.CORS_ORIGIN || 'http://localhost:8001',
};

app.use(cors(corsOptions));

// 解析JSON请求体
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 请求日志中间件
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    environment: process.env.NODE_ENV,
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API路由
app.use('/api/auth', authRoutes);
app.use('/api/auth/casdoor', authCasdoorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin/stats', statsRouter);
app.use('/api/admin/ai-providers', aiProvidersRouter);
app.use('/api/admin/plans', adminPlansRoutes);
app.use('/api/admin/models/pricing', adminPricingRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin/subscriptions', subscriptionRoutes);

// 404处理
app.use((req, res) => {
  res.status(404).json({
    message: 'API端点不存在',
    path: req.path,
    success: false,
  });
});

// 全局错误处理
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Global error handler:', err);

  res.status(err.status || 500).json({
    message: err.message || '服务器内部错误',
    success: false,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// 启动服务器
server.listen(PORT, () => {
  console.log('🚀 ProtoChat Admin API Server 启动成功!');
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`🏥 健康检查: http://localhost:${PORT}/health`);
  console.log(`📚 API文档: http://localhost:${PORT}/api`);
  console.log(`🌍 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⚡ 时间: ${new Date().toISOString()}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;