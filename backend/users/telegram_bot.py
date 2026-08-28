"""
Telegram bot for Journaly — webhook mode.
"""

import os
import logging
from datetime import date as date_cls, timedelta
from asgiref.sync import sync_to_async
from django.utils import timezone
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, Bot, BotCommand, ReplyKeyboardMarkup, KeyboardButton
from telegram.ext import (
    ApplicationBuilder, CommandHandler, CallbackQueryHandler,
    ContextTypes, MessageHandler, filters,
)

logger = logging.getLogger(__name__)

# ── Translations ───────────────────────────────────────────────────────────────

MSG = {
    'uz': {
        'choose_lang': "Tilni tanlang / Выберите язык:",

        'welcome_unlinked': (
            "Salom, {name}! 👋\n\n"
            "Bu bot Journaly uchun.\n"
            "Hisobingizni ulash uchun Journaly Profilingizga o'ting "
            "va «Telegramni ulash» tugmasini bosing.\n\n"
            "📌 Buyruqlar:\n"
            "/help — yordam"
        ),
        'welcome_student': (
            "Salom, {name}! 👋  Hisobingiz ulangan ✅\n\n"
            "📌 Buyruqlar:\n"
            "/mystats — ballar va davomatni ko'rish\n"
            "/myrank — reytingdagi o'rningiz\n"
            "/homework — uy vazifalarini ko'rish\n"
            "/help — barcha buyruqlar"
        ),
        'welcome_teacher': (
            "Salom, {name}! 👋  Hisobingiz ulangan ✅\n\n"
            "📌 Buyruqlar:\n"
            "/mygroups — guruhlaringiz statistikasi\n"
            "/struggling — qiynalayotgan o'quvchilar\n"
            "/nolesson — bugun/boshqa kuni dars yo'qligini belgilash\n"
            "/help — barcha buyruqlar"
        ),
        'welcome_admin': (
            "Salom, {name}! 👋  Hisobingiz ulangan ✅\n\n"
            "📌 Buyruqlar:\n"
            "/academy — akademiya statistikasi\n"
            "/holiday — bayram kunini belgilash\n"
            "/help — barcha buyruqlar"
        ),
        'welcome_parent': (
            "Salom, {name}! 👋  Hisobingiz ulangan ✅\n\n"
            "📌 Buyruqlar:\n"
            "/mystats — farzandlaringiz statistikasi\n"
            "/lessons — so'nggi darslar (masalan: /lessons 10)\n"
            "/help — barcha buyruqlar"
        ),
        'welcome_other': (
            "Salom, {name}! 👋  Hisobingiz ulangan ✅\n\n"
            "📌 Buyruqlar:\n"
            "/help — barcha buyruqlar"
        ),
        'success': (
            "✅ Muvaffaqiyatli! Telegramingiz @{username} hisobiga ulandi.\n\n"
            "📌 Buyruqlar:\n"
            "/mystats — statistikani ko'rish\n"
            "/homework — uy vazifalarini ko'rish\n"
            "/help — barcha buyruqlar"
        ),
        'invalid_link':  "❌ Bu havola yaroqsiz yoki allaqachon ishlatilgan.",
        'expired_link':  "❌ Bu havolaning muddati tugagan. Profilingizdan yangi havola oling.",
        'already_taken': "❌ Bu Telegram hisobi boshqa foydalanuvchiga bog'langan.",
        'not_linked':    "❌ Hisobingiz ulanmagan. Journaly Profilingizga o'ting va Telegramni ulang.",
        'no_data':       "📭 Hozircha ma'lumot yo'q.",
        'otp': (
            "🔐 Journaly — parolni tiklash\n\n"
            "Sizning OTP kodingiz: *{code}*\n\n"
            "Kod 5 daqiqa ichida amal qiladi. Uni hech kimga bermang."
        ),

        # ── Help messages ──────────────────────────────────────────────────
        'help_student': (
            "📚 *Journaly Bot*\n\n"
            "/mystats — ballar va davomatni ko'rish\n"
            "/myrank — reytingdagi o'rningiz\n"
            "/homework — barcha uy vazifalarini ko'rish\n"
            "/help — shu ro'yxat"
        ),
        'help_teacher': (
            "📚 *Journaly Bot*\n\n"
            "/mygroups — guruhlaringiz statistikasi\n"
            "/struggling — qiynalayotgan o'quvchilar\n"
            "/nolesson — bugun/boshqa kuni dars yo'qligini belgilash\n"
            "/help — shu ro'yxat"
        ),
        'help_admin': (
            "📚 *Journaly Bot*\n\n"
            "/academy — akademiya statistikasi\n"
            "/holiday — bayram kunini belgilash\n"
            "/help — shu ro'yxat"
        ),
        'help_parent': (
            "📚 *Journaly Bot*\n\n"
            "/mystats — farzandlaringiz statistikasi\n"
            "/lessons — so'nggi darslar (masalan: /lessons 10)\n"
            "/help — shu ro'yxat"
        ),
        'help_other': (
            "📚 *Journaly Bot*\n\n"
            "/help — shu ro'yxat\n\n"
            "Hisobingizni ulash uchun Journaly Profilingizga o'ting."
        ),

        # ── Student stats ──────────────────────────────────────────────────
        'stats_header_student': "📊 *Sizning statistikangiz:*\n",
        'stats_header_parent':  "📊 *Farzandlaringiz statistikasi:*\n",
        'stats_child':          "\n👤 *{name}*",
        'stats_group':          "\n📚 {group}\n• Davomat: {attendance}%\n• Ball: {score}%",
        'stats_no_groups':      "\nGuruhlar topilmadi.",

        # ── Student rank ───────────────────────────────────────────────────
        'rank_header':   "🏆 *Reytingdagi o'rningiz:*\n",
        'rank_item':     "\n📚 {group}: *{rank}/{total}* o'rin",
        'rank_no_data':  "📭 Reyting hali aniqlanmagan.",

        # ── Homework ───────────────────────────────────────────────────────
        'homework_header':    "📝 *Uy vazifalari:*\n",
        'homework_item':      "\n📚 *{group}* — {lesson}\n{homework}",
        'homework_no_lesson': "\n📚 *{group}*\n📭 _Hali dars o'tkazilmagan_",
        'homework_not_set':   "\n📚 *{group}* — {lesson}\n📭 _Uy vazifasi hali joylanmagan_",
        'homework_none':      "📭 Hozircha guruh yo'q.",
        'hw_notification':    "📝 *{lesson}* darsi uchun uy vazifasi ({group}):\n\n{homework}",

        # ── Teacher: groups ────────────────────────────────────────────────
        'groups_header': "👥 *Guruhlaringiz:*\n",
        'groups_item':   "\n📚 *{name}*\n• O'quvchilar: {count}\n• Ball: {score}% | Davomat: {att}%",
        'groups_none':   "📭 Hozircha guruh yo'q.",

        # ── Teacher: struggling ────────────────────────────────────────────
        'struggling_header': "⚠️ *Qiynalayotgan o'quvchilar:*\n",
        'struggling_item':   "\n👤 {name} ({group})\n• Ball: {score}% | Davomat: {att}%",
        'struggling_none':   "✅ Hamma yaxshi o'qiyapti!",

        # ── /nolesson & /holiday ───────────────────────────────────────────
        'nl_ask_date':        "Qaysi sana uchun *dars yo'q* deb belgilaymiz?",
        'nl_ask_custom_date': "Sanani KK.OO formatida yozing (masalan: 25.03):",
        'nl_bad_date':        "❌ Sana formati noto'g'ri. Masalan: 25.03",
        'nl_no_groups':       "📭 Bu sanada sizda belgilanadigan guruh topilmadi.",
        'nl_ask_group':       "*{date}* — qaysi guruh uchun?",
        'nl_ask_reason':      "Sababi?",
        'nl_done':            "✅ *{group}* guruhi uchun *{date}* kuni dars yo'q deb belgilandi.\nO'qituvchiga eslatma yuborilmaydi.",
        'nl_already':         "Bu guruh uchun *{date}* kuni allaqachon belgilangan.",
        'nl_cancelled':       "Bekor qilindi.",
        'reason_sick':        "🤒 O'qituvchi kasal",
        'reason_holiday':     "🎉 Bayram",
        'reason_other':       "📌 Boshqa sabab",
        'date_today':         "Bugun",
        'date_tomorrow':      "Ertaga",
        'date_custom':        "📅 Sanani kiriting",
        'cancel_btn':         "❌ Bekor qilish",
        'hol_admin_only':     "Bu buyruq faqat admin uchun.",
        'hol_ask_date':       "Qaysi sana *bayram* (butun akademiya uchun dars yo'q) deb belgilansin?",
        'hol_confirm':        "❗ *{date}* kuni akademiyadagi *barcha* guruhlar uchun dars yo'q deb belgilanadi.\nTasdiqlaysizmi?",
        'hol_confirm_yes':    "✅ Ha, tasdiqlayman",
        'hol_done':           "✅ *{date}* — {count} ta guruh uchun bayram deb belgilandi.",
        'hol_cancelled':      "Bekor qilindi.",

        # ── Parent: recent lessons ─────────────────────────────────────────
        'lessons_header': "📅 *So'nggi darslar* ({shown} ta, jami {total} ta):\n",
        'lessons_child':  "\n👤 *{name}* — {group}",
        'lessons_item':   "\n• {lesson}: {status} {score}",
        'lessons_none':   "\nDarslar topilmadi.",
        'lessons_tip':    "\n\n💡 Ko'proq ko'rish: /lessons 10",

        # ── Admin ──────────────────────────────────────────────────────────
        'academy_stats': (
            "🏫 *Akademiya statistikasi:*\n\n"
            "👨‍🏫 O'qituvchilar: *{teachers}*\n"
            "🎓 O'quvchilar: *{students}*"
        ),
    },
    'ru': {
        'choose_lang': "Tilni tanlang / Выберите язык:",

        'welcome_unlinked': (
            "Привет, {name}! 👋\n\n"
            "Этот бот используется Journaly.\n"
            "Чтобы привязать аккаунт, перейдите в Профиль в Journaly "
            "и нажмите «Подключить Telegram».\n\n"
            "📌 Команды:\n"
            "/help — помощь"
        ),
        'welcome_student': (
            "Привет, {name}! 👋  Аккаунт привязан ✅\n\n"
            "📌 Команды:\n"
            "/mystats — оценки и посещаемость\n"
            "/myrank — ваше место в рейтинге\n"
            "/homework — домашние задания\n"
            "/help — все команды"
        ),
        'welcome_teacher': (
            "Привет, {name}! 👋  Аккаунт привязан ✅\n\n"
            "📌 Команды:\n"
            "/mygroups — статистика групп\n"
            "/struggling — отстающие ученики\n"
            "/nolesson — отметить «нет урока» на сегодня/другой день\n"
            "/help — все команды"
        ),
        'welcome_admin': (
            "Привет, {name}! 👋  Аккаунт привязан ✅\n\n"
            "📌 Команды:\n"
            "/academy — статистика академии\n"
            "/holiday — отметить праздничный день\n"
            "/help — все команды"
        ),
        'welcome_parent': (
            "Привет, {name}! 👋  Аккаунт привязан ✅\n\n"
            "📌 Команды:\n"
            "/mystats — статистика детей\n"
            "/lessons — последние уроки (например: /lessons 10)\n"
            "/help — все команды"
        ),
        'welcome_other': (
            "Привет, {name}! 👋  Аккаунт привязан ✅\n\n"
            "📌 Команды:\n"
            "/help — все команды"
        ),
        'success': (
            "✅ Успешно! Ваш Telegram привязан к @{username}.\n\n"
            "📌 Команды:\n"
            "/mystats — статистика\n"
            "/homework — домашние задания\n"
            "/help — все команды"
        ),
        'invalid_link':  "❌ Эта ссылка недействительна или уже была использована.",
        'expired_link':  "❌ Срок действия ссылки истёк. Получите новую ссылку в Профиле.",
        'already_taken': "❌ Этот Telegram уже привязан к другому аккаунту.",
        'not_linked':    "❌ Аккаунт не привязан. Перейдите в Профиль Journaly и привяжите Telegram.",
        'no_data':       "📭 Данных пока нет.",
        'otp': (
            "🔐 Journaly — сброс пароля\n\n"
            "Ваш OTP-код: *{code}*\n\n"
            "Код действителен 5 минут. Не передавайте его никому."
        ),

        # ── Help messages ──────────────────────────────────────────────────
        'help_student': (
            "📚 *Journaly Bot*\n\n"
            "/mystats — оценки и посещаемость\n"
            "/myrank — ваше место в рейтинге\n"
            "/homework — домашние задания\n"
            "/help — этот список"
        ),
        'help_teacher': (
            "📚 *Journaly Bot*\n\n"
            "/mygroups — статистика групп\n"
            "/struggling — отстающие ученики\n"
            "/nolesson — отметить «нет урока» на сегодня/другой день\n"
            "/help — этот список"
        ),
        'help_admin': (
            "📚 *Journaly Bot*\n\n"
            "/academy — статистика академии\n"
            "/holiday — отметить праздничный день\n"
            "/help — этот список"
        ),
        'help_parent': (
            "📚 *Journaly Bot*\n\n"
            "/mystats — статистика детей\n"
            "/lessons — последние уроки (например: /lessons 10)\n"
            "/help — этот список"
        ),
        'help_other': (
            "📚 *Journaly Bot*\n\n"
            "/help — этот список\n\n"
            "Привяжите аккаунт в Профиле Journaly."
        ),

        # ── Student stats ──────────────────────────────────────────────────
        'stats_header_student': "📊 *Ваша статистика:*\n",
        'stats_header_parent':  "📊 *Статистика детей:*\n",
        'stats_child':          "\n👤 *{name}*",
        'stats_group':          "\n📚 {group}\n• Посещаемость: {attendance}%\n• Оценки: {score}%",
        'stats_no_groups':      "\nГрупп не найдено.",

        # ── Student rank ───────────────────────────────────────────────────
        'rank_header':  "🏆 *Ваше место в рейтинге:*\n",
        'rank_item':    "\n📚 {group}: *{rank}/{total}* место",
        'rank_no_data': "📭 Рейтинг ещё не определён.",

        # ── Homework ───────────────────────────────────────────────────────
        'homework_header':    "📝 *Домашние задания:*\n",
        'homework_item':      "\n📚 *{group}* — {lesson}\n{homework}",
        'homework_no_lesson': "\n📚 *{group}*\n📭 _Уроков ещё не было_",
        'homework_not_set':   "\n📚 *{group}* — {lesson}\n📭 _Домашнее задание ещё не задано_",
        'homework_none':      "📭 Групп пока нет.",
        'hw_notification':    "📝 Домашнее задание по уроку *{lesson}* ({group}):\n\n{homework}",

        # ── Teacher: groups ────────────────────────────────────────────────
        'groups_header': "👥 *Ваши группы:*\n",
        'groups_item':   "\n📚 *{name}*\n• Учеников: {count}\n• Оценки: {score}% | Посещаемость: {att}%",
        'groups_none':   "📭 Групп пока нет.",

        # ── Teacher: struggling ────────────────────────────────────────────
        'struggling_header': "⚠️ *Отстающие ученики:*\n",
        'struggling_item':   "\n👤 {name} ({group})\n• Оценки: {score}% | Посещаемость: {att}%",
        'struggling_none':   "✅ Все учатся хорошо!",

        # ── /nolesson & /holiday ───────────────────────────────────────────
        'nl_ask_date':        "На какую дату отметить, что *урока не будет*?",
        'nl_ask_custom_date': "Введите дату в формате ДД.ММ (например: 25.03):",
        'nl_bad_date':        "❌ Неверный формат даты. Например: 25.03",
        'nl_no_groups':       "📭 На эту дату нет групп для отметки.",
        'nl_ask_group':       "*{date}* — для какой группы?",
        'nl_ask_reason':      "Причина?",
        'nl_done':            "✅ Для группы *{group}* на *{date}* отмечено «нет урока».\nНапоминание учителю не будет отправлено.",
        'nl_already':         "Для этой группы на *{date}* уже отмечено.",
        'nl_cancelled':       "Отменено.",
        'reason_sick':        "🤒 Учитель болен",
        'reason_holiday':     "🎉 Праздник",
        'reason_other':       "📌 Другая причина",
        'date_today':         "Сегодня",
        'date_tomorrow':      "Завтра",
        'date_custom':        "📅 Ввести дату",
        'cancel_btn':         "❌ Отмена",
        'hol_admin_only':     "Эта команда только для админа.",
        'hol_ask_date':       "На какую дату отметить *праздник* (нет урока для всей академии)?",
        'hol_confirm':        "❗ На *{date}* будет отмечено «нет урока» для *всех* групп академии.\nПодтверждаете?",
        'hol_confirm_yes':    "✅ Да, подтверждаю",
        'hol_done':           "✅ *{date}* — отмечено для {count} групп как праздник.",
        'hol_cancelled':      "Отменено.",

        # ── Parent: recent lessons ─────────────────────────────────────────
        'lessons_header': "📅 *Последние уроки* ({shown} из {total}):\n",
        'lessons_child':  "\n👤 *{name}* — {group}",
        'lessons_item':   "\n• {lesson}: {status} {score}",
        'lessons_none':   "\nУроков не найдено.",
        'lessons_tip':    "\n\n💡 Показать больше: /lessons 10",

        # ── Admin ──────────────────────────────────────────────────────────
        'academy_stats': (
            "🏫 *Статистика академии:*\n\n"
            "👨‍🏫 Учителей: *{teachers}*\n"
            "🎓 Учеников: *{students}*"
        ),
    },
}

