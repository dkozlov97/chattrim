from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageColor, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent.parent
ICONS_DIR = ROOT / "icons"
DOCS_ASSETS_DIR = ROOT / "docs" / "assets"

COLORS = {
    "bg_top": "#111314",
    "bg_bottom": "#1a1f21",
    "surface": "#171b1d",
    "surface_alt": "#1d2326",
    "surface_soft": "#222a2e",
    "surface_ghost": "#293136",
    "stroke": "#31393d",
    "stroke_soft": "#3c454a",
    "text": "#f2f4f1",
    "text_muted": "#a6b0aa",
    "text_soft": "#c9d1cc",
    "accent": "#10a37f",
    "accent_soft": "#173d35",
    "accent_tint": "#d5eee6",
    "shadow": "#060707",
}


def ensure_dirs() -> None:
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    DOCS_ASSETS_DIR.mkdir(parents=True, exist_ok=True)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates: list[str] = []

    if bold:
        candidates.extend(
            [
                "DejaVuSans-Bold.ttf",
                "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
                "/System/Library/Fonts/Supplemental/Helvetica.ttc",
            ]
        )
    else:
        candidates.extend(
            [
                "DejaVuSans.ttf",
                "/System/Library/Fonts/Supplemental/Arial.ttf",
                "/System/Library/Fonts/Supplemental/Helvetica.ttc",
            ]
        )

    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size=size)
        except OSError:
            continue

    return ImageFont.load_default()


def hex_rgba(value: str, alpha: int = 255) -> tuple[int, int, int, int]:
    rgb = ImageColor.getrgb(value)
    return (rgb[0], rgb[1], rgb[2], alpha)


def vertical_gradient(width: int, height: int, top: str, bottom: str) -> Image.Image:
    image = Image.new("RGBA", (width, height))
    top_rgb = ImageColor.getrgb(top)
    bottom_rgb = ImageColor.getrgb(bottom)
    pixels = image.load()

    for y in range(height):
        ratio = y / max(height - 1, 1)
        row = tuple(
            int(top_rgb[channel] + (bottom_rgb[channel] - top_rgb[channel]) * ratio)
            for channel in range(3)
        )
        for x in range(width):
            pixels[x, y] = row + (255,)

    return image


