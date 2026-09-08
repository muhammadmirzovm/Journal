import os
import json
import logging
import urllib.request
import urllib.parse
from django.core.management.base import BaseCommand

logger = logging.getLogger(__name__)

MSG = {
    'uz': (
        "⏰ To'lov eslatmasi\n\n"
        "*{student}* — *{group}* guruhi uchun {balance} so'm qarzdorlik bor.\n"
        "Iltimos, to'lovni amalga oshiring."
    ),
    'ru': (
        "⏰ Напоминание об оплате\n\n"
        "У *{student}* — задолженность {balance} сум по группе *{group}*.\n"
        "Пожалуйста, произведите оплату."
    ),
}


def _send(token, chat_id, text):
    url = f'https://api.telegram.org/bot{token}/sendMessage'
    data = urllib.parse.urlencode({'chat_id': chat_id, 'text': text, 'parse_mode': 'Markdown'}).encode()
    req = urllib.request.Request(url, data=data, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read())
            if not result.get('ok'):
                logger.warning('Telegram send failed chat=%s: %s', chat_id, result)
    except Exception as exc:
        logger.error('Telegram send error chat=%s: %s', chat_id, exc)


def _lang(user):
    lang = getattr(user, 'telegram_lang', None) or 'uz'
    return lang if lang in MSG else 'uz'


def run_payment_reminders_for_academy(academy):
    from users.models import Notification, ParentStudent
    from payments.models import balances_for

    token = os.environ.get('TELEGRAM_BOT_TOKEN')
    if not token:
        logger.warning('TELEGRAM_BOT_TOKEN not set')
        return

    debtors = [row for row in balances_for(academy) if row['balance'] > 0]
    if not debtors:
        return

    for row in debtors:
        student = row['student']
        group_name = row['group'].name
        balance = f"{row['balance']:,}".replace(',', ' ')

        title = "To'lov eslatmasi"
        student_body = f"{group_name} — {balance} so'm qarzdorlik"

        if student.telegram_id:
            Notification.objects.create(user=student, type=Notification.PAYMENT, title=title, body=student_body)
            _send(token, student.telegram_id, MSG[_lang(student)].format(
                student=student.first_name or student.username, group=group_name, balance=balance,
            ))

        for ps in ParentStudent.objects.filter(student=student).select_related('parent'):
            parent = ps.parent
            student_name = f'{student.first_name} {student.last_name}'.strip() or student.username
            Notification.objects.create(
                user=parent, type=Notification.PAYMENT, title=title,
                body=f'{student_name} · {student_body}',
            )
            if parent.telegram_id:
                _send(token, parent.telegram_id, MSG[_lang(parent)].format(
                    student=student_name, group=group_name, balance=balance,
                ))


class Command(BaseCommand):
    help = 'Send payment debt reminders for one or all academies'

    def add_arguments(self, parser):
        parser.add_argument('--academy-id', type=int, help='Run for a specific academy')
        parser.add_argument('--force', action='store_true', help='Run for all academies')

    def handle(self, *args, **options):
        from academies.models import Academy

        if options.get('academy_id'):
            academies = Academy.objects.filter(id=options['academy_id'])
        elif options.get('force'):
            academies = Academy.objects.all()
        else:
            self.stderr.write('Use --academy-id <id> or --force')
            return

        for academy in academies:
            self.stdout.write(f'Sending payment reminders: {academy.name}')
            run_payment_reminders_for_academy(academy)
