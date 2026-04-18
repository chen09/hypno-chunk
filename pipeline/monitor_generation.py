#!/usr/bin/env python3
"""
监控 step3_generate.py 的生成进度
"""
import os
import sys
import time
from pathlib import Path

def monitor_progress(video_id: str, check_interval: int = 5):
    """监控生成进度"""
    project_root = Path(__file__).parent.parent
    modules_dir = project_root / "data" / "2_audio_output" / f"{video_id}_merged_modules"
    final_mp3 = project_root / "data" / "2_audio_output" / f"{video_id}_merged_final.mp3"
    final_srt = project_root / "data" / "2_audio_output" / f"{video_id}_merged_final.srt"
    
    # 获取预期的模块数量
    json_dir = project_root / "data" / "1_extracted_json"
    part_files = sorted(json_dir.glob(f"{video_id}_chunk*_part*.json"))
    chunk_files = sorted(json_dir.glob(f"{video_id}_chunk*.json"))
    
    if part_files:
        expected_modules = len(part_files)
        format_type = "part"
    elif chunk_files:
        expected_modules = len(chunk_files)
        format_type = "chunk"
    else:
        expected_modules = 0
        format_type = "unknown"
    
    print(f"📊 监控 {video_id} 的生成进度")
    print(f"   预期模块数: {expected_modules}")
    print(f"   格式类型: {format_type}")
    print(f"   检查间隔: {check_interval} 秒")
    print("-" * 60)
    
    last_count = 0
    last_size = 0
    
    try:
        while True:
            # 检查模块文件
            if modules_dir.exists():
                module_files = list(modules_dir.glob("*.mp3"))
                module_count = len(module_files)
                
                # 计算总大小
                total_size = sum(f.stat().st_size for f in module_files)
                total_size_mb = total_size / (1024 * 1024)
                
                # 检查最终文件
                final_exists = final_mp3.exists() and final_srt.exists()
                
                # 显示进度
                status = "✅ 完成" if final_exists else "🔄 进行中"
                progress = f"{module_count}/{expected_modules}" if expected_modules > 0 else f"{module_count}"
                
                # 检查是否有新文件
                if module_count > last_count:
                    print(f"\n✨ 新模块完成! {module_count}/{expected_modules}")
                    last_count = module_count
                
                # 检查文件大小变化
                if total_size > last_size:
                    size_diff = (total_size - last_size) / (1024 * 1024)
                    print(f"📈 进度: {progress} 模块 | 总大小: {total_size_mb:.1f} MB (+{size_diff:.1f} MB) | {status}")
                    last_size = total_size
                elif module_count > 0:
                    # 显示当前状态
                    print(f"⏳ 进度: {progress} 模块 | 总大小: {total_size_mb:.1f} MB | {status}", end='\r')
                
                # 如果完成，退出
                if final_exists:
                    final_size = final_mp3.stat().st_size / (1024 * 1024)
                    print(f"\n\n✅ 生成完成!")
                    print(f"   最终 MP3: {final_size:.1f} MB")
                    print(f"   模块数: {module_count}")
                    break
            else:
                print("⏳ 等待模块目录创建...", end='\r')
            
            time.sleep(check_interval)
            
    except KeyboardInterrupt:
        print("\n\n⏹️  监控已停止")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python monitor_generation.py <VIDEO_ID> [CHECK_INTERVAL]")
        print("Example: python monitor_generation.py mGcRLFnwm9w 5")
        sys.exit(1)
    
    video_id = sys.argv[1]
    check_interval = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    
    monitor_progress(video_id, check_interval)

