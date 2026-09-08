import io
from reportlab.lib.pagesizes import A5
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas


def render_receipt_pdf(payment):
    """One-page A5 receipt for a single Payment. Returns raw PDF bytes."""
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A5)
    width, height = A5

    academy = payment.group.teacher.academy if payment.group.teacher.academy_id else None
    academy_name = academy.name if academy else 'Journaly'
    student_name = f'{payment.student.first_name} {payment.student.last_name}'.strip() or payment.student.username

    y = height - 25 * mm
    c.setFont('Helvetica-Bold', 16)
    c.drawString(15 * mm, y, academy_name)
    y -= 10 * mm
    c.setFont('Helvetica', 10)
    c.drawString(15 * mm, y, "To'lov kvitansiyasi")

    y -= 15 * mm
    c.setFont('Helvetica', 11)
    rows = [
        ('Kvitansiya raqami', payment.receipt_code),
        ("O'quvchi", student_name),
        ('Guruh', payment.group.name),
        ('Summa', f'{payment.amount:,} som'.replace(',', ' ')),
        ('Usul', payment.get_method_display()),
        ('Sana', payment.paid_at.strftime('%d.%m.%Y %H:%M')),
    ]
    for label, value in rows:
        c.setFont('Helvetica', 9)
        c.drawString(15 * mm, y, label)
        c.setFont('Helvetica-Bold', 11)
        c.drawString(70 * mm, y, str(value))
        y -= 9 * mm

    if payment.note:
        y -= 4 * mm
        c.setFont('Helvetica-Oblique', 9)
        c.drawString(15 * mm, y, f'Izoh: {payment.note}')

    if academy and academy.stamp:
        try:
            with academy.stamp.open('rb') as f:
                img = ImageReader(io.BytesIO(f.read()))
            stamp_size = 30 * mm
            c.drawImage(
                img, width - stamp_size - 15 * mm, 15 * mm,
                width=stamp_size, height=stamp_size,
                preserveAspectRatio=True, mask='auto',
            )
        except Exception:
            pass  # missing/corrupt stamp file shouldn't break receipt generation

    c.showPage()
    c.save()
    return buf.getvalue()
