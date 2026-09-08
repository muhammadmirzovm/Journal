import io
import logging
import os
from asgiref.sync import async_to_sync
from telegram import Bot, InputFile

from .receipts import render_receipt_pdf

logger = logging.getLogger(__name__)

CAPTION = {
    'uz': "✅ To'lov qabul qilindi\n\n{group} — {amount} so'm\nKvitansiya: {code}",
    'ru': "✅ Платёж принят\n\n{group} — {amount} сум\nКвитанция: {code}",
}


async def _send_receipt_document(telegram_id, lang, pdf_bytes, filename, caption_kwargs):
    # Fresh Bot() per call, same as users.telegram_bot.send_notification/
    # send_otp — a cached Application's Bot breaks across independent
    # async_to_sync() calls (see the "Event loop is closed" fix elsewhere
    # in this codebase); a throwaway Bot per send has no such state to break.
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    if not bot_token:
        return
    bot = Bot(token=bot_token)
    caption = CAPTION.get(lang, CAPTION['uz']).format(**caption_kwargs)
    try:
        await bot.send_document(
            chat_id=telegram_id,
            document=InputFile(io.BytesIO(pdf_bytes), filename=filename),
            caption=caption,
        )
    except Exception as e:
        logger.error('Telegram receipt send error chat=%s: %s', telegram_id, e)


def send_payment_receipt(payment):
    """Best-effort: sends the PDF receipt to the student and any linked
    parents over Telegram right after a payment is recorded. Silently
    skips a recipient with no linked Telegram account — this is a
    convenience delivery channel, not the only way to get a receipt (it's
    always available from the app's own payment history too)."""
    from users.models import ParentStudent

    student = payment.student
    recipients = []
    if student.telegram_id:
        recipients.append((student.telegram_id, student.telegram_lang or 'uz'))
    for ps in ParentStudent.objects.filter(student=student).select_related('parent'):
        if ps.parent.telegram_id:
            recipients.append((ps.parent.telegram_id, ps.parent.telegram_lang or 'uz'))
    if not recipients:
        return

    pdf_bytes = render_receipt_pdf(payment)
    filename = f'kvitansiya_{payment.receipt_code}.pdf'
    amount = f'{payment.amount:,}'.replace(',', ' ')
    kwargs = dict(group=payment.group.name, amount=amount, code=payment.receipt_code)

    for telegram_id, lang in recipients:
        async_to_sync(_send_receipt_document)(telegram_id, lang, pdf_bytes, filename, kwargs)
