#!/bin/bash

# 重新生成剩余的旧 MP3 文件

echo "=========================================="
echo "重新生成剩余的旧 MP3 文件"
echo "=========================================="
echo ""

JSON_DIR="data/1_extracted_json"
FILES=(
    "w0cGyvDJrFQ_merged.json"
    "rj0z6Tb45Ps_merged.json"
    "ug5mCB8w_0A_merged.json"
    "ZljJjh7INSw_merged.json"
    "Y6aPrWYiDHw_merged.json"
    "ow8Zx7eiDvg_merged.json"
    "maClopFe1DI_merged.json"
)

echo "需要重新生成 ${#FILES[@]} 个文件："
for file in "${FILES[@]}"; do
    echo "  - $file"
done
echo ""

# 逐个处理
SUCCESS_COUNT=0
FAIL_COUNT=0

for i in "${!FILES[@]}"; do
    file="${FILES[$i]}"
    filepath="$JSON_DIR/$file"
    filename=$(basename "$file" .json)
    
    if [ ! -f "$filepath" ]; then
        echo "⚠️  文件不存在: $filepath"
        continue
    fi
    
    echo ""
    echo "[$((i+1))/${#FILES[@]}] 处理: $filename"
    echo "----------------------------------------"
    
    # 运行生成脚本
    if python3 pipeline/step3_generate.py "$filepath"; then
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

