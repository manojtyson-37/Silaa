from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from io import BytesIO
from typing import Optional
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER

from app.expenses.models import CompanySetting
from app.orders.models import SalesOrder, SalesOrderLine
from app.style_variant.models import Style, StyleVariant

ACCENT = colors.HexColor("#4f46e5")

GST_STATE_CODES = {
    "01": "Jammu and Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
    "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi",
    "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar", "11": "Sikkim",
    "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
    "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal",
    "20": "Jharkhand", "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh",
    "24": "Gujarat", "26": "Dadra and Nagar Haveli and Daman and Diu",
    "27": "Maharashtra", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep",
    "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
    "35": "Andaman and Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh",
    "38": "Ladakh",
}

_ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
         "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
         "Seventeen", "Eighteen", "Nineteen"]
_TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]


def _two_digit_words(n: int) -> str:
    if n < 20:
        return _ONES[n]
    tail = _ONES[n % 10]
    return f"{_TENS[n // 10]} {tail}".strip() if tail else _TENS[n // 10]


def _three_digit_words(n: int) -> str:
    if n >= 100:
        rest = n % 100
        head = f"{_ONES[n // 100]} Hundred"
        return f"{head} {_two_digit_words(rest)}" if rest else head
    return _two_digit_words(n)


def _int_to_words_indian(n: int) -> str:
    if n == 0:
        return "Zero"
    parts = []
    crore, n = divmod(n, 10_000_000)
    lakh, n = divmod(n, 100_000)
    thousand, n = divmod(n, 1000)
    hundred = n
    if crore:
        parts.append(f"{_three_digit_words(crore)} Crore")
    if lakh:
        parts.append(f"{_three_digit_words(lakh)} Lakh")
    if thousand:
        parts.append(f"{_three_digit_words(thousand)} Thousand")
    if hundred:
        parts.append(_three_digit_words(hundred))
    return " ".join(parts)


def amount_in_words(amount: Decimal) -> str:
    if amount < 0:
        raise ValueError("amount_in_words does not support negative amounts")
    rupees = int(amount)
    paise = int((amount - rupees) * 100)
    words = f"{_int_to_words_indian(rupees)} Rupees"
    if paise:
        words += f" and {_int_to_words_indian(paise)} Paise"
    return words + " Only"


def _setting(db, key: str) -> Optional[str]:
    row = db.get(CompanySetting, key)
    return row.value if row and row.value else None


def generate_invoice_pdf(order: SalesOrder, lines: list[SalesOrderLine], db) -> bytes:
    gstin = _setting(db, "gstin")
    business_address = _setting(db, "business_address")
    bank_name = _setting(db, "bank_name")
    bank_account = _setting(db, "bank_account")
    bank_ifsc = _setting(db, "bank_ifsc")
    invoice_terms = _setting(db, "invoice_terms")

    business_state = GST_STATE_CODES.get(gstin[:2]) if gstin else None
    same_state = bool(
        business_state and order.customer_state
        and business_state.strip().lower() == order.customer_state.strip().lower()
    )

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=16 * mm, bottomMargin=16 * mm)
    styles = getSampleStyleSheet()
    title_center = ParagraphStyle("title_center", parent=styles["Title"], alignment=TA_CENTER, textColor=ACCENT)
    right_style = ParagraphStyle("right", parent=styles["Normal"], alignment=TA_RIGHT)
    right_small = ParagraphStyle("right_small", parent=styles["Normal"], alignment=TA_RIGHT, fontSize=9, textColor=colors.grey)
    small = ParagraphStyle("small", parent=styles["Normal"], fontSize=9, textColor=colors.grey)
    label = ParagraphStyle("label", parent=small, fontSize=8, textColor=colors.grey)
    elements = []

    invoice_label = "TAX INVOICE" if gstin else "INVOICE"
    number_line = order.invoice_number or f"Sales Order #{order.id} (draft — number assigned on fulfillment)"

    elements.append(Paragraph(invoice_label, title_center))
    elements.append(Spacer(1, 10))

    logo_cell = Table([["₹"]], colWidths=[10 * mm], rowHeights=[10 * mm])
    logo_cell.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 14),
    ]))
    name_block = [Paragraph("<b>Silaa Collective</b>", ParagraphStyle("bizname", parent=styles["Normal"], textColor=ACCENT, fontSize=13))]
    business_row = Table([[logo_cell, name_block]], colWidths=[12 * mm, 88 * mm])
    business_row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
    ]))

    left_header = [business_row]
    if business_address:
        left_header.append(Paragraph(escape(business_address), small))

    right_lines = [Paragraph(f"<b>Invoice No:</b> {escape(number_line)}", right_small)]
    right_lines.append(Paragraph(f"<b>Invoice Date:</b> {date.today().strftime('%d %b %Y')}", right_small))
    if gstin:
        right_lines.append(Paragraph(f"<b>GSTIN:</b> {escape(gstin)}", right_small))
        right_lines.append(Paragraph(f"<b>State:</b> {escape(business_state or '')}", right_small))

    header_table = Table([[left_header, right_lines]], colWidths=[100 * mm, 70 * mm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    elements.append(header_table)
    elements.append(Spacer(1, 4))
    elements.append(Table([[""]], colWidths=[170 * mm], style=TableStyle([("LINEBELOW", (0, 0), (-1, -1), 1, ACCENT)])))
    elements.append(Spacer(1, 14))

    bill_to = [Paragraph("BILLED TO", label), Paragraph(f"<b>{escape(order.customer_name)}</b>", styles["Normal"])]
    if order.customer_phone:
        bill_to.append(Paragraph(escape(order.customer_phone), small))
    if order.customer_address:
        bill_to.append(Paragraph(escape(order.customer_address), small))
    if order.customer_state:
        bill_to.append(Paragraph(escape(order.customer_state), small))

    meta_lines = []
    if gstin:
        meta_lines.append(Paragraph(f"<b>Place of Supply:</b> {escape(order.customer_state or 'Unknown')}", right_small))
        meta_lines.append(Paragraph(
            f"<b>Supply Type:</b> {'Intra-State (CGST + SGST)' if same_state else 'Inter-State (IGST)'}",
            right_small,
        ))

    info_row = Table([[bill_to, meta_lines]], colWidths=[100 * mm, 70 * mm])
    info_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    elements.append(info_row)
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
        ("BACKGROUND", (0, 0), (-1, 0), ACCENT),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
    ]))
    elements.append(table)
    elements.append(Spacer(1, 12))

    grand_total = subtotal + gst_total
    totals_data = [["Subtotal", f"{subtotal:.2f}"]]
    if gstin and business_state:
        if same_state:
            cgst = (gst_total / 2).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
            sgst = gst_total - cgst
            totals_data.append(["CGST", f"{cgst:.2f}"])
            totals_data.append(["SGST", f"{sgst:.2f}"])
        else:
            totals_data.append(["IGST", f"{gst_total:.2f}"])
    else:
        totals_data.append(["GST", f"{gst_total:.2f}"])
    totals_data.append(["Total", f"{grand_total:.2f}"])

    totals_table = Table(totals_data, colWidths=[30 * mm, 30 * mm], hAlign="RIGHT")
    totals_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
        ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, -1), (-1, -1), 12),
        ("TEXTCOLOR", (0, -1), (-1, -1), ACCENT),
        ("LINEABOVE", (0, -1), (-1, -1), 1, colors.black),
        ("TOPPADDING", (0, -1), (-1, -1), 6),
    ]))
    elements.append(totals_table)
    elements.append(Spacer(1, 8))
    elements.append(Paragraph(f"<i>{escape(amount_in_words(grand_total))}</i>", small))

    footer_left = []
    if bank_name or bank_account or bank_ifsc:
        footer_left.append(Paragraph("BANK DETAILS", label))
        if bank_name:
            footer_left.append(Paragraph(f"Bank: {escape(bank_name)}", small))
        if bank_account:
            footer_left.append(Paragraph(f"A/c No.: {escape(bank_account)}", small))
        if bank_ifsc:
            footer_left.append(Paragraph(f"IFSC: {escape(bank_ifsc)}", small))

    footer_right = []
    if invoice_terms:
        footer_right.append(Paragraph("TERMS & CONDITIONS", label))
        footer_right.append(Paragraph(escape(invoice_terms), small))
    footer_right.append(Spacer(1, 24))
    footer_right.append(Paragraph(f"<b>For Silaa Collective</b>", right_style))
    footer_right.append(Spacer(1, 16))
    footer_right.append(Paragraph("Authorised Signatory", right_small))

    if footer_left or footer_right:
        elements.append(Spacer(1, 24))
        footer_row = Table([[footer_left or [Paragraph("", small)], footer_right]], colWidths=[100 * mm, 70 * mm])
        footer_row.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
        elements.append(footer_row)

    doc.build(elements)
    return buf.getvalue()
