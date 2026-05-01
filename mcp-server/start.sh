#!/bin/bash
# StoryMuse MCP Server 启动脚本

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
  echo "❌ Node.js 未安装，请先安装 Node.js 18+ 版本"
  exit 1
fi

# 检查依赖是否安装
if [ ! -d "node_modules" ]; then
  echo "📦 正在安装依赖..."
  npm install --production
fi

# 编译TypeScript
if [ ! -d "dist" ]; then
  echo "🔨 正在编译代码..."
  npm run build
fi

# 启动服务
echo "🚀 启动 StoryMuse MCP Server..."
exec npm start
