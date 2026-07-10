from datetime import date
from decimal import Decimal
from io import BytesIO
from typing import Optional
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT

from app.expenses.models import CompanySetting
from app.orders.models import SalesOrder, SalesOrderLine
from app.style_variant.models import Style, StyleVariant


def _setting(db, key: str) -> Optional[str]:
    row = db.get(CompanySetting, key)
    return row.value if row else None


def generate_invoice_pdf(order: SalesOrder, lines: list[SalesOrderLine], db) -> bytes:
    gstin = _setting(db, "gstin")
    business_address = _setting(db, "business_address")

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm)
    styles = getSampleStyleSheet()
    right_style = ParagraphStyle("right", parent=styles["Normal"], alignment=TA_RIGHT)
    right_small = ParagraphStyle("right_small", parent=styles["Normal"], alignment=TA_RIGHT, fontSize=9, textColor=colors.grey)
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=9, textColor=colors.grey)
    elements = []

    invoice_label = "TAX INVOICE" if gstin else "INVOICE"

    left_header = [
        Paragraph(invoice_label, ParagraphStyle("label", parent=small, fontSize=8, textColor=colors.grey)),
        Paragraph(f"Sales Order #{order.id}", styles["Title"]),
        Paragraph(f"Issued {date.today().strftime('%d %b %Y')}", small),
    ]
    right_lines = [Paragraph("<b>Silaa Collective</b>", right_style)]
    if business_address:
        right_lines.append(Paragraph(escape(business_address), right_small))
    if gstin:
        right_lines.append(Paragraph(f"GSTIN: {escape(gstin)}", right_small))

    header_table = Table([[left_header, right_lines]], colWidths=[100 * mm, 70 * mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 16))

    elements.append(Paragraph("BILLED TO", ParagraphStyle("label2", parent=small, fontSize=8, textColor=colors.grey)))
    elements.append(Paragraph(f"<b>{escape(order.customer_name)}</b>", styles["Normal"]))
    if order.customer_phone:
        elements.append(Paragraph(escape(order.customer_phone), small))
    if order.customer_address:
        elements.append(Paragraph(escape(order.customer_address), small))
    elements.append(Spacer(1, 16))

    table_data = [["Item", "SKU", "Qty", "Unit Price", "GST %", "Total"]]
    subtotal = Decimal("0")
    gst_total = Decimal("0")
    for line in lines:
        variant = db.get(StyleVariant, line.variant_id)
        style = db.get(Style, variant.style_id) if variant else None
        name = f"{style.name} — {variant.color}/{variant.size}" if style and variant else f"Variant {line.variant_id}"
        sku = variant.sku_code if variant else "-"
        line_subtotal = line.qty * line.unit_price
        line_gst = line_subtotal * line.gst_percent / Decimal("100")
        subtotal += line_subtotal
        gst_total += line_gst
        table_data.append([
            name, sku, str(line.qty), f"{line.unit_price:.2f}",
            f"{line.gst_percent:.1f}%", f"{(line_subtotal + line_gst):.2f}",
        ])

    table = Table(table_data, colWidths=[55 * mm, 28 * mm, 15 * mm, 25 * mm, 17 * mm, 30 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0f0f0")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 12))

    grand_total = subtotal + gst_total
    totals_data = [
        ["Subtotal", f"{subtotal:.2f}"],
        ["GST", f"{gst_total:.2f}"],
        ["Total", f"{grand_total:.2f}"],
    ]
    totals_table = Table(totals_data, colWidths=[30 * mm, 30 * mm], hAlign="RIGHT")
    totals_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, -1), (-1, -1), 12),
        ("LINEABOVE", (0, -1), (-1, -1), 1, colors.black),
        ("TOPPADDING", (0, -1), (-1, -1), 6),
    ]))
    elements.append(totals_table)

    doc.build(elements)
    return buf.getvalue()
