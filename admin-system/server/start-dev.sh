#!/bin/bash

# ProtoChat Admin System API Server 启动脚本

echo "🚀 启动 ProtoChat 后台管理系统 API 服务器..."

# 检查是否安装了依赖
if [ ! -d "node_modules" ]; then
    echo "📦 正在安装依赖..."
    npm install
fi

# 创建数据库表（如果不存在）
echo "🗄️ 检查数据库连接..."

# 启动开发服务器
echo "▶️ 启动开发服务器..."
npm run dev