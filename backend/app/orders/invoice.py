from decimal import Decimal
from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet

from app.orders.models import SalesOrder, SalesOrderLine
from app.style_variant.models import Style, StyleVariant


def generate_invoice_pdf(order: SalesOrder, lines: list[SalesOrderLine], db) -> bytes:
    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=20 * mm, bottomMargin=20 * mm)
    styles = getSampleStyleSheet()
    elements = []

    elements.append(Paragraph("Silaa Collective", styles["Title"]))
    elements.append(Paragraph(f"Invoice — Sales Order #{order.id}", styles["Heading2"]))
    elements.append(Spacer(1, 8))

    elements.append(Paragraph(f"<b>Customer:</b> {escape(order.customer_name)}", styles["Normal"]))
    if order.customer_phone:
        elements.append(Paragraph(f"<b>Phone:</b> {escape(order.customer_phone)}", styles["Normal"]))
    if order.customer_address:
        elements.append(Paragraph(f"<b>Address:</b> {escape(order.customer_address)}", styles["Normal"]))
    elements.append(Spacer(1, 12))

    table_data = [["Item", "SKU", "Qty", "Unit Price", "Total"]]
    grand_total = Decimal("0")
    for line in lines:
        variant = db.get(StyleVariant, line.variant_id)
        style = db.get(Style, variant.style_id) if variant else None
        name = f"{style.name} — {variant.color}/{variant.size}" if style and variant else f"Variant {line.variant_id}"
        sku = variant.sku_code if variant else "-"
        line_total = line.qty * line.unit_price
        grand_total += line_total
        table_data.append([name, sku, str(line.qty), f"{line.unit_price:.2f}", f"{line_total:.2f}"])

    table_data.append(["", "", "", "Grand Total", f"{grand_total:.2f}"])

    table = Table(table_data, colWidths=[70 * mm, 30 * mm, 20 * mm, 30 * mm, 30 * mm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#f0f0f0")),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -2), 0.5, colors.grey),
        ("LINEABOVE", (0, -1), (-1, -1), 1, colors.black),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
    ]))
    elements.append(table)

    doc.build(elements)
    return buf.getvalue()