LANG_KEYBOARD = InlineKeyboardMarkup([
    [
        InlineKeyboardButton("🇺🇿 O'zbek", callback_data='lang_uz'),
        InlineKeyboardButton("🇷🇺 Русский", callback_data='lang_ru'),
    ]
])

# ── Reply keyboard menus (per role, per lang) ──────────────────────────────────

MENU_BUTTONS = {
    'uz': {
        'student': [
            ['📊 Statistika',     '🏆 Reyting'],
            ['📝 Uy vazifasi',    '❓ Yordam'],
        ],
        'teacher': [
            ['👥 Guruhlar',          '⚠️ Qiynalayotganlar'],
            ["🚫 Dars yo'q",         '❓ Yordam'],
        ],
        'admin': [
            ['🏫 Akademiya',      '📅 Kunlik hisobot'],
            ['🎉 Bayram',         '❓ Yordam'],
        ],
        'parent': [
            ['📊 Statistika',       "📅 So'nggi darslar"],
            ['❓ Yordam'],
        ],
    },
    'ru': {
        'student': [
            ['📊 Статистика',         '🏆 Рейтинг'],
            ['📝 Домашнее задание',   '❓ Помощь'],
        ],
        'teacher': [
            ['👥 Группы',             '⚠️ Отстающие'],
            ['🚫 Нет урока',          '❓ Помощь'],
        ],
        'admin': [
            ['🏫 Академия',           '📅 Ежедневный отчёт'],
            ['🎉 Праздник',           '❓ Помощь'],
        ],
        'parent': [
            ['📊 Статистика',         '📅 Последние уроки'],
            ['❓ Помощь'],
        ],
    },
}

