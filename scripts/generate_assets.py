from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageColor, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parent.parent
ICONS_DIR = ROOT / "icons"
DOCS_ASSETS_DIR = ROOT / "docs" / "assets"

COLORS = {
    "bg_top": "#08111d",
    "bg_bottom": "#14243a",
    "panel": "#0f172a",
    "panel_soft": "#172554",
    "line": "#8be9ff",
    "line_soft": "#4fd1f7",
    "text": "#e6fbff",
    "text_muted": "#93c5d8",
    "border": "#214867",
    "ghost": "#26435c",
    "success": "#34d399",
}


def ensure_dirs() -> None:
    ICONS_DIR.mkdir(parents=True, exist_ok=True)
    DOCS_ASSETS_DIR.mkdir(parents=True, exist_ok=True)


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = []

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


def draw_grid(draw: ImageDraw.ImageDraw, width: int, height: int, spacing: int, color: str, alpha: int) -> None:
    rgba = hex_rgba(color, alpha)
    for x in range(-height, width, spacing):
        draw.line((x, 0, x + height, height), fill=rgba, width=1)


def draw_panel(image: Image.Image, box: tuple[int, int, int, int], fill: str, border: str, radius: int) -> None:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    draw.rounded_rectangle(box, radius=radius, fill=hex_rgba(fill), outline=hex_rgba(border), width=2)
    image.alpha_composite(layer)


def draw_chat_card(
    image: Image.Image,
    x: int,
    y: int,
    width: int,
    height: int,
    title_color: str,
    line_color: str,
    fill: str,
    border: str,
    alpha: int = 255,
) -> None:
    layer = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    box = (x, y, x + width, y + height)
    draw.rounded_rectangle(box, radius=24, fill=hex_rgba(fill, alpha), outline=hex_rgba(border, alpha), width=2)
    draw.rounded_rectangle((x + 24, y + 24, x + 82, y + 42), radius=9, fill=hex_rgba(title_color, alpha))

    line_alpha = max(alpha - 10, 90)
    for index, line_width in enumerate((width - 110, width - 140, width - 190)):
        top = y + 64 + index * 26
        draw.rounded_rectangle(
            (x + 24, top, x + 24 + line_width, top + 10),
            radius=5,
            fill=hex_rgba(line_color, line_alpha),
        )

    image.alpha_composite(layer)


def draw_icon_base(size: int = 512) -> Image.Image:
    image = vertical_gradient(size, size, COLORS["bg_top"], COLORS["bg_bottom"])
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle((24, 24, size - 24, size - 24), radius=120, outline=hex_rgba(COLORS["border"], 160), width=3)

    shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle((126, 140, 418, 356), radius=70, fill=(0, 0, 0, 130))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    image.alpha_composite(shadow)

    cards = [
        (110, 126, 250, 158, COLORS["ghost"], COLORS["border"], 170),
        (132, 158, 250, 158, COLORS["panel_soft"], COLORS["border"], 220),
        (156, 192, 250, 158, COLORS["panel"], COLORS["line"], 255),
    ]
    for x, y, width, height, fill, border, alpha in cards:
        draw_chat_card(image, x, y, width, height, COLORS["line"], COLORS["text_muted"], fill, border, alpha)

    accent = Image.new("RGBA", image.size, (0, 0, 0, 0))
    accent_draw = ImageDraw.Draw(accent)
    accent_draw.rounded_rectangle((354, 146, 388, 366), radius=16, fill=hex_rgba(COLORS["line"]))
    accent_draw.rounded_rectangle((330, 204, 424, 236), radius=16, fill=hex_rgba(COLORS["line_soft"], 210))
    accent_draw.rounded_rectangle((330, 264, 410, 296), radius=16, fill=hex_rgba(COLORS["line_soft"], 180))
    accent_draw.rounded_rectangle((330, 324, 388, 356), radius=16, fill=hex_rgba(COLORS["line_soft"], 150))
    image.alpha_composite(accent)

    return image


def save_icons() -> None:
    icon = draw_icon_base(512)
    for size in (16, 32, 48, 128):
        resized = icon.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(ICONS_DIR / f"icon{size}.png")


def draw_chip(draw: ImageDraw.ImageDraw, x: int, y: int, text: str, fill: str, border: str) -> None:
    font = load_font(28, bold=True)
    bbox = draw.textbbox((0, 0), text, font=font)
    width = bbox[2] - bbox[0] + 34
    height = bbox[3] - bbox[1] + 22
    draw.rounded_rectangle((x, y, x + width, y + height), radius=22, fill=hex_rgba(fill, 215), outline=hex_rgba(border, 220), width=2)
    draw.text((x + 17, y + 9), text, font=font, fill=hex_rgba(COLORS["text"]))


