#!/bin/bash
# StoryMuse 插件打包脚本

set -e

# 获取版本号
VERSION=$(grep '"version"' .claude-plugin/plugin.json | sed -E 's/.*"([0-9.]+)".*/\1/')
OUTPUT_FILE="story-muse-v${VERSION}.zip"

echo "📦 正在打包 StoryMuse v${VERSION}..."

# 编译MCP服务
echo "🔨 编译MCP服务..."
cd mcp-server
npm install --production
npm run build
cd ..

# 清理不需要的文件
echo "🧹 清理临时文件..."
rm -rf mcp-server/node_modules/.cache
rm -rf mcp-server/src
rm -rf mcp-server/tsconfig.json
rm -rf .git
rm -rf .gitignore
rm -rf scripts/*.sh~
rm -rf *.log

# 创建打包临时目录
echo "📁 创建临时目录..."
TMP_DIR=$(mktemp -d)
mkdir -p "${TMP_DIR}/story-muse"

# 复制需要的文件
echo "📋 复制文件..."
cp -r .claude-plugin "${TMP_DIR}/story-muse/"
cp -r mcp-server "${TMP_DIR}/story-muse/"
cp -r skills "${TMP_DIR}/story-muse/"
cp -r docs "${TMP_DIR}/story-muse/"
cp README.md "${TMP_DIR}/story-muse/"
cp LICENSE "${TMP_DIR}/story-muse/"

# 打包
echo "🤐 生成压缩包..."
cd "${TMP_DIR}"
zip -r "${OUTPUT_FILE}" story-muse/ > /dev/null

# 移动到项目根目录
mv "${OUTPUT_FILE}" "${OLDPWD}/"
cd "${OLDPWD}"

# 清理临时目录
rm -rf "${TMP_DIR}"

echo "✅ 打包完成！生成文件: ${OUTPUT_FILE}"
echo "📊 包大小: $(du -h "${OUTPUT_FILE}" | cut -f1)"