BUTTON_ACTIONS = {
    # UZ
    '📊 Statistika':       'mystats',
    '🏆 Reyting':          'myrank',
    '📝 Uy vazifasi':      'homework',
    '👥 Guruhlar':         'mygroups',
    '⚠️ Qiynalayotganlar': 'struggling',
    '🏫 Akademiya':        'academy',
    '📅 Kunlik hisobot':   'dailyreport',
    "📅 So'nggi darslar":  'lessons',
    "🚫 Dars yo'q":        'nolesson',
    '🎉 Bayram':           'holiday',
    '❓ Yordam':           'help',
    # RU
    '📊 Статистика':        'mystats',
    '🏆 Рейтинг':           'myrank',
    '📝 Домашнее задание':  'homework',
    '👥 Группы':            'mygroups',
    '⚠️ Отстающие':         'struggling',
    '🏫 Академия':          'academy',
    '📅 Ежедневный отчёт':  'dailyreport',
    '📅 Последние уроки':   'lessons',
    '🚫 Нет урока':         'nolesson',
    '🎉 Праздник':          'holiday',
    '❓ Помощь':            'help',
}

# Per-role '/' command list — shared by _set_user_commands() and the
# refresh_telegram_menu management command (used to re-sync already-linked users
# after this list changes).
ROLE_COMMANDS = {
    'student': [
        ('mystats',  'Statistika / Статистика'),
        ('myrank',   'Reyting / Рейтинг'),
        ('homework', 'Uy vazifalari / Домашние задания'),
    ],
    'teacher': [
        ('mygroups',   'Guruhlar / Группы'),
        ('struggling', "Qiynalayotganlar / Отстающие"),
        ('nolesson',   "Dars yo'q / Нет урока"),
    ],
    'admin': [
        ('academy',     'Akademiya / Академия'),
        ('dailyreport', 'Kunlik hisobot / Ежедневный отчёт'),
    ],
    'parent': [
        ('mystats', 'Statistika / Статистика'),
        ('lessons', "So'nggi darslar / Последние уроки"),
    ],
}


def _get_reply_keyboard(role, lang):
    rows = MENU_BUTTONS.get(lang, MENU_BUTTONS['uz']).get(role)
    if not rows:
        return None
    return ReplyKeyboardMarkup(
        [[KeyboardButton(btn) for btn in row] for row in rows],
        resize_keyboard=True,
    )


# ── DB helpers ─────────────────────────────────────────────────────────────────

def _get_user(telegram_id):
    from users.models import User
    try:
        return User.objects.get(telegram_id=telegram_id)
    except User.DoesNotExist:
        return None


def _student_stats(user):
    from groups.models import GroupMembership, Score, Attendance
    from django.db.models import Sum
    memberships = list(GroupMembership.objects.filter(student=user).select_related('group'))
    rows = []
    for m in memberships:
        join_date    = m.joined_at.date()
        lessons_qs   = m.group.lessons.filter(date__gte=join_date)
        lesson_count = lessons_qs.count()
        if lesson_count == 0:
            continue
        score_sum = Score.objects.filter(
            lesson__in=lessons_qs, student=user
        ).aggregate(total=Sum('value'))['total'] or 0
        present = Attendance.objects.filter(
            lesson__in=lessons_qs, student=user, present=True
        ).count()
        rows.append({
            'group':      m.group.name,
            'score':      round(score_sum / (lesson_count * 5) * 100),
            'attendance': round(present / lesson_count * 100),
        })
    return rows


def _student_rank(user):
    from groups.models import GroupMembership, Score
    from django.db.models import Sum
    memberships = list(GroupMembership.objects.filter(student=user).select_related('group'))
    rows = []
    for m in memberships:
        group    = m.group
        lessons  = group.lessons.filter(date__gte=m.joined_at.date())
        if not lessons.exists():
            continue
        all_members = list(GroupMembership.objects.filter(group=group).select_related('student'))
        scores = {}
        for am in all_members:
            s = Score.objects.filter(lesson__in=lessons, student=am.student).aggregate(t=Sum('value'))['t'] or 0
            scores[am.student_id] = s
        sorted_ids = sorted(scores, key=lambda x: scores[x], reverse=True)
        rank = sorted_ids.index(user.id) + 1 if user.id in sorted_ids else len(sorted_ids)
        rows.append({'group': group.name, 'rank': rank, 'total': len(sorted_ids)})
    return rows


