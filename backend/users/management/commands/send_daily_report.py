import os
import json
import logging
import urllib.request
import urllib.parse
from django.core.management.base import BaseCommand
from django.utils import timezone

logger = logging.getLogger(__name__)

MSG = {
    'uz': {
        'header':    "📋 *Kunlik hisobot* — {date}\n🏫 {academy}\n\n",
        'no_groups': "Bugun darsi bo'ladigan guruhlar yo'q.",
        'intro_bad': "❌ *Bugun dars yaratmagan o'qituvchilar:*\n",
        'intro_off': "\n📌 *Bugun dars yo'q (oldindan belgilangan):*\n",
        'intro_ok':  "\n✅ *Dars yaratgan o'qituvchilar:*\n",
        'bad_row':   "• {teacher} — {group}\n",
        'off_row':   "• {group} — {reason}\n",
        'ok_row':    "• {teacher} — {group}\n",
        'all_ok':    "✅ Barcha o'qituvchilar bugun dars yaratdi!",
        'reminder':  (
            "⏰ Eslatma!\n\n"
            "*{group}* guruhida bugun dars bo'lishi kerak edi, "
            "lekin siz hali dars yaratmadingiz.\n"
            "Journaly'ga kiring va dars yarating."
        ),
    },
    'ru': {
        'header':    "📋 *Ежедневный отчёт* — {date}\n🏫 {academy}\n\n",
        'no_groups': "Сегодня нет групп с занятиями.",
        'intro_bad': "❌ *Учителя, не создавшие урок сегодня:*\n",
        'intro_off': "\n📌 *Сегодня нет урока (отмечено заранее):*\n",
        'intro_ok':  "\n✅ *Создали урок:*\n",
        'bad_row':   "• {teacher} — {group}\n",
        'off_row':   "• {group} — {reason}\n",
        'ok_row':    "• {teacher} — {group}\n",
        'all_ok':    "✅ Все учителя создали урок сегодня!",
        'reminder':  (
            "⏰ Напоминание!\n\n"
            "В группе *{group}* сегодня должно быть занятие, "
            "но вы ещё не создали урок.\n"
            "Войдите в Journaly и создайте урок."
        ),
    },
}

REASON_LABEL = {
    'uz': {'sick': "o'qituvchi kasal", 'holiday': 'bayram', 'other': 'boshqa sabab'},
    'ru': {'sick': 'учитель болен', 'holiday': 'праздник', 'other': 'другая причина'},
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


def run_report_for_academy(academy, only_chat_id=None):
    """
    only_chat_id: when set, send the report only to that Telegram chat (manual /dailyreport).
                  Skips admin DMs and teacher reminders.
    """
    from groups.models import Group, Lesson, GroupDayOff

    token = os.environ.get('TELEGRAM_BOT_TOKEN')
    if not token:
        logger.warning('TELEGRAM_BOT_TOKEN not set')
        return

    today = timezone.localdate()
    weekday = today.weekday()

    groups_today = [
        g for g in
        Group.objects.filter(teacher__academy=academy, is_graduated=False).select_related('teacher')
        if isinstance(g.class_days, list) and weekday in g.class_days
    ]

    day_off_map = {
        d.group_id: d for d in GroupDayOff.objects.filter(group__in=groups_today, date=today)
    }

    no_lesson, has_lesson, day_off = [], [], []
    for g in groups_today:
        t_name = f'{g.teacher.first_name} {g.teacher.last_name}'.strip() or g.teacher.username
        if Lesson.objects.filter(group=g, date=today).exists():
            has_lesson.append((g, t_name))
        elif g.id in day_off_map:
            day_off.append((g, t_name, day_off_map[g.id]))
        else:
            no_lesson.append((g, t_name))

    def _build_report(lang):
        m = MSG[lang]
        msg = m['header'].format(date=today.strftime('%d.%m.%Y'), academy=academy.name)
        if not groups_today:
            msg += m['no_groups']
        elif not no_lesson and not day_off:
            msg += m['all_ok']
        else:
            if no_lesson:
                msg += m['intro_bad']
                for g, t in no_lesson:
                    msg += m['bad_row'].format(teacher=t, group=g.name)
            if day_off:
                msg += m['intro_off']
                for g, t, d in day_off:
                    reason = REASON_LABEL[lang].get(d.reason, d.reason)
                    msg += m['off_row'].format(group=g.name, reason=reason)
            if has_lesson:
                msg += m['intro_ok']
                for g, t in has_lesson:
                    msg += m['ok_row'].format(teacher=t, group=g.name)
        return msg

    if only_chat_id is not None:
        _send(token, only_chat_id, _build_report('uz'))
        return

    admins = list(academy.members.filter(role='admin', telegram_id__isnull=False))
    if not admins:
        logger.info('Academy %s: no admins with Telegram', academy.name)

    for admin in admins:
        _send(token, admin.telegram_id, _build_report(_lang(admin)))

    from academies.models import AcademyTelegramGroup
    for tg in AcademyTelegramGroup.objects.filter(academy=academy):
        _send(token, tg.chat_id, _build_report(tg.language or 'uz'))

    for g, _ in no_lesson:
        if g.teacher.telegram_id:
            m = MSG[_lang(g.teacher)]
            _send(token, g.teacher.telegram_id, m['reminder'].format(group=g.name))


class Command(BaseCommand):
    help = 'Send daily report for one or all academies'

    def add_arguments(self, parser):
        parser.add_argument('--academy-id', type=int, help='Run for a specific academy')
        parser.add_argument('--force', action='store_true', help='Run for all academies')

    def handle(self, *args, **options):
        from academies.models import Academy

        if options.get('academy_id'):
            academies = Academy.objects.filter(id=options['academy_id'])
        elif options.get('force'):
            academies = Academy.objects.filter(report_time__isnull=False)
        else:
            self.stderr.write('Use --academy-id <id> or --force')
            return

        for academy in academies:
            self.stdout.write(f'Sending report: {academy.name}')
            run_report_for_academy(academy)