def draw_hero() -> None:
    width, height = 1600, 900
    image = vertical_gradient(width, height, COLORS["bg_top"], "#10243f")
    draw = ImageDraw.Draw(image)

    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((980, 90, 1550, 660), fill=hex_rgba(COLORS["line"], 85))
    glow = glow.filter(ImageFilter.GaussianBlur(60))
    image.alpha_composite(glow)

    draw_grid(draw, width, height, 120, COLORS["line"], 18)

    icon = draw_icon_base(512).resize((160, 160), Image.Resampling.LANCZOS)
    image.alpha_composite(icon, (110, 110))

    title_font = load_font(96, bold=True)
    subtitle_font = load_font(34)
    body_font = load_font(28)

    draw.text((110, 300), "ChatTrim", font=title_font, fill=hex_rgba(COLORS["text"]))
    draw.text(
        (110, 418),
        "Make long ChatGPT threads calmer, cleaner, and easier to scan.",
        font=subtitle_font,
        fill=hex_rgba(COLORS["text_muted"]),
    )
    draw.text(
        (110, 484),
        "Older messages stay available on demand while the latest turns remain in focus.",
        font=body_font,
        fill=hex_rgba(COLORS["text_muted"]),
    )

    draw_chip(draw, 110, 580, "Latest 10 visible", COLORS["panel"], COLORS["line"])
    draw_chip(draw, 380, 580, "Local-only", COLORS["panel"], COLORS["line"])
    draw_chip(draw, 558, 580, "One-click reveal", COLORS["panel"], COLORS["line"])

    panel_box = (920, 120, 1470, 780)
    draw_panel(image, panel_box, COLORS["panel"], COLORS["border"], 48)

    for offset in range(5):
        draw_chat_card(
            image,
            1010,
            170 + offset * 64,
            360,
            106,
            COLORS["line_soft"],
            COLORS["text_muted"],
            COLORS["ghost"],
            COLORS["border"],
            70 + offset * 18,
        )

    draw.rounded_rectangle((1000, 420, 1386, 472), radius=20, fill=hex_rgba(COLORS["panel_soft"]), outline=hex_rgba(COLORS["line"], 170), width=2)
    button_font = load_font(24, bold=True)
    draw.text((1070, 433), "Show 12 hidden messages", font=button_font, fill=hex_rgba(COLORS["text"]))

    for index in range(3):
        draw_chat_card(
            image,
            1010,
            502 + index * 92,
            380,
            122,
            COLORS["line"],
            COLORS["text_muted"],
            COLORS["panel"],
            COLORS["line"],
            255,
        )

    image.save(DOCS_ASSETS_DIR / "chattrim-hero.png")


def draw_preview() -> None:
    width, height = 1400, 900
    image = vertical_gradient(width, height, "#0a1321", "#11253f")
    draw = ImageDraw.Draw(image)
    draw_grid(draw, width, height, 130, COLORS["line"], 15)

    title_font = load_font(42, bold=True)
    label_font = load_font(24, bold=True)
    body_font = load_font(24)

    draw.text((110, 76), "Long thread, cleaner focus", font=title_font, fill=hex_rgba(COLORS["text"]))
    draw.text((110, 132), "A simple visual story for the extension README and store assets.", font=body_font, fill=hex_rgba(COLORS["text_muted"]))

    left_box = (90, 210, 640, 790)
    right_box = (760, 210, 1310, 790)
    draw_panel(image, left_box, COLORS["panel"], COLORS["border"], 42)
    draw_panel(image, right_box, COLORS["panel"], COLORS["border"], 42)

    draw.text((126, 244), "Before", font=label_font, fill=hex_rgba(COLORS["text"]))
    draw.text((796, 244), "After ChatTrim", font=label_font, fill=hex_rgba(COLORS["text"]))

    for index in range(7):
        draw_chat_card(
            image,
            128,
            300 + index * 62,
            470,
            92,
            COLORS["line_soft"],
            COLORS["text_muted"],
            COLORS["panel_soft"] if index % 2 == 0 else COLORS["ghost"],
            COLORS["border"],
            245,
        )

    for index in range(4):
        alpha = 90 + index * 20
        draw_chat_card(
            image,
            800,
            300 + index * 56,
            430,
            86,
            COLORS["line_soft"],
            COLORS["text_muted"],
            COLORS["ghost"],
            COLORS["border"],
            alpha,
        )

    draw.rounded_rectangle((794, 532, 1240, 584), radius=18, fill=hex_rgba(COLORS["panel_soft"]), outline=hex_rgba(COLORS["line"], 170), width=2)
    draw.text((878, 545), "Show 8 hidden messages", font=label_font, fill=hex_rgba(COLORS["text"]))

    for index in range(3):
        draw_chat_card(
            image,
            800,
            620 + index * 54,
            440,
            98,
            COLORS["line"],
            COLORS["text_muted"],
            COLORS["panel"],
            COLORS["line"],
            255,
        )

    draw_chip(draw, 126, 716, "Full thread noise", COLORS["ghost"], COLORS["border"])
    draw_chip(draw, 796, 716, "Latest context first", COLORS["panel_soft"], COLORS["line"])
    draw_chip(draw, 796, 778, "Reveal on demand", COLORS["panel"], COLORS["line"])

    image.save(DOCS_ASSETS_DIR / "chattrim-preview.png")


def main() -> None:
    ensure_dirs()
    save_icons()
    draw_hero()
    draw_preview()


if __name__ == "__main__":
    main()
