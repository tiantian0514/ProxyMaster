#!/bin/bash

# ProxyMaster 构建脚本
# 用于创建发布版本的zip文件

VERSION="1.0.1"
BUILD_DIR="build"
PACKAGE_NAME="ProxyMaster-v${VERSION}"

echo "🚀 开始构建 ProxyMaster v${VERSION}..."

# 清理之前的构建
if [ -d "$BUILD_DIR" ]; then
    rm -rf "$BUILD_DIR"
fi

# 创建构建目录
mkdir -p "$BUILD_DIR/$PACKAGE_NAME"

echo "📦 复制文件..."

# 复制核心文件
cp manifest.json "$BUILD_DIR/$PACKAGE_NAME/"
cp background.js "$BUILD_DIR/$PACKAGE_NAME/"
cp popup.html "$BUILD_DIR/$PACKAGE_NAME/"
cp popup.js "$BUILD_DIR/$PACKAGE_NAME/"
cp options.html "$BUILD_DIR/$PACKAGE_NAME/"
cp options.js "$BUILD_DIR/$PACKAGE_NAME/"
cp content.js "$BUILD_DIR/$PACKAGE_NAME/"
cp inject.js "$BUILD_DIR/$PACKAGE_NAME/"
cp i18n.js "$BUILD_DIR/$PACKAGE_NAME/"

# 复制样式文件
cp popup.css "$BUILD_DIR/$PACKAGE_NAME/"
cp options.css "$BUILD_DIR/$PACKAGE_NAME/"

# 复制图标文件夹
cp -r icons "$BUILD_DIR/$PACKAGE_NAME/"

# 复制国际化文件夹
cp -r _locales "$BUILD_DIR/$PACKAGE_NAME/"

# 复制文档文件
cp README.md "$BUILD_DIR/$PACKAGE_NAME/"
cp LICENSE "$BUILD_DIR/$PACKAGE_NAME/"
cp RELEASE_NOTES_v1.0.1.md "$BUILD_DIR/$PACKAGE_NAME/"

echo "🗜️ 创建压缩包..."

# 进入构建目录并创建zip文件
cd "$BUILD_DIR"
zip -r "${PACKAGE_NAME}.zip" "$PACKAGE_NAME"

# 返回原目录
cd ..

echo "✅ 构建完成！"
echo "📁 输出文件: $BUILD_DIR/${PACKAGE_NAME}.zip"
echo "📊 文件大小: $(du -h "$BUILD_DIR/${PACKAGE_NAME}.zip" | cut -f1)"

# 显示包含的文件列表
echo ""
echo "📋 包含的文件:"
unzip -l "$BUILD_DIR/${PACKAGE_NAME}.zip" 