def add_glow(
    image: Image.Image,
    box: tuple[int, int, int, int],
    color: str,
    alpha: int,
    blur: int,
) -> None:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.ellipse(box, fill=hex_rgba(color, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(blur))
    image.alpha_composite(layer)


def add_vignette(image: Image.Image, alpha: int = 80) -> None:
    width, height = image.size
    mask = Image.new("L", image.size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rectangle((0, 0, width, height), fill=255)
    draw.ellipse((-width * 0.2, -height * 0.15, width * 1.2, height * 1.15), fill=0)
    mask = mask.filter(ImageFilter.GaussianBlur(120))
    vignette = Image.new("RGBA", image.size, hex_rgba("#050606", alpha))
    vignette.putalpha(mask)
    image.alpha_composite(vignette)


def draw_shadowed_panel(
    image: Image.Image,
    box: tuple[int, int, int, int],
    fill: str,
    outline: str,
    radius: int,
    shadow_alpha: int = 90,
    shadow_blur: int = 24,
    shadow_offset: tuple[int, int] = (0, 18),
) -> None:
    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    x0, y0, x1, y1 = box
    dx, dy = shadow_offset
    shadow_draw.rounded_rectangle(
        (x0 + dx, y0 + dy, x1 + dx, y1 + dy),
        radius=radius,
        fill=hex_rgba(COLORS["shadow"], shadow_alpha),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(shadow_blur))
    image.alpha_composite(shadow)

    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle(box, radius=radius, fill=hex_rgba(fill), outline=hex_rgba(outline), width=2)
    image.alpha_composite(layer)


def draw_inner_highlight(
    image: Image.Image,
    box: tuple[int, int, int, int],
    radius: int,
    color: str,
    alpha: int,
) -> None:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    x0, y0, x1, _ = box
    draw.rounded_rectangle((x0 + 1, y0 + 1, x1 - 1, y0 + 86), radius=radius, fill=hex_rgba(color, alpha))
    layer = layer.filter(ImageFilter.GaussianBlur(20))
    image.alpha_composite(layer)


def wrap_text(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.ImageFont, max_width: int) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""

    for word in words:
        candidate = word if not current else f"{current} {word}"
        if draw.textlength(candidate, font=font) <= max_width:
            current = candidate
            continue

        if current:
            lines.append(current)
        current = word

    if current:
        lines.append(current)

    return lines


def draw_multiline_text(
    draw: ImageDraw.ImageDraw,
    position: tuple[int, int],
    text: str,
    font: ImageFont.ImageFont,
    fill: tuple[int, int, int, int],
    max_width: int,
    line_gap: int = 10,
) -> int:
    x, y = position
    lines = wrap_text(draw, text, font, max_width)
    line_height = font.size + line_gap

    for index, line in enumerate(lines):
        draw.text((x, y + index * line_height), line, font=font, fill=fill)

    return y + len(lines) * line_height


def draw_pill(
    draw: ImageDraw.ImageDraw,
    x: int,
    y: int,
    text: str,
    *,
    fill: str,
    outline: str,
    text_color: str,
    font_size: int = 24,
    bold: bool = True,
    pad_x: int = 18,
    pad_y: int = 12,
    dot_color: str | None = None,
) -> tuple[int, int]:
    font = load_font(font_size, bold=bold)
    bbox = draw.textbbox((0, 0), text, font=font)
    dot = 14 if dot_color else 0
    gap = 12 if dot_color else 0
    width = (bbox[2] - bbox[0]) + pad_x * 2 + dot + gap
    height = (bbox[3] - bbox[1]) + pad_y * 2

    draw.rounded_rectangle((x, y, x + width, y + height), radius=height // 2, fill=hex_rgba(fill), outline=hex_rgba(outline), width=2)

    text_x = x + pad_x
    if dot_color:
        dot_center_y = y + height // 2
        draw.ellipse((x + pad_x, dot_center_y - 7, x + pad_x + 14, dot_center_y + 7), fill=hex_rgba(dot_color))
        text_x += dot + gap

    draw.text((text_x, y + pad_y - 2), text, font=font, fill=hex_rgba(text_color))
    return width, height


def draw_message_card(
    image: Image.Image,
    box: tuple[int, int, int, int],
    *,
    fill: str,
    outline: str,
    line_color: str,
    alpha: int = 255,
    header_fill: str | None = None,
    line_scale: tuple[float, float, float] = (0.82, 0.66, 0.48),
) -> None:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    x0, y0, x1, y1 = box
    width = x1 - x0
    draw.rounded_rectangle(box, radius=24, fill=hex_rgba(fill, alpha), outline=hex_rgba(outline, alpha), width=2)

    header_color = header_fill or COLORS["text_soft"]
    draw.rounded_rectangle(
        (x0 + 24, y0 + 22, x0 + min(width * 0.26, 142), y0 + 40),
        radius=9,
        fill=hex_rgba(header_color, min(alpha, 235)),
    )

    for index, scale in enumerate(line_scale):
        if scale <= 0.05:
            continue
        top = y0 + 56 + index * 22
        line_width = int((width - 72) * scale)
        draw.rounded_rectangle(
            (x0 + 24, top, x0 + 24 + line_width, top + 10),
            radius=5,
            fill=hex_rgba(line_color, min(alpha, 220)),
        )

    image.alpha_composite(layer)


def draw_window_shell(
    image: Image.Image,
    box: tuple[int, int, int, int],
    *,
    title: str | None = None,
    subtitle: str | None = None,
) -> tuple[int, int, int, int]:
    draw_shadowed_panel(image, box, COLORS["surface"], COLORS["stroke"], radius=38, shadow_alpha=110, shadow_blur=30)
    draw_inner_highlight(image, box, 38, "#ffffff", 12)

    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    x0, y0, x1, y1 = box

    header_box = (x0 + 18, y0 + 18, x1 - 18, y0 + 94)
    draw.rounded_rectangle(header_box, radius=24, fill=hex_rgba(COLORS["surface_alt"]), outline=hex_rgba(COLORS["stroke_soft"]), width=1)

    dot_y = y0 + 49
    for index, color in enumerate(("#485057", "#4c555c", COLORS["accent"])):
        left = x0 + 40 + index * 24
        draw.ellipse((left, dot_y - 8, left + 16, dot_y + 8), fill=hex_rgba(color))

    if title:
        title_font = load_font(24, bold=True)
        draw.text((x0 + 122, y0 + 34), title, font=title_font, fill=hex_rgba(COLORS["text"]))

    if subtitle:
        subtitle_font = load_font(18)
        draw.text((x0 + 122, y0 + 61), subtitle, font=subtitle_font, fill=hex_rgba(COLORS["text_muted"]))

    body_box = (x0 + 32, y0 + 116, x1 - 32, y1 - 32)
    draw.rounded_rectangle(body_box, radius=28, fill=hex_rgba(COLORS["surface_alt"]), outline=hex_rgba(COLORS["stroke"], 140), width=1)
    image.alpha_composite(layer)
    return body_box


def draw_control_cluster(image: Image.Image, x: int, y: int, label: str) -> None:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    width = 320
    height = 68
    draw.rounded_rectangle((x, y, x + width, y + height), radius=height // 2, fill=hex_rgba(COLORS["surface"], 238), outline=hex_rgba(COLORS["stroke_soft"], 235), width=2)
    draw_pill(draw, x + 14, y + 12, "ChatTrim", fill=COLORS["surface_alt"], outline=COLORS["stroke_soft"], text_color=COLORS["text_soft"], font_size=20, pad_x=14, pad_y=8)
    draw_pill(
        draw,
        x + 134,
        y + 12,
        label,
        fill=COLORS["accent_soft"],
        outline=COLORS["accent"],
        text_color=COLORS["accent_tint"],
        font_size=20,
        pad_x=14,
        pad_y=8,
        dot_color=COLORS["accent"],
    )
    image.alpha_composite(layer)


def draw_trimmed_chat_mock(image: Image.Image, body_box: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = body_box

    for index in range(4):
        top = y0 + 24 + index * 44
        draw_message_card(
            image,
            (x0 + 52, top, x1 - 52, top + 66),
            fill=COLORS["surface_soft"],
            outline=COLORS["stroke"],
            line_color=COLORS["text_muted"],
            alpha=60 + index * 18,
            header_fill=COLORS["text_muted"],
            line_scale=(0.76, 0.58, 0.0),
        )

    draw_control_cluster(image, x0 + 82, y0 + 210, "Aggressive")

    caption_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    caption_draw = ImageDraw.Draw(caption_layer)
    caption_font = load_font(18, bold=True)
    caption_draw.text((x0 + 184, y0 + 296), "Older turns pruned from the live page", font=caption_font, fill=hex_rgba(COLORS["text_muted"]))
    image.alpha_composite(caption_layer)

    visible_boxes = [
        (x0 + 42, y0 + 334, x1 - 92, y0 + 420),
        (x0 + 122, y0 + 436, x1 - 42, y0 + 514),
        (x0 + 42, y0 + 530, x1 - 72, y0 + 604),
    ]
    fills = [COLORS["surface"], COLORS["accent_soft"], COLORS["surface"]]
    outlines = [COLORS["stroke_soft"], COLORS["accent"], COLORS["stroke_soft"]]
    line_colors = [COLORS["text_soft"], COLORS["accent_tint"], COLORS["text_soft"]]

    for box, fill, outline, line_color in zip(visible_boxes, fills, outlines, line_colors):
        draw_message_card(
            image,
            box,
            fill=fill,
            outline=outline,
            line_color=line_color,
            header_fill=COLORS["accent"] if fill == COLORS["accent_soft"] else COLORS["text_soft"],
        )


def draw_dense_thread(image: Image.Image, body_box: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = body_box
    top = y0 + 22
    heights = [52, 54, 58, 52, 54, 58]

    for index, height in enumerate(heights):
        left = x0 + (42 if index % 2 == 0 else 98)
        right = x1 - (92 if index % 2 == 0 else 42)
        draw_message_card(
            image,
            (left, top, right, top + height),
            fill=COLORS["surface_soft"] if index % 2 == 0 else COLORS["surface"],
            outline=COLORS["stroke"],
            line_color=COLORS["text_muted"],
            header_fill=COLORS["text_soft"],
            line_scale=(0.7, 0.52, 0.0),
        )
        top += height + 14


def draw_compact_thread(image: Image.Image, body_box: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = body_box

    for index in range(2):
        top = y0 + 24 + index * 40
        draw_message_card(
            image,
            (x0 + 56, top, x1 - 56, top + 60),
            fill=COLORS["surface_soft"],
            outline=COLORS["stroke"],
            line_color=COLORS["text_muted"],
            alpha=52 + index * 15,
            line_scale=(0.76, 0.56, 0.0),
        )

    draw_control_cluster(image, x0 + 80, y0 + 132, "Aggressive")

    note_layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    note_draw = ImageDraw.Draw(note_layer)
    note_font = load_font(18, bold=True)
    note_draw.text((x0 + 200, y0 + 218), "Latest turns kept in focus", font=note_font, fill=hex_rgba(COLORS["text_muted"]))
    image.alpha_composite(note_layer)

    boxes = [
        (x0 + 48, y0 + 250, x1 - 98, y0 + 318),
        (x0 + 126, y0 + 332, x1 - 48, y0 + 394),
        (x0 + 48, y0 + 408, x1 - 78, y0 + 460),
    ]
    fills = [COLORS["surface"], COLORS["accent_soft"], COLORS["surface"]]
    outlines = [COLORS["stroke_soft"], COLORS["accent"], COLORS["stroke_soft"]]
    line_colors = [COLORS["text_soft"], COLORS["accent_tint"], COLORS["text_soft"]]

    for box, fill, outline, line_color in zip(boxes, fills, outlines, line_colors):
        draw_message_card(
            image,
            box,
            fill=fill,
            outline=outline,
            line_color=line_color,
            header_fill=COLORS["accent"] if fill == COLORS["accent_soft"] else COLORS["text_soft"],
        )


def draw_icon_master(size: int = 512) -> Image.Image:
    image = vertical_gradient(size, size, "#101213", "#1a1f21")
    add_glow(image, (size // 4, size // 12, size + 80, size - 40), COLORS["accent"], 62, 80)
    add_vignette(image, alpha=74)

    tile_margin = int(size * 0.055)
    tile_box = (tile_margin, tile_margin, size - tile_margin, size - tile_margin)
    draw_shadowed_panel(image, tile_box, COLORS["surface"], COLORS["stroke"], radius=int(size * 0.22), shadow_alpha=100, shadow_blur=int(size * 0.05), shadow_offset=(0, int(size * 0.03)))
    draw_inner_highlight(image, tile_box, int(size * 0.22), "#ffffff", 16)

    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    x0, y0, x1, y1 = tile_box

    card_box = (x0 + int(size * 0.16), y0 + int(size * 0.17), x1 - int(size * 0.16), y1 - int(size * 0.17))
    cx0, cy0, cx1, cy1 = card_box

    draw.rounded_rectangle(card_box, radius=int(size * 0.09), fill=hex_rgba("#edf1ee"), outline=hex_rgba("#f8fbf8"), width=max(2, size // 160))

    accent_width = max(12, size // 18)
    accent_pad = max(18, size // 24)
    draw.rounded_rectangle(
        (cx1 - accent_width - accent_pad, cy0 + accent_pad, cx1 - accent_pad, cy1 - accent_pad),
        radius=int(size * 0.03),
        fill=hex_rgba(COLORS["accent"]),
    )

    line_color = "#74807a"
    line_left = cx0 + int(size * 0.075)
    line_right = cx1 - accent_width - accent_pad * 2 - int(size * 0.035)
    line_top = cy0 + int(size * 0.115)
    line_gap = max(18, size // 18)

    for index, scale in enumerate((1.0, 0.82, 0.64)):
        width_value = int((line_right - line_left) * scale)
        top = line_top + index * line_gap
        draw.rounded_rectangle(
            (line_left, top, line_left + width_value, top + max(10, size // 42)),
            radius=max(4, size // 96),
            fill=hex_rgba(line_color),
        )

    image.alpha_composite(layer)
    return image


def save_icons() -> None:
    master = draw_icon_master(512)
    for size in (16, 32, 48, 128):
        master.resize((size, size), Image.Resampling.LANCZOS).save(ICONS_DIR / f"icon{size}.png")


def draw_hero() -> None:
    width, height = 1600, 900
    image = vertical_gradient(width, height, COLORS["bg_top"], COLORS["bg_bottom"])
    add_glow(image, (-120, -60, 760, 620), COLORS["accent"], 44, 110)
    add_glow(image, (940, 80, 1640, 860), "#31443d", 80, 130)
    add_vignette(image, alpha=76)

    draw = ImageDraw.Draw(image)
    icon = draw_icon_master(512).resize((120, 120), Image.Resampling.LANCZOS)
    image.alpha_composite(icon, (104, 92))

    eyebrow_font = load_font(22, bold=True)
    title_font = load_font(94, bold=True)
    subtitle_font = load_font(34)
    body_font = load_font(28)

    draw.text((246, 122), "Chrome extension for long ChatGPT threads", font=eyebrow_font, fill=hex_rgba(COLORS["accent_tint"]))
    draw.text((104, 248), "ChatTrim", font=title_font, fill=hex_rgba(COLORS["text"]))

    subtitle = "Prune older turns so the latest context stays easier to scan."
    draw_multiline_text(draw, (104, 376), subtitle, subtitle_font, hex_rgba(COLORS["text_soft"]), 620, line_gap=12)

    body_text = "Built for people who keep one conversation open for a long time and want a calmer, lighter reading surface without adding any backend or account layer."
    body_bottom = draw_multiline_text(draw, (104, 484), body_text, body_font, hex_rgba(COLORS["text_muted"]), 620, line_gap=12)

    pill_y = body_bottom + 24
    first_width, _ = draw_pill(
        draw,
        104,
        pill_y,
        "Local-only",
        fill=COLORS["surface"],
        outline=COLORS["stroke_soft"],
        text_color=COLORS["text_soft"],
        font_size=22,
        dot_color=COLORS["accent"],
    )
    second_x = 104 + first_width + 18
    second_width, _ = draw_pill(
        draw,
        second_x,
        pill_y,
        "Aggressive mode",
        fill=COLORS["surface"],
        outline=COLORS["stroke_soft"],
        text_color=COLORS["text_soft"],
        font_size=22,
    )
    draw_pill(
        draw,
        second_x + second_width + 18,
        pill_y,
        "Safe fallback",
        fill=COLORS["surface"],
        outline=COLORS["stroke_soft"],
        text_color=COLORS["text_soft"],
        font_size=22,
    )

    mock_box = (900, 82, 1492, 834)
    body_box = draw_window_shell(image, mock_box, title="Current chat", subtitle="Long thread with older turns pruned")
    draw_trimmed_chat_mock(image, body_box)

    image.save(DOCS_ASSETS_DIR / "chattrim-hero.png")


def draw_preview() -> None:
    width, height = 1400, 900
    image = vertical_gradient(width, height, "#101213", "#1a2023")
    add_glow(image, (80, 120, 660, 820), "#26322d", 52, 90)
    add_glow(image, (760, 60, 1340, 820), COLORS["accent"], 32, 100)
    add_vignette(image, alpha=70)

    draw = ImageDraw.Draw(image)
    title_font = load_font(56, bold=True)
    body_font = load_font(28)

    draw.text((90, 74), "Before / After", font=title_font, fill=hex_rgba(COLORS["text"]))
    draw.text((90, 146), "The same long chat, shown as a dense thread first and then in ChatTrim aggressive mode.", font=body_font, fill=hex_rgba(COLORS["text_muted"]))

    left_frame = (88, 214, 648, 828)
    right_frame = (752, 214, 1312, 828)
    left_body = draw_window_shell(image, left_frame, title="Before", subtitle="Full thread stays live in the page")
    right_body = draw_window_shell(image, right_frame, title="After ChatTrim", subtitle="Latest turns stay in focus")

    draw_dense_thread(image, left_body)
    draw_compact_thread(image, right_body)

    draw_pill(
        draw,
        120,
        828,
        "Dense long-thread view",
        fill=COLORS["surface"],
        outline=COLORS["stroke_soft"],
        text_color=COLORS["text_soft"],
        font_size=22,
    )
    draw_pill(
        draw,
        786,
        828,
        "Pruned, calmer reading surface",
        fill=COLORS["surface"],
        outline=COLORS["stroke_soft"],
        text_color=COLORS["text_soft"],
        font_size=22,
        dot_color=COLORS["accent"],
    )

    image.save(DOCS_ASSETS_DIR / "chattrim-preview.png")


def main() -> None:
    ensure_dirs()
    save_icons()
    draw_hero()
    draw_preview()


if __name__ == "__main__":
    main()
