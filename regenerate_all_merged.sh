#!/bin/bash

# 重新生成所有 _merged.json 文件对应的 MP3

echo "=========================================="
echo "重新生成所有 _merged.json 文件"
echo "=========================================="
echo ""

JSON_DIR="data/1_extracted_json"

# 查找所有 _merged.json 文件
FILES=($(find "$JSON_DIR" -name "*_merged.json" -type f | sort))

if [ ${#FILES[@]} -eq 0 ]; then
    echo "❌ 未找到任何 _merged.json 文件"
    exit 1
fi

echo "找到 ${#FILES[@]} 个 _merged.json 文件："
for file in "${FILES[@]}"; do
    echo "  - $(basename "$file")"
done
echo ""

# 逐个处理
SUCCESS_COUNT=0
FAIL_COUNT=0

for i in "${!FILES[@]}"; do
    file="${FILES[$i]}"
    filename=$(basename "$file" .json)
    
    echo ""
    echo "[$((i+1))/${#FILES[@]}] 处理: $filename"
    echo "----------------------------------------"
    
    # 运行生成脚本
    if python3 pipeline/step3_generate.py "$file"; then
        echo "✅ $filename 生成成功"
        ((SUCCESS_COUNT++))
    else
        echo "❌ $filename 生成失败"
        ((FAIL_COUNT++))
    fi
    
    echo ""
done

echo "=========================================="
echo "处理完成"
echo "=========================================="
echo "成功: $SUCCESS_COUNT"
echo "失败: $FAIL_COUNT"
echo ""
echo "输出目录: data/2_audio_output"
echo ""

