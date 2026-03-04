from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

W, H = 1900, 1100
BG = "#f4f7fb"
TITLE = "#12355b"
TEXT = "#2d3748"
MUTED = "#4a5568"
BORDER = "#2b6cb0"
GREEN = "#2f855a"
ORANGE = "#c05621"
RED = "#c53030"
PURPLE = "#6b46c1"

out_path = Path(__file__).with_name("pnpki_production_hardening_checklist.png")

img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)

try:
    f_title = ImageFont.truetype("arial.ttf", 42)
    f_h = ImageFont.truetype("arial.ttf", 27)
    f_b = ImageFont.truetype("arial.ttf", 21)
    f_s = ImageFont.truetype("arial.ttf", 18)
except Exception:
    f_title = ImageFont.load_default()
    f_h = ImageFont.load_default()
    f_b = ImageFont.load_default()
    f_s = ImageFont.load_default()


def rbox(x1, y1, x2, y2, title, color=BORDER, fill="#ffffff"):
    d.rounded_rectangle((x1, y1, x2, y2), radius=20, fill=fill, outline=color, width=3)
    d.text((x1 + 70, y1 + 18), title, fill=color, font=f_h)


def bullet(x, y, lines, color=TEXT, step=33):
    yy = y
    for ln in lines:
        d.text((x, yy), f"• {ln}", fill=color, font=f_b)
        yy += step


def icon_lock(x, y, c=BORDER):
    d.rounded_rectangle((x + 10, y + 28, x + 56, y + 72), radius=8, outline=c, width=4, fill="#ebf8ff")
    d.arc((x + 16, y, x + 50, y + 42), 200, -20, fill=c, width=4)


def icon_shield(x, y, c=GREEN):
    d.polygon([(x + 30, y), (x + 62, y + 12), (x + 58, y + 50), (x + 30, y + 74), (x + 2, y + 50), (x - 2, y + 12)], outline=c, fill="#f0fff4", width=4)
    d.line((x + 15, y + 38, x + 27, y + 50, x + 48, y + 22), fill=c, width=5)


def icon_server(x, y, c=PURPLE):
    d.rounded_rectangle((x, y, x + 64, y + 20), radius=6, outline=c, width=3, fill="#faf5ff")
    d.rounded_rectangle((x, y + 24, x + 64, y + 44), radius=6, outline=c, width=3, fill="#faf5ff")
    d.rounded_rectangle((x, y + 48, x + 64, y + 68), radius=6, outline=c, width=3, fill="#faf5ff")
    d.ellipse((x + 8, y + 7, x + 14, y + 13), fill=c)
    d.ellipse((x + 8, y + 31, x + 14, y + 37), fill=c)
    d.ellipse((x + 8, y + 55, x + 14, y + 61), fill=c)


def icon_db(x, y, c="#2c5282"):
    d.ellipse((x, y, x + 64, y + 20), outline=c, width=3, fill="#ebf8ff")
    d.rectangle((x, y + 10, x + 64, y + 58), outline=c, width=3, fill="#ebf8ff")
    d.ellipse((x, y + 48, x + 64, y + 68), outline=c, width=3, fill="#ebf8ff")


def icon_cert(x, y, c=ORANGE):
    d.rounded_rectangle((x, y, x + 56, y + 70), radius=8, outline=c, width=3, fill="#fffaf0")
    d.line((x + 10, y + 16, x + 46, y + 16), fill=c, width=3)
    d.line((x + 10, y + 30, x + 46, y + 30), fill=c, width=3)
    d.ellipse((x + 20, y + 40, x + 36, y + 56), outline=c, width=3)
    d.polygon([(x + 26, y + 56), (x + 22, y + 68), (x + 30, y + 62)], fill=c)
    d.polygon([(x + 30, y + 56), (x + 34, y + 68), (x + 26, y + 62)], fill=c)


def icon_warn(x, y, c=RED):
    d.polygon([(x + 32, y), (x + 64, y + 58), (x, y + 58)], outline=c, fill="#fff5f5", width=3)
    d.line((x + 32, y + 18, x + 32, y + 38), fill=c, width=4)
    d.ellipse((x + 29, y + 44, x + 35, y + 50), fill=c)


def arrow(x1, y1, x2, y2, color=BORDER, width=4):
    d.line((x1, y1, x2, y2), fill=color, width=width)
    import math
    a = math.atan2(y2 - y1, x2 - x1)
    s = 12
    p2 = (x2 - s * math.cos(a - 0.5), y2 - s * math.sin(a - 0.5))
    p3 = (x2 - s * math.cos(a + 0.5), y2 - s * math.sin(a + 0.5))
    d.polygon([(x2, y2), p2, p3], fill=color)


# Header
headline = "PNPKI Production Hardening Checklist"
d.text((W // 2 - 430, 24), headline, fill=TITLE, font=f_title)
d.text((W // 2 - 360, 80), "Icons + image-style guide for secure FMIS rollout", fill="#2c5282", font=f_b)

# Top row boxes
rbox(60, 140, 620, 380, "1) Client Signing Rules", GREEN)
icon_lock(84, 162, GREEN)
bullet(96, 230, [
    "Disable mock signer in production bundle",
    "Use HTTP bridge to real PNPKI signer service",
    "Sign canonical payload before /action request"
])

rbox(670, 140, 1240, 380, "2) Backend Verification Rules", BORDER)
icon_server(695, 162, BORDER)
bullet(708, 230, [
    "Enforce signature on required workflow actions",
    "Normalize signedAt/statuses before verify",
    "Reject invalid cert or invalid signature"
])

rbox(1290, 140, 1840, 380, "3) Trust Bundle + CA Chain", ORANGE)
icon_cert(1315, 158, ORANGE)
bullet(1328, 230, [
    "Production requires PNPKI_TRUST_BUNDLE_PATH",
    "Validate certificate chain to trusted roots",
    "Block action when bundle/chain is invalid"
])

# Middle row
rbox(120, 450, 900, 760, "4) Audit Storage (Evidence)", PURPLE)
icon_db(146, 470, PURPLE)
bullet(160, 540, [
    "Store workflowHistory.digitalSignature metadata",
    "Algorithm + signedAt + payload hash",
    "Certificate subject/issuer/fingerprint",
    "Trust-bundle configured flag for each action"
])

rbox(980, 450, 1780, 760, "5) Operator Visibility (History UI)", "#2f855a")
icon_shield(1005, 468, "#2f855a")
bullet(1020, 540, [
    "Show SIGNATURE column in Proposal History",
    "Signed/Not signed status per workflow step",
    "Display algorithm, timestamp, fingerprint preview",
    "Use this as day-to-day compliance evidence"
])

# Flow arrows
arrow(620, 260, 670, 260, GREEN)
arrow(1240, 260, 1290, 260, ORANGE)
arrow(955, 380, 955, 450, BORDER)
arrow(900, 605, 980, 605, "#2f855a")

# Risk panel
rbox(60, 810, 1840, 1040, "Critical Risk Controls (Do Not Skip)", RED, fill="#fff5f5")
icon_warn(88, 846, RED)
bullet(160, 860, [
    "Never allow mock fallback in production runtime",
    "Do not leave PNPKI_TRUST_BUNDLE_PATH empty in production",
    "Do not accept unsigned submit-to-reviewer / submit-to-approver / forward / finalize actions",
    "Rotate and maintain trusted CA bundle with official PNPKI roots/intermediates"
], color="#822727", step=36)

d.text((1490, 1008), "Generated for FMIS PNPKI rollout", fill=MUTED, font=f_s)

img.save(out_path)
print(str(out_path))