def _student_homework(user):
    from groups.models import GroupMembership
    memberships = list(GroupMembership.objects.filter(student=user).select_related('group'))
    items = []
    for m in memberships:
        last_lesson = m.group.lessons.order_by('-date', '-created_at').first()
        if last_lesson is None:
            items.append({'group': m.group.name, 'lesson': None, 'homework': None})
        else:
            items.append({
                'group':    m.group.name,
                'lesson':   last_lesson.title,
                'homework': last_lesson.homework or None,
            })
    return items



def _parent_stats(user):
    rows = []
    for ps in user.children.select_related('student').all():
        child = ps.student
        name  = f'{child.first_name} {child.last_name}'.strip() or child.username
        rows.append({'name': name, 'stats': _student_stats(child)})
    return rows


def _parent_recent_lessons(user, limit=5):
    from groups.models import GroupMembership, Score, Attendance
    children_data = []
    for ps in user.children.select_related('student').all():
        child = ps.student
        name  = f'{child.first_name} {child.last_name}'.strip() or child.username
        memberships = list(GroupMembership.objects.filter(student=child).select_related('group'))
        for m in memberships:
            total_count  = m.group.lessons.count()
            recent       = list(m.group.lessons.order_by('-date')[:limit])
            lessons_list = []
            for lesson in recent:
                score_obj = Score.objects.filter(lesson=lesson, student=child).first()
                att_obj   = Attendance.objects.filter(lesson=lesson, student=child).first()
                score     = f'{score_obj.value}/5' if score_obj else '—'
                status    = '✅' if (att_obj and att_obj.present) else '❌'
                lessons_list.append({'lesson': lesson.title, 'score': score, 'status': status})
            children_data.append({
                'name':    name,
                'group':   m.group.name,
                'lessons': lessons_list,
                'total':   total_count,
                'shown':   len(lessons_list),
            })
    return children_data


def _teacher_groups(user):
    from groups.models import Group, GroupMembership, Score, Attendance
    from django.db.models import Sum
    groups = list(Group.objects.filter(teacher=user))
    rows = []
    for group in groups:
        lessons      = group.lessons.all()
        lesson_count = lessons.count()
        student_count = GroupMembership.objects.filter(group=group).count()
        if lesson_count == 0 or student_count == 0:
            rows.append({'name': group.name, 'count': student_count, 'score': 0, 'att': 0})
            continue
        total_score   = Score.objects.filter(lesson__in=lessons).aggregate(t=Sum('value'))['t'] or 0
        total_present = Attendance.objects.filter(lesson__in=lessons, present=True).count()
        max_score     = lesson_count * student_count * 5
        max_att       = lesson_count * student_count
        rows.append({
            'name':  group.name,
            'count': student_count,
            'score': round(total_score / max_score * 100),
            'att':   round(total_present / max_att * 100),
        })
    return rows


def _teacher_struggling(user):
    from groups.models import Group, GroupMembership, Score, Attendance
    from django.db.models import Sum
    groups = list(Group.objects.filter(teacher=user))
    struggling = []
    for group in groups:
        lessons      = group.lessons.all()
        lesson_count = lessons.count()
        if lesson_count == 0:
            continue
        for m in GroupMembership.objects.filter(group=group).select_related('student'):
            student   = m.student
            score_sum = Score.objects.filter(lesson__in=lessons, student=student).aggregate(t=Sum('value'))['t'] or 0
            present   = Attendance.objects.filter(lesson__in=lessons, student=student, present=True).count()
            score_pct = round(score_sum / (lesson_count * 5) * 100)
            att_pct   = round(present / lesson_count * 100)
            if score_pct < 50 or att_pct < 60:
                name = f'{student.first_name} {student.last_name}'.strip() or student.username
                struggling.append({'name': name, 'group': group.name, 'score': score_pct, 'att': att_pct})
    return struggling


def _admin_stats():
    from users.models import User
    return {
        'teachers': User.objects.filter(role='teacher').count(),
        'students': User.objects.filter(role='student').count(),
    }


# ── Handlers ───────────────────────────────────────────────────────────────────

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    if context.args:
        context.user_data['pending_token'] = context.args[0]
    telegram_id = update.effective_user.id
    user = await sync_to_async(_get_user)(telegram_id)
    if user and user.telegram_lang:
        context.user_data['lang'] = user.telegram_lang
    await update.message.reply_text(MSG['uz']['choose_lang'], reply_markup=LANG_KEYBOARD)


async def language_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    lang        = query.data.split('_')[1]
    context.user_data['lang'] = lang
    telegram_id = query.from_user.id
    first_name  = query.from_user.first_name or ''

    user = await sync_to_async(_get_user)(telegram_id)
    if user:
        user.telegram_lang = lang
        await sync_to_async(user.save)(update_fields=['telegram_lang'])

    pending_token = context.user_data.pop('pending_token', None)
    if pending_token:
        await _process_connect(query, telegram_id, lang, pending_token)
        return

    m = MSG[lang]
    if not user:
        text = m['welcome_unlinked'].format(name=first_name)
    elif user.role == 'student':
        text = m['welcome_student'].format(name=first_name)
    elif user.role == 'teacher':
        text = m['welcome_teacher'].format(name=first_name)
    elif user.role == 'admin':
        text = m['welcome_admin'].format(name=first_name)
    elif user.role == 'parent':
        text = m['welcome_parent'].format(name=first_name)
    else:
        text = m['welcome_other'].format(name=first_name)
    await query.edit_message_text(text)
    if user:
        await _set_user_commands(query.get_bot(), telegram_id, user.role)
        kb = _get_reply_keyboard(user.role, lang)
        if kb:
            menu_label = '👇 Menyu:' if lang == 'uz' else '👇 Меню:'
            await context.bot.send_message(chat_id=query.message.chat_id, text=menu_label, reply_markup=kb)


async def _set_user_commands(bot, telegram_id: int, role: str):
    from telegram import BotCommandScopeChat
    u = BotCommand('username', "Usernameni ko'rish / Мой логин")
    h = BotCommand('help',     'Yordam / Помощь')

    commands = [BotCommand(cmd, desc) for cmd, desc in ROLE_COMMANDS.get(role, [])] + [u, h]
    try:
        await bot.set_my_commands(commands, scope=BotCommandScopeChat(chat_id=telegram_id))
    except Exception as e:
        logger.warning('Could not set user commands for %s: %s', telegram_id, e)


async def _process_connect(query, telegram_id: int, lang: str, token_str: str):
    from users.models import TelegramConnectToken, User
    try:
        token_obj = await sync_to_async(
            TelegramConnectToken.objects.select_related('user').get
        )(token=token_str)
    except TelegramConnectToken.DoesNotExist:
        await query.edit_message_text(MSG[lang]['invalid_link'])
        return

    if token_obj.is_expired():
        await sync_to_async(token_obj.delete)()
        await query.edit_message_text(MSG[lang]['expired_link'])
        return

    user = token_obj.user
    already_taken = await sync_to_async(
        User.objects.filter(telegram_id=telegram_id).exclude(pk=user.pk).exists
    )()
    if already_taken:
        await query.edit_message_text(MSG[lang]['already_taken'])
        return

    user.telegram_id   = telegram_id
    user.telegram_lang = lang
    await sync_to_async(user.save)(update_fields=['telegram_id', 'telegram_lang'])
    await sync_to_async(token_obj.delete)()

    first_name = query.from_user.first_name or ''
    m = MSG[lang]
    if user.role == 'student':
        text = m['welcome_student'].format(name=first_name)
    elif user.role == 'teacher':
        text = m['welcome_teacher'].format(name=first_name)
    elif user.role == 'admin':
        text = m['welcome_admin'].format(name=first_name)
    elif user.role == 'parent':
        text = m['welcome_parent'].format(name=first_name)
    else:
        text = m['welcome_other'].format(name=first_name)

    await query.edit_message_text(text)
    await _set_user_commands(query.get_bot(), telegram_id, user.role)
    kb = _get_reply_keyboard(user.role, lang)
    if kb:
        menu_label = '👇 Menyu:' if lang == 'uz' else '👇 Меню:'
        await query.get_bot().send_message(chat_id=query.message.chat_id, text=menu_label, reply_markup=kb)


