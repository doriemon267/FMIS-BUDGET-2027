from PIL import Image, ImageDraw, ImageFont
from pathlib import Path

W, H = 1800, 1050
BG = "#f7fafc"
TITLE = "#1a365d"
BOX_FILL = "#ffffff"
BOX_OUTLINE = "#2d3748"
ARROW = "#2b6cb0"
ACCENT = "#2f855a"
WARN = "#b7791f"

out_path = Path(__file__).with_name("pnpki_signature_flow.png")

img = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(img)

try:
    font_title = ImageFont.truetype("arial.ttf", 40)
    font_h2 = ImageFont.truetype("arial.ttf", 27)
    font_body = ImageFont.truetype("arial.ttf", 21)
    font_small = ImageFont.truetype("arial.ttf", 18)
except Exception:
    font_title = ImageFont.load_default()
    font_h2 = ImageFont.load_default()
    font_body = ImageFont.load_default()
    font_small = ImageFont.load_default()


def rbox(x1, y1, x2, y2, title, lines, outline=BOX_OUTLINE, fill=BOX_FILL):
    draw.rounded_rectangle((x1, y1, x2, y2), radius=20, outline=outline, width=3, fill=fill)
    draw.text((x1 + 18, y1 + 14), title, fill=outline, font=font_h2)
    y = y1 + 58
    for line in lines:
        draw.text((x1 + 22, y), f"• {line}", fill="#2d3748", font=font_body)
        y += 34


def arrow(x1, y1, x2, y2, label=None):
    draw.line((x1, y1, x2, y2), fill=ARROW, width=5)
    import math
    ang = math.atan2(y2 - y1, x2 - x1)
    size = 14
    p1 = (x2, y2)
    p2 = (x2 - size * math.cos(ang - 0.55), y2 - size * math.sin(ang - 0.55))
    p3 = (x2 - size * math.cos(ang + 0.55), y2 - size * math.sin(ang + 0.55))
    draw.polygon([p1, p2, p3], fill=ARROW)
    if label:
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        draw.rounded_rectangle((mx - 150, my - 20, mx + 150, my + 20), radius=10, fill="#ebf8ff", outline=ARROW, width=2)
        draw.text((mx - 140, my - 11), label, fill=ARROW, font=font_small)


# Title
main_title = "FMIS PNPKI Digital Signature Flow (Implemented)"
draw.text((W // 2 - 470, 28), main_title, fill=TITLE, font=font_title)
draw.text((W // 2 - 360, 82), "Client Sign → Backend Verify → Workflow History Storage → UI History View", fill="#2c5282", font=font_body)

# Boxes
rbox(70, 160, 560, 430, "1) Client Workflow Action", [
    "User clicks Submit/Forward action",
    "Dialog shows signature-required warning",
    "createWorkflowDigitalSignature() builds payload"
], outline="#2b6cb0")

rbox(640, 160, 1160, 430, "2) PNPKI Signer Bridge", [
    "Mode: mock (dev) or http (real signer)",
    "Returns signature + certificatePem + signedAt",
    "Payload includes digitalSignature object"
], outline="#2f855a")

rbox(1240, 160, 1730, 500, "3) Backend Verification", [
    "performAction() enforces signature",
    "verifyWorkflowDigitalSignature() validates",
    "Production lock: no mock fallback",
    "Production requires trust bundle path"
], outline="#744210")

rbox(250, 560, 820, 840, "4) Stored in NewProposalWorkflow", [
    "workflowHistory[].digitalSignature",
    "algorithm, signedAt, payload hash",
    "cert subject/issuer/fingerprint",
    "trustBundleConfigured flag"
], outline="#1a365d")

rbox(930, 560, 1550, 900, "5) Visible in UI History Dialog", [
    "Proposal History now has SIGNATURE column",
    "Shows Signed/Not signed status",
    "Shows algorithm + signed timestamp",
    "Shows fingerprint preview + tooltip"
], outline=ACCENT)

# Arrows
arrow(560, 285, 640, 285, "Sign request")
arrow(1160, 285, 1240, 285, "POST /action")
arrow(1480, 500, 1480, 560, "Save metadata")
arrow(820, 700, 930, 700, "Read history")
arrow(1240, 380, 560, 380, "400 on invalid signature")

# Notes
draw.rounded_rectangle((70, 900, 1730, 1000), radius=16, outline=WARN, width=3, fill="#fffaf0")
draw.text((95, 920), "Security Notes:", fill=WARN, font=font_h2)
draw.text((300, 923), "• Mock signer is for development only • In production: use real PNPKI signer + trust bundle", fill="#744210", font=font_body)
draw.text((300, 957), "• Signature requirement now includes submit-to-reviewer, submit-to-approver, forward-to-officer/manager, finalize", fill="#744210", font=font_body)

img.save(out_path)
print(str(out_path))
