#!/usr/bin/env python3
"""
Build script for Neko.js
Converts ICO sprites to base64-encoded PNG and bundles with JavaScript
"""

import base64
import os
import sys
from pathlib import Path


def convert_ico_to_base64_png(ico_path):
    """
    Convert ICO file to base64-encoded PNG data URI
    Uses PIL/Pillow if available, otherwise embeds ICO directly
    """
    try:
        import io

        from PIL import Image

        # Load ICO and convert to PNG
        img = Image.open(ico_path)

        # Convert to RGBA if not already
        if img.mode != "RGBA":
            img = img.convert("RGBA")

        # Save as PNG to bytes
        png_io = io.BytesIO()
        img.save(png_io, format="PNG")
        png_data = png_io.getvalue()

        # Encode as base64
        b64_data = base64.b64encode(png_data).decode("ascii")
        return f"data:image/png;base64,{b64_data}"

    except ImportError:
        # Fallback: embed ICO directly (browsers support ICO)
        print(
            f"Warning: PIL/Pillow not available, embedding ICO directly for {ico_path}"
        )
        with open(ico_path, "rb") as f:
            ico_data = f.read()
        b64_data = base64.b64encode(ico_data).decode("ascii")
        return f"data:image/x-icon;base64,{b64_data}"


def build():
    """Main build function"""
    script_dir = Path(__file__).parent
    res_dir = script_dir / "nkosrc4" / "Neko98" / "Res"
    src_dir = script_dir / "src"
    docs_dir = script_dir / "docs"

    # Create docs directory
    docs_dir.mkdir(exist_ok=True)

    # Sprite files in the EXACT order from original C++ LoadImages() comment
    # This order is what the C++ code expects when loading icons 0-31
    sprite_files = [
        "Awake.ico",  # 0: Awake
        "Up1.ico",  # 1: Up frame 1
        "Up2.ico",  # 2: Up frame 2
        "Upright1.ico",  # 3: Up-right frame 1
        "Upright2.ico",  # 4: Up-right frame 2
        "Right1.ico",  # 5: Right frame 1
        "right2.ico",  # 6: Right frame 2
        "Downright1.ico",  # 7: Down-right frame 1
        "downright2.ico",  # 8: Down-right frame 2
        "Down1.ico",  # 9: Down frame 1
        "down2.ico",  # 10: Down frame 2
        "Downleft2.ico",  # 11: Down-left frame 1 (note: files are named 2,1 not 1,2)
        "downleft1.ico",  # 12: Down-left frame 2
        "left1.ico",  # 13: Left frame 1
        "left2.ico",  # 14: Left frame 2
        "Upleft1.ico",  # 15: Up-left frame 1
        "Upleft2.ico",  # 16: Up-left frame 2
        "upclaw1.ico",  # 17: Up Claw frame 1
        "upclaw2.ico",  # 18: Up Claw frame 2
        "Rightclaw2.ico",  # 19: Right Claw frame 1 (note: files are named 2,1)
        "rightclaw1.ico",  # 20: Right Claw frame 2
        "leftclaw1.ico",  # 21: Left Claw frame 1
        "leftclaw2.ico",  # 22: Left Claw frame 2
        "downclaw1.ico",  # 23: Down Claw frame 1
        "downclaw2.ico",  # 24: Down Claw frame 2
        "wash2.ico",  # 25: Wash (only one wash frame)
        "scratch1.ico",  # 26: Scratch frame 1
        "scratch2.ico",  # 27: Scratch frame 2
        "yawn2.ico",  # 28: Yawn frame 1 (STOP also uses this)
        "yawn3.ico",  # 29: Yawn frame 2
        "sleep1.ico",  # 30: Sleep frame 1
        "sleep2.ico",  # 31: Sleep frame 2
    ]

    print("Converting sprites to base64...")
    sprites_b64 = []

    for sprite_file in sprite_files:
        sprite_path = res_dir / sprite_file
        if not sprite_path.exists():
            print(f"Warning: {sprite_file} not found, skipping")
            sprites_b64.append("")
            continue

        print(f"  Converting {sprite_file}...")
        b64_uri = convert_ico_to_base64_png(sprite_path)
        sprites_b64.append(b64_uri)

    print(f"Converted {len([s for s in sprites_b64 if s])} sprites")

    def extract_iife(js_source):
        """Remove the outer IIFE so source files can share the bundle scope."""
        lines = js_source.split("\n")
        in_code = False
        code_lines = []

        for line in lines:
            stripped = line.strip()
            if stripped.startswith("(function") and "{" in stripped:
                in_code = True
                continue
            elif stripped in ["})();", "}());"]:
                in_code = False
                continue
            elif in_code:
                if stripped == "'use strict';" or stripped == '"use strict";':
                    continue
                code_lines.append(line)

        return "\n".join(code_lines)

    # Read JavaScript sources
    print("Reading JavaScript sources...")
    main_source = (src_dir / "main.js").read_text()
    guide_source = (src_dir / "guide.js").read_text()

    # Extract source code from the standalone IIFE wrapper
    code_js = extract_iife(main_source)

    # Format sprites array and code
    sprites_js = ",\n        ".join(f'"{s}"' if s else '""' for s in sprites_b64)

    # Create bundled output using template
    print("Creating bundle...")
    template = f"""\
/**
 * Neko.js - Bundled version
 * Copyright (C) 2025 Louis Abraham
 *
 * Based on Neko98 by David Harvey (1998)
 * Original Neko by Masayuki Koba
 *
 * Licensed under GPL v3 (see LICENSE.md)
 */

(function() {{
    "use strict";

    // Embedded sprite data (base64-encoded)
    const NEKO_SPRITES = [
        {sprites_js}
    ];

{code_js}

    // Auto-initialize function
    window.createNeko = function(options) {{
        const neko = new Neko(options);
        neko.setSprites(NEKO_SPRITES);
        neko.start();
        return neko;
    }};

    // Auto-start if script has data-autostart attribute
    if (document.currentScript && document.currentScript.hasAttribute("data-autostart")) {{
        if (document.readyState === "loading") {{
            document.addEventListener("DOMContentLoaded", function() {{
                window.neko = createNeko();
            }});
        }} else {{
            window.neko = createNeko();
        }}
    }}
}})();
"""

    # Write output
    output_path = docs_dir / "neko.js"
    print(f"Writing to {output_path}...")
    output_path.write_text(template)

    # Keep the optional guide separate so the classic bundle stays lightweight.
    guide_output_path = docs_dir / "neko-guide.js"
    print(f"Writing to {guide_output_path}...")
    guide_output_path.write_text(guide_source)

    # Get file sizes
    neko_size_kb = output_path.stat().st_size / 1024
    guide_size_kb = guide_output_path.stat().st_size / 1024
    print(f"Done! Neko bundle size: {neko_size_kb:.1f} KB")
    print(f"Done! Guide add-on size: {guide_size_kb:.1f} KB")
    print(f"Output written to: {output_path}")
    print(f"Output written to: {guide_output_path}")


if __name__ == "__main__":
    build()