# ── /mystats ───────────────────────────────────────────────────────────────────

async def mystats(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    user = await sync_to_async(_get_user)(telegram_id)
    lang = (user.telegram_lang if user else None) or 'uz'
    m    = MSG[lang]

    if not user:
        await update.message.reply_text(m['not_linked'])
        return

    if user.role == 'student':
        rows = await sync_to_async(_student_stats)(user)
        if not rows:
            await update.message.reply_text(m['no_data'])
            return
        text = m['stats_header_student']
        for r in rows:
            text += m['stats_group'].format(
                group=r['group'], attendance=r['attendance'], score=r['score']
            )

    elif user.role == 'parent':
        children = await sync_to_async(_parent_stats)(user)
        if not children:
            await update.message.reply_text(m['no_data'])
            return
        text = m['stats_header_parent']
        for c in children:
            text += m['stats_child'].format(name=c['name'])
            if c['stats']:
                for r in c['stats']:
                    text += m['stats_group'].format(
                        group=r['group'], attendance=r['attendance'], score=r['score']
                    )
            else:
                text += m['stats_no_groups']
    else:
        await update.message.reply_text(m['no_data'])
        return

    await update.message.reply_text(text, parse_mode='Markdown')


# ── /myrank ────────────────────────────────────────────────────────────────────

async def myrank(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    user = await sync_to_async(_get_user)(telegram_id)
    lang = (user.telegram_lang if user else None) or 'uz'
    m    = MSG[lang]

    if not user:
        await update.message.reply_text(m['not_linked'])
        return
    if user.role != 'student':
        await update.message.reply_text(m['no_data'])
        return

    rows = await sync_to_async(_student_rank)(user)
    if not rows:
        await update.message.reply_text(m['rank_no_data'])
        return

    text = m['rank_header']
    for r in rows:
        text += m['rank_item'].format(**r)
    await update.message.reply_text(text, parse_mode='Markdown')


# ── /homework ──────────────────────────────────────────────────────────────────

async def homework_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    user = await sync_to_async(_get_user)(telegram_id)
    lang = (user.telegram_lang if user else None) or 'uz'
    m    = MSG[lang]

    if not user:
        await update.message.reply_text(m['not_linked'])
        return
    if user.role != 'student':
        await update.message.reply_text(m['no_data'])
        return

    items = await sync_to_async(_student_homework)(user)
    if not items:
        await update.message.reply_text(m['homework_none'])
        return

    text = m['homework_header']
    for item in items:
        if item['lesson'] is None:
            text += m['homework_no_lesson'].format(group=item['group'])
        elif item['homework'] is None:
            text += m['homework_not_set'].format(group=item['group'], lesson=item['lesson'])
        else:
            text += m['homework_item'].format(
                group=item['group'], lesson=item['lesson'], homework=item['homework']
            )
    await update.message.reply_text(text, parse_mode='Markdown')


# ── /mygroups (teacher) ────────────────────────────────────────────────────────

async def mygroups(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    user = await sync_to_async(_get_user)(telegram_id)
    lang = (user.telegram_lang if user else None) or 'uz'
    m    = MSG[lang]

    if not user:
        await update.message.reply_text(m['not_linked'])
        return
    if user.role not in ('teacher', 'admin'):
        await update.message.reply_text(m['no_data'])
        return

    rows = await sync_to_async(_teacher_groups)(user)
    if not rows:
        await update.message.reply_text(m['groups_none'])
        return

    text = m['groups_header']
    for r in rows:
        text += m['groups_item'].format(**r)
    await update.message.reply_text(text, parse_mode='Markdown')


# ── /struggling (teacher) ──────────────────────────────────────────────────────

async def struggling(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    user = await sync_to_async(_get_user)(telegram_id)
    lang = (user.telegram_lang if user else None) or 'uz'
    m    = MSG[lang]

    if not user:
        await update.message.reply_text(m['not_linked'])
        return
    if user.role not in ('teacher', 'admin'):
        await update.message.reply_text(m['no_data'])
        return

    rows = await sync_to_async(_teacher_struggling)(user)
    if not rows:
        await update.message.reply_text(m['struggling_none'])
        return

    text = m['struggling_header']
    for r in rows:
        text += m['struggling_item'].format(**r)
    await update.message.reply_text(text, parse_mode='Markdown')


# ── /lessons (parent) ─────────────────────────────────────────────────────────

async def lessons_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    user = await sync_to_async(_get_user)(telegram_id)
    lang = (user.telegram_lang if user else None) or 'uz'
    m    = MSG[lang]

    if not user:
        await update.message.reply_text(m['not_linked'])
        return
    if user.role != 'parent':
        await update.message.reply_text(m['no_data'])
        return

    limit = 5
    if context.args:
        try:
            limit = max(1, min(int(context.args[0]), 50))
        except ValueError:
            pass

    children_data = await sync_to_async(_parent_recent_lessons)(user, limit)
    if not children_data:
        await update.message.reply_text(m['no_data'])
        return

    total_all = sum(c['total'] for c in children_data)
    shown_all = sum(c['shown'] for c in children_data)
    text = m['lessons_header'].format(shown=shown_all, total=total_all)
    for child in children_data:
        text += m['lessons_child'].format(name=child['name'], group=child['group'])
        if child['lessons']:
            for lesson in child['lessons']:
                text += m['lessons_item'].format(**lesson)
        else:
            text += m['lessons_none']
    if shown_all < total_all:
        text += m['lessons_tip']
    await update.message.reply_text(text, parse_mode='Markdown')


# ── /academy (admin) ──────────────────────────────────────────────────────────

async def academy_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    user = await sync_to_async(_get_user)(telegram_id)
    lang = (user.telegram_lang if user else None) or 'uz'
    m    = MSG[lang]

    if not user:
        await update.message.reply_text(m['not_linked'])
        return
    if user.role != 'admin':
        await update.message.reply_text(m['no_data'])
        return

    stats = await sync_to_async(_admin_stats)()
    await update.message.reply_text(m['academy_stats'].format(**stats), parse_mode='Markdown')


# ── /help ─────────────────────────────────────────────────────────────────────

async def help_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    user = await sync_to_async(_get_user)(telegram_id)
    lang = (user.telegram_lang if user else None) or 'uz'
    m    = MSG[lang]

    if not user:
        key = 'help_other'
    elif user.role == 'student':
        key = 'help_student'
    elif user.role == 'teacher':
        key = 'help_teacher'
    elif user.role == 'admin':
        key = 'help_admin'
    elif user.role == 'parent':
        key = 'help_parent'
    else:
        key = 'help_other'

    await update.message.reply_text(m[key], parse_mode='Markdown')


# ── /username ─────────────────────────────────────────────────────────────────

async def username_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    user = await sync_to_async(_get_user)(telegram_id)

    if not user:
        await update.message.reply_text(
            "❌ Hisobingiz ulanmagan.\n"
            "Journaly Profilingizga o'ting va Telegramni ulang."
        )
        return

    await update.message.reply_text(
        f"👤 Sizning username ingiz:\n\n`{user.username}`\n\n"
        "Parolni tiklash uchun saytdagi «Forgot password» sahifasiga o'ting va shu username ni kiriting.",
        parse_mode='Markdown',
    )


# ── Menu button handler ───────────────────────────────────────────────────────

async def menu_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    awaiting = context.user_data.get('awaiting')
    if awaiting == 'nl_date':
        await _handle_nl_custom_date(update, context)
        return
    if awaiting == 'hol_date':
        await _handle_hol_custom_date(update, context)
        return

    action = BUTTON_ACTIONS.get(update.message.text)
    if action == 'mystats':
        await mystats(update, context)
    elif action == 'myrank':
        await myrank(update, context)
    elif action == 'homework':
        await homework_cmd(update, context)
    elif action == 'mygroups':
        await mygroups(update, context)
    elif action == 'struggling':
        await struggling(update, context)
    elif action == 'academy':
        await academy_cmd(update, context)
    elif action == 'dailyreport':
        await dailyreport_cmd(update, context)
    elif action == 'lessons':
        await lessons_cmd(update, context)
    elif action == 'nolesson':
        await nolesson_cmd(update, context)
    elif action == 'holiday':
        await holiday_cmd(update, context)
    elif action == 'help':
        await help_cmd(update, context)


# ── OTP sender ────────────────────────────────────────────────────────────────

async def send_otp(telegram_id: int, code: str, lang: str = 'uz'):
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    if not bot_token:
        raise RuntimeError('TELEGRAM_BOT_TOKEN is not set')
    bot = Bot(token=bot_token)
    await bot.send_message(
        chat_id=telegram_id,
        text=MSG.get(lang, MSG['uz'])['otp'].format(code=code),
        parse_mode='Markdown',
    )


# ── Notification sender ───────────────────────────────────────────────────────

NOTIF_MSG = {
    'uz': {
        'score':                    "📊 *{lesson}* darsida *{score}/5* ball oldingiz ({group})",
        'absent':                   "⚠️ *{lesson}* darsida qatnashmagansiz ({group})",
        'score_parent':             "📊 *{name}*: *{lesson}* darsida *{score}/5* ball oldi ({group})",
        'absent_parent':            "⚠️ *{name}*: *{lesson}* darsida qatnashmadi ({group})",
        'student_present_scored':   "✅ *{lesson}* darsida qatnashdingiz.\n⭐ Balingiz: *{score}/5* | {group}{coin_line}",
        'student_present_unscored': "✅ *{lesson}* darsida qatnashdingiz. | {group}{coin_line}",
        'student_absent_scored':    "⚠️ *{lesson}* darsiga kelmadingiz.\n⭐ Balingiz: *{score}/5* | {group}{coin_line}",
        'student_absent_unscored':  "⚠️ *{lesson}* darsiga kelmadingiz. | {group}{coin_line}",
        'parent_present_scored':    "✅ *{name}* *{lesson}* darsida qatnashdi.\n⭐ Ball: *{score}/5* | {group}{coin_line}",
        'parent_present_unscored':  "✅ *{name}* *{lesson}* darsida qatnashdi. | {group}{coin_line}",
        'parent_absent_scored':     "⚠️ *{name}* *{lesson}* darsiga kelmadi.\n⭐ Ball: *{score}/5* | {group}{coin_line}",
        'parent_absent_unscored':   "⚠️ *{name}* *{lesson}* darsiga kelmadi. | {group}{coin_line}",
        'coin_line':                "\n🪙 +{coins} tangacha (jami: {balance})",
        'hw_notification':          "📝 *{lesson}* darsi uchun uy vazifasi ({group}):\n\n{homework}",
        'announcement':             "📌 *E'lon:* {title}\n\n{body}",
        'announcement_group':       "📌 *E'lon ({group}):* {title}\n\n{body}",
        'direct_message':           "📩 *{sender}* sizga xabar yubordi:\n\n{message}",
        'direct_message_parent':    "📩 *{sender}* — *{student}* haqida xabar:\n\n{message}",

        # ── Exam results ────────────────────────────────────────────────────
        'exam_result':              "📝 *{exam}* — imtihon natijasi\n📚 {group}\n\n✅ Natija: *{total}/{max}* ({pct}%)\n\n{breakdown}\n\n#exam",
        'exam_result_absent':       "📝 *{exam}* — imtihon natijasi\n📚 {group}\n\n⚠️ Siz imtihonda qatnashmadingiz.\n\n#exam",
        'exam_result_parent':       "📝 *{name}* — *{exam}* imtihon natijasi\n📚 {group}\n\n✅ Natija: *{total}/{max}* ({pct}%)\n\n{breakdown}\n\n#exam",
        'exam_result_parent_absent': "📝 *{name}* — *{exam}* imtihon natijasi\n📚 {group}\n\n⚠️ {name} imtihonda qatnashmadi.\n\n#exam",
    },
    'ru': {
        'score':                    "📊 Вы получили *{score}/5* в уроке «{lesson}» ({group})",
        'absent':                   "⚠️ Вы отсутствовали на уроке «{lesson}» ({group})",
        'score_parent':             "📊 *{name}*: получил(а) *{score}/5* в уроке «{lesson}» ({group})",
        'absent_parent':            "⚠️ *{name}*: отсутствовал(а) на уроке «{lesson}» ({group})",
        'student_present_scored':   "✅ Вы посетили урок *{lesson}*.\n⭐ Ваша оценка: *{score}/5* | {group}{coin_line}",
        'student_present_unscored': "✅ Вы посетили урок *{lesson}*. | {group}{coin_line}",
        'student_absent_scored':    "⚠️ Вы пропустили урок *{lesson}*.\n⭐ Ваша оценка: *{score}/5* | {group}{coin_line}",
        'student_absent_unscored':  "⚠️ Вы пропустили урок *{lesson}*. | {group}{coin_line}",
        'parent_present_scored':    "✅ *{name}* посетил(а) урок *{lesson}*.\n⭐ Оценка: *{score}/5* | {group}{coin_line}",
        'parent_present_unscored':  "✅ *{name}* посетил(а) урок *{lesson}*. | {group}{coin_line}",
        'parent_absent_scored':     "⚠️ *{name}* пропустил(а) урок *{lesson}*.\n⭐ Оценка: *{score}/5* | {group}{coin_line}",
        'parent_absent_unscored':   "⚠️ *{name}* пропустил(а) урок *{lesson}*. | {group}{coin_line}",
        'coin_line':                "\n🪙 +{coins} монет (всего: {balance})",
        'hw_notification':          "📝 Домашнее задание по уроку *{lesson}* ({group}):\n\n{homework}",
        'announcement':             "📌 *Объявление:* {title}\n\n{body}",
        'announcement_group':       "📌 *Объявление ({group}):* {title}\n\n{body}",
        'direct_message':           "📩 *{sender}* отправил(а) вам сообщение:\n\n{message}",
        'direct_message_parent':    "📩 *{sender}* — сообщение о *{student}*:\n\n{message}",

        # ── Exam results ────────────────────────────────────────────────────
        'exam_result':              "📝 *{exam}* — результат экзамена\n📚 {group}\n\n✅ Результат: *{total}/{max}* ({pct}%)\n\n{breakdown}\n\n#exam",
        'exam_result_absent':       "📝 *{exam}* — результат экзамена\n📚 {group}\n\n⚠️ Вы не присутствовали на экзамене.\n\n#exam",
        'exam_result_parent':       "📝 *{name}* — результат экзамена *{exam}*\n📚 {group}\n\n✅ Результат: *{total}/{max}* ({pct}%)\n\n{breakdown}\n\n#exam",
        'exam_result_parent_absent': "📝 *{name}* — результат экзамена *{exam}*\n📚 {group}\n\n⚠️ {name} не присутствовал(а) на экзамене.\n\n#exam",
    },
}


async def send_notification(telegram_id: int, msg_key: str, lang: str = 'uz', **kwargs):
    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    if not bot_token:
        return
    msgs = NOTIF_MSG.get(lang, NOTIF_MSG['uz'])
    text = msgs.get(msg_key, '').format(**kwargs)
    if not text:
        return
    bot = Bot(token=bot_token)
    try:
        await bot.send_message(chat_id=telegram_id, text=text, parse_mode='Markdown')
    except Exception as e:
        logger.error('Telegram notification error: %s', e)


def render_coin_line(lang: str, coins: int, balance: int) -> str:
    """Renders the '+N coins (balance: M)' suffix appended to attendance/
    score notifications, or '' if no coins were earned this lesson."""
    if coins <= 0:
        return ''
    msgs = NOTIF_MSG.get(lang, NOTIF_MSG['uz'])
    return msgs.get('coin_line', '').format(coins=coins, balance=balance)


# ── Application singleton ─────────────────────────────────────────────────────

async def chatid_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat = update.effective_chat
    if chat.type == 'private':
        await update.message.reply_text(
            "Bu buyruq faqat guruhlarda ishlaydi.\n"
            "Botni guruhga qo'shing va o'sha guruhda /chatid yuboring."
        )
        return
    await update.message.reply_text(
        f"Bu guruhning Chat ID si:\n`{chat.id}`\n\n"
        "Journaly Settings → Telegram guruhlar bo'limiga shu raqamni kiriting.",
        parse_mode='Markdown',
    )


def _get_academy_tg_group(chat_id):
    from academies.models import AcademyTelegramGroup
    return AcademyTelegramGroup.objects.filter(chat_id=chat_id).select_related('academy').first()


# ── /nolesson & /holiday ─────────────────────────────────────────────────────

def _parse_short_date(text):
    parts = text.strip().replace('/', '.').replace('-', '.').split('.')
    if len(parts) < 2:
        return None
    try:
        day, month = int(parts[0]), int(parts[1])
        today = timezone.localdate()
        d = date_cls(today.year, month, day)
        if d < today:
            d = date_cls(today.year + 1, month, day)
        return d
    except (ValueError, IndexError):
        return None


def _date_keyboard(prefix, lang):
    m = MSG[lang]
    return InlineKeyboardMarkup([
        [
            InlineKeyboardButton(m['date_today'],    callback_data=f'{prefix}_date_today'),
            InlineKeyboardButton(m['date_tomorrow'], callback_data=f'{prefix}_date_tomorrow'),
        ],
        [InlineKeyboardButton(m['date_custom'], callback_data=f'{prefix}_date_custom')],
        [InlineKeyboardButton(m['cancel_btn'],  callback_data=f'{prefix}_cancel')],
    ])


def _nl_group_keyboard(groups, lang):
    rows = [[InlineKeyboardButton(g.name, callback_data=f'nl_group_{g.id}')] for g in groups]
    rows.append([InlineKeyboardButton(MSG[lang]['cancel_btn'], callback_data='nl_cancel')])
    return InlineKeyboardMarkup(rows)


def _nl_reason_keyboard(lang):
    m = MSG[lang]
    return InlineKeyboardMarkup([
        [InlineKeyboardButton(m['reason_sick'],    callback_data='nl_reason_sick')],
        [InlineKeyboardButton(m['reason_holiday'], callback_data='nl_reason_holiday')],
        [InlineKeyboardButton(m['reason_other'],   callback_data='nl_reason_other')],
    ])


def _hol_confirm_keyboard(lang):
    m = MSG[lang]
    return InlineKeyboardMarkup([[
        InlineKeyboardButton(m['hol_confirm_yes'], callback_data='hol_confirm'),
        InlineKeyboardButton(m['cancel_btn'],      callback_data='hol_cancel'),
    ]])


def _teacher_groups_for_date(telegram_id, target_date):
    from groups.models import Group, GroupDayOff
    user = _get_user(telegram_id)
    if not user:
        return []
    weekday = target_date.weekday()
    already = set(
        GroupDayOff.objects.filter(date=target_date, group__teacher=user).values_list('group_id', flat=True)
    )
    return [
        g for g in Group.objects.filter(teacher=user, is_graduated=False)
        if isinstance(g.class_days, list) and weekday in g.class_days and g.id not in already
    ]


async def _nolesson_show_groups(reply_fn, telegram_id, target_date, lang, context):
    m = MSG[lang]
    groups = await sync_to_async(_teacher_groups_for_date)(telegram_id, target_date)
    if not groups:
        await reply_fn(m['nl_no_groups'])
        context.user_data.pop('nl_flow', None)
        return
    context.user_data['nl_flow'] = {'lang': lang, 'date': target_date.isoformat()}
    await reply_fn(
        m['nl_ask_group'].format(date=target_date.strftime('%d.%m.%Y')),
        reply_markup=_nl_group_keyboard(groups, lang),
        parse_mode='Markdown',
    )


async def nolesson_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    user = await sync_to_async(_get_user)(telegram_id)
    lang = (user.telegram_lang if user else None) or 'uz'
    m = MSG[lang]
    if not user or user.role not in ('teacher', 'admin'):
        await update.message.reply_text(m['no_data'])
        return
    context.user_data['nl_flow'] = {'lang': lang}
    await update.message.reply_text(m['nl_ask_date'], reply_markup=_date_keyboard('nl', lang), parse_mode='Markdown')


async def nolesson_date_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    flow = context.user_data.get('nl_flow')
    if flow is None:
        return
    lang = flow.get('lang', 'uz')
    m = MSG[lang]
    choice = query.data.split('_')[-1]
    if choice == 'custom':
        context.user_data['awaiting'] = 'nl_date'
        await query.edit_message_text(m['nl_ask_custom_date'])
        return
    target_date = timezone.localdate() if choice == 'today' else timezone.localdate() + timedelta(days=1)
    await _nolesson_show_groups(query.edit_message_text, query.from_user.id, target_date, lang, context)


async def nolesson_group_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    flow = context.user_data.get('nl_flow')
    if not flow or 'date' not in flow:
        return
    lang = flow.get('lang', 'uz')
    flow['group_id'] = int(query.data.split('_')[-1])
    context.user_data['nl_flow'] = flow
    await query.edit_message_text(MSG[lang]['nl_ask_reason'], reply_markup=_nl_reason_keyboard(lang))


def _create_day_off(telegram_id, group_id, target_date, reason):
    from groups.models import Group, GroupDayOff
    user = _get_user(telegram_id)
    group = Group.objects.get(id=group_id)
    obj, created = GroupDayOff.objects.get_or_create(
        group=group, date=target_date,
        defaults={'reason': reason, 'created_by': user},
    )
    return group.name, created


async def nolesson_reason_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    flow = context.user_data.pop('nl_flow', None)
    if not flow or 'group_id' not in flow or 'date' not in flow:
        return
    lang = flow.get('lang', 'uz')
    m = MSG[lang]
    reason = query.data.split('_')[-1]
    target_date = date_cls.fromisoformat(flow['date'])

    group_name, created = await sync_to_async(_create_day_off)(
        query.from_user.id, flow['group_id'], target_date, reason
    )
    date_str = target_date.strftime('%d.%m.%Y')
    if created:
        await query.edit_message_text(m['nl_done'].format(group=group_name, date=date_str), parse_mode='Markdown')
    else:
        await query.edit_message_text(m['nl_already'].format(date=date_str), parse_mode='Markdown')


async def nolesson_cancel_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    flow = context.user_data.pop('nl_flow', None)
    context.user_data.pop('awaiting', None)
    lang = (flow or {}).get('lang', 'uz')
    await query.edit_message_text(MSG[lang]['nl_cancelled'])


async def _handle_nl_custom_date(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.pop('awaiting', None)
    flow = context.user_data.get('nl_flow') or {}
    lang = flow.get('lang', 'uz')
    m = MSG[lang]
    target_date = _parse_short_date(update.message.text)
    if not target_date:
        context.user_data['awaiting'] = 'nl_date'
        await update.message.reply_text(m['nl_bad_date'])
        return
    await _nolesson_show_groups(update.message.reply_text, update.effective_user.id, target_date, lang, context)


async def holiday_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    user = await sync_to_async(_get_user)(telegram_id)
    lang = (user.telegram_lang if user else None) or 'uz'
    m = MSG[lang]
    if not user or user.role != 'admin':
        await update.message.reply_text(m['hol_admin_only'])
        return
    context.user_data['hol_flow'] = {'lang': lang}
    await update.message.reply_text(m['hol_ask_date'], reply_markup=_date_keyboard('hol', lang), parse_mode='Markdown')


async def holiday_date_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    flow = context.user_data.get('hol_flow')
    if flow is None:
        return
    lang = flow.get('lang', 'uz')
    m = MSG[lang]
    choice = query.data.split('_')[-1]
    if choice == 'custom':
        context.user_data['awaiting'] = 'hol_date'
        await query.edit_message_text(m['nl_ask_custom_date'])
        return
    target_date = timezone.localdate() if choice == 'today' else timezone.localdate() + timedelta(days=1)
    context.user_data['hol_flow'] = {'lang': lang, 'date': target_date.isoformat()}
    await query.edit_message_text(
        m['hol_confirm'].format(date=target_date.strftime('%d.%m.%Y')),
        reply_markup=_hol_confirm_keyboard(lang), parse_mode='Markdown',
    )


async def _handle_hol_custom_date(update: Update, context: ContextTypes.DEFAULT_TYPE):
    context.user_data.pop('awaiting', None)
    flow = context.user_data.get('hol_flow') or {}
    lang = flow.get('lang', 'uz')
    m = MSG[lang]
    target_date = _parse_short_date(update.message.text)
    if not target_date:
        context.user_data['awaiting'] = 'hol_date'
        await update.message.reply_text(m['nl_bad_date'])
        return
    context.user_data['hol_flow'] = {'lang': lang, 'date': target_date.isoformat()}
    await update.message.reply_text(
        m['hol_confirm'].format(date=target_date.strftime('%d.%m.%Y')),
        reply_markup=_hol_confirm_keyboard(lang), parse_mode='Markdown',
    )


def _create_academy_holiday(telegram_id, target_date):
    from groups.models import Group, GroupDayOff
    user = _get_user(telegram_id)
    if not user or not user.academy_id:
        return 0
    groups = Group.objects.filter(teacher__academy_id=user.academy_id, is_graduated=False)
    count = 0
    for g in groups:
        _, created = GroupDayOff.objects.get_or_create(
            group=g, date=target_date,
            defaults={'reason': 'holiday', 'created_by': user},
        )
        if created:
            count += 1
    return count


async def holiday_confirm_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    flow = context.user_data.pop('hol_flow', None)
    if not flow or 'date' not in flow:
        return
    lang = flow.get('lang', 'uz')
    m = MSG[lang]
    target_date = date_cls.fromisoformat(flow['date'])
    count = await sync_to_async(_create_academy_holiday)(query.from_user.id, target_date)
    await query.edit_message_text(
        m['hol_done'].format(date=target_date.strftime('%d.%m.%Y'), count=count), parse_mode='Markdown'
    )


async def holiday_cancel_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    flow = context.user_data.pop('hol_flow', None)
    context.user_data.pop('awaiting', None)
    lang = (flow or {}).get('lang', 'uz')
    await query.edit_message_text(MSG[lang]['hol_cancelled'])


async def dailyreport_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat = update.effective_chat
    from users.management.commands.send_daily_report import run_report_for_academy

    if chat.type == 'private':
        telegram_id = update.effective_user.id
        user = await sync_to_async(_get_user)(telegram_id)
        if not user or user.role != 'admin' or not user.academy_id:
            await update.message.reply_text(
                "Bu buyruq faqat admin uchun.\n"
                "Hisobingizni ulang yoki admin huquqini oling."
            )
            return
        def _get_admin_academy(user_id):
            from users.models import User
            u = User.objects.select_related('academy').get(id=user_id)
            return u.academy
        try:
            academy = await sync_to_async(_get_admin_academy)(user.id)
            await sync_to_async(run_report_for_academy)(academy, only_chat_id=chat.id)
        except Exception as e:
            logger.error('dailyreport_cmd (private) error: %s', e)
            await update.message.reply_text("❌ Hisobotni yuborishda xatolik yuz berdi.")
        return

    tg = await sync_to_async(_get_academy_tg_group)(chat.id)
    if not tg:
        await update.message.reply_text(
            "Bu guruh hech qaysi akademiyaga bog'lanmagan.\n"
            "Journaly → Settings → Telegram guruhlar bo'limida shu guruhni qo'shing."
        )
        return

    try:
        academy = tg.academy
        await sync_to_async(run_report_for_academy)(academy, only_chat_id=chat.id)
        await update.message.reply_text("✅ Kunlik hisobot yuborildi.")
    except Exception as e:
        logger.error('dailyreport_cmd error: %s', e)
        await update.message.reply_text("❌ Hisobotni yuborishda xatolik yuz berdi.")


_application = None


def get_application():
    global _application
    if _application is not None:
        return _application

    from asgiref.sync import async_to_sync

    bot_token = os.environ.get('TELEGRAM_BOT_TOKEN')
    if not bot_token:
        raise RuntimeError('TELEGRAM_BOT_TOKEN is not set')

    app = ApplicationBuilder().token(bot_token).build()

    private = filters.ChatType.PRIVATE

    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND & filters.ChatType.PRIVATE, menu_handler))
    app.add_handler(CommandHandler('start',      start,       filters=private))
    app.add_handler(CommandHandler('mystats',    mystats,     filters=private))
    app.add_handler(CommandHandler('myrank',     myrank,      filters=private))
    app.add_handler(CommandHandler('homework',   homework_cmd, filters=private))
    app.add_handler(CommandHandler('mygroups',   mygroups,    filters=private))
    app.add_handler(CommandHandler('struggling', struggling,  filters=private))
    app.add_handler(CommandHandler('lessons',    lessons_cmd, filters=private))
    app.add_handler(CommandHandler('academy',    academy_cmd,  filters=private))
    app.add_handler(CommandHandler('username',   username_cmd, filters=private))
    app.add_handler(CommandHandler('help',       help_cmd,     filters=private))
    app.add_handler(CommandHandler('chatid',      chatid_cmd))
    app.add_handler(CommandHandler('dailyreport', dailyreport_cmd))
    app.add_handler(CommandHandler('nolesson',    nolesson_cmd, filters=private))
    app.add_handler(CommandHandler('holiday',     holiday_cmd,  filters=private))
    app.add_handler(CallbackQueryHandler(language_callback, pattern=r'^lang_(uz|ru)$'))
    app.add_handler(CallbackQueryHandler(nolesson_date_callback,   pattern=r'^nl_date_(today|tomorrow|custom)$'))
    app.add_handler(CallbackQueryHandler(nolesson_group_callback,  pattern=r'^nl_group_\d+$'))
    app.add_handler(CallbackQueryHandler(nolesson_reason_callback, pattern=r'^nl_reason_(sick|holiday|other)$'))
    app.add_handler(CallbackQueryHandler(nolesson_cancel_callback, pattern=r'^nl_cancel$'))
    app.add_handler(CallbackQueryHandler(holiday_date_callback,    pattern=r'^hol_date_(today|tomorrow|custom)$'))
    app.add_handler(CallbackQueryHandler(holiday_confirm_callback, pattern=r'^hol_confirm$'))
    app.add_handler(CallbackQueryHandler(holiday_cancel_callback,  pattern=r'^hol_cancel$'))

    async_to_sync(app.initialize)()

    async def _set_commands():
        from telegram import BotCommandScopeAllGroupChats
        # Default commands for users who haven't linked yet
        await app.bot.set_my_commands([
            BotCommand('start',    'Boshlash / Начать'),
            BotCommand('username', "Usernameni ko'rish / Мой логин"),
            BotCommand('help',     'Yordam / Помощь'),
        ])
        # Group-only commands
        await app.bot.set_my_commands([
            BotCommand('dailyreport', "Kunlik hisobot / Ежедневный отчёт"),
        ], scope=BotCommandScopeAllGroupChats())
    try:
        async_to_sync(_set_commands)()
    except Exception as e:
        logger.warning('Could not set bot commands: %s', e)

    _application = app
    return _application
