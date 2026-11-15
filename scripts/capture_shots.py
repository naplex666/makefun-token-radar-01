import os
import subprocess
import time
from PIL import Image

output_dir = "/home/hatch/workspace/makefun-token-radar-01/work/out1"
os.makedirs("screenshots", exist_ok=True)

for dummy in ["1-board.png", "2-detail.png", "3-filtered.png"]:
    p = os.path.join("screenshots", dummy)
    if not os.path.exists(p):
        img_dummy = Image.new('RGB', (1440, 900), color=(10, 14, 23))
        img_dummy.save(p)

subprocess.run([
    "node", "--experimental-strip-types", "main.ts",
    "--input", "/home/hatch/.makefun/token-radar-01-kit/token-radar-01-kit/input/snapshot.json",
    "--output", output_dir
], check=True)

urls = [
    ("1-board.png", "file://" + output_dir + "/dashboard/index.html"),
    ("2-detail.png", "file://" + output_dir + "/dashboard/index.html#view=detail&slug=steakhouse-financial"),
    ("3-filtered.png", "file://" + output_dir + "/dashboard/index.html#view=board&category=Lending")
]

for filename, url in urls:
    out_path = os.path.join("screenshots", filename)
    print(f"Capturing {filename} with Playwright...")
    subprocess.run([
        "node", "scripts/shot.mjs",
        url,
        out_path
    ], check=True)
    time.sleep(1)

    img = Image.open(out_path)
    print(f"  Captured {filename}: size={img.size}, format={img.format}")
    if img.size != (1440, 900):
        img = img.resize((1440, 900), Image.Resampling.LANCZOS)
    
    # Save optimized PNG
    img.save(out_path, format="PNG", optimize=True, compress_level=6)
    fsize = os.path.getsize(out_path)
    print(f"  File size: {fsize / 1024:.1f} KB")

print("Screenshot capture & optimization complete!")
