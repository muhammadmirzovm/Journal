import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from academies.models import Academy
from groups.models import Group, Lesson, Attendance, GroupDayOff

User = get_user_model()


@pytest.fixture
def academy(db):
    return Academy.objects.create(name='Test Academy', slug='test-academy')


@pytest.fixture
def teacher(academy):
    return User.objects.create_user(
        username='teacher1', password='pass1234', role='teacher', academy=academy,
    )


@pytest.fixture
def student(academy):
    return User.objects.create_user(
        username='student1', password='pass1234', role='student', academy=academy,
    )


@pytest.fixture
def teacher_client(teacher):
    client = APIClient()
    res = client.post('/api/auth/login/', {'username': 'teacher1', 'password': 'pass1234'})
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {res.data["access"]}')
    return client


@pytest.fixture
def group(teacher):
    return Group.objects.create(name='Math', teacher=teacher, class_days=[0, 2, 4])


@pytest.mark.django_db
def test_create_group(teacher_client):
    res = teacher_client.post('/api/groups/', {
        'name': 'Physics', 'class_days': [1, 3],
    })
    assert res.status_code == 201
    assert Group.objects.filter(name='Physics').exists()


@pytest.mark.django_db
def test_list_groups(teacher_client, group):
    res = teacher_client.get('/api/groups/')
    assert res.status_code == 200
    assert any(g['name'] == 'Math' for g in res.data)


@pytest.mark.django_db
def test_create_lesson(teacher_client, group):
    res = teacher_client.post(f'/api/groups/{group.id}/lessons/', {
        'title': 'Lesson 1', 'date': '2026-05-25', 'homework': '',
    })
    assert res.status_code == 201
    assert Lesson.objects.filter(title='Lesson 1').exists()


@pytest.mark.django_db
def test_attendance_saved(teacher_client, group, student):
    from groups.models import GroupMembership
    GroupMembership.objects.create(group=group, student=student)
    lesson = Lesson.objects.create(group=group, title='L1', date='2026-05-25')
    Attendance.objects.create(lesson=lesson, student=student, present=False)

    res = teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/attendance/', {
        'records': [{'student': student.id, 'present': True}]
    }, format='json')
    assert res.status_code == 200
    assert Attendance.objects.get(lesson=lesson, student=student).present is True


@pytest.mark.django_db
def test_exam_autosave_persists_without_finishing_or_notifying(teacher_client, group, student, monkeypatch):
    from groups.models import GroupMembership, Exam

    GroupMembership.objects.create(group=group, student=student)
    exam = Exam.objects.create(group=group, name='Midterm', question_count=3, status=Exam.ACTIVE)

    notified = []
    monkeypatch.setattr('groups.views._notify_exam_finished', lambda *a, **k: notified.append(a))

    res = teacher_client.post(f'/api/groups/{group.id}/exams/{exam.id}/submit/', {
        'results': [{'student': student.id, 'scores': [4, 5, 3], 'comments': ['', '', '']}],
        'finish': False,
    }, format='json')
    assert res.status_code == 200

    exam.refresh_from_db()
    assert exam.status == Exam.ACTIVE  # autosave must not finish the exam
    assert notified == []  # and must not notify students/parents

    result = exam.results.get(student=student)
    assert result.scores == [4, 5, 3]  # but the scores are actually persisted


@pytest.mark.django_db
def test_exam_finish_marks_finished_and_notifies(teacher_client, group, student, monkeypatch):
    from groups.models import GroupMembership, Exam

    GroupMembership.objects.create(group=group, student=student)
    exam = Exam.objects.create(group=group, name='Midterm', question_count=3, status=Exam.ACTIVE)

    notified = []
    monkeypatch.setattr('groups.views._notify_exam_finished', lambda *a, **k: notified.append(a))

    res = teacher_client.post(f'/api/groups/{group.id}/exams/{exam.id}/submit/', {
        'results': [{'student': student.id, 'scores': [4, 5, 3], 'comments': ['', '', '']}],
        'finish': True,
    }, format='json')
    assert res.status_code == 200

    exam.refresh_from_db()
    assert exam.status == Exam.FINISHED
    assert len(notified) == 1


@pytest.mark.django_db
def test_daily_report_skips_day_off_groups(academy, teacher, monkeypatch):
    import datetime
    from groups.models import GroupDayOff
    from users.management.commands import send_daily_report as report_mod

    fixed_date = datetime.date(2026, 8, 3)  # Monday
    assert fixed_date.weekday() == 0
    monkeypatch.setattr(report_mod.timezone, 'localdate', lambda: fixed_date)
    monkeypatch.setenv('TELEGRAM_BOT_TOKEN', 'test-token')

    sent = []
    monkeypatch.setattr(report_mod, '_send', lambda token, chat_id, text: sent.append((chat_id, text)))

    g_forgot = Group.objects.create(name='Forgot', teacher=teacher, class_days=[0])
    g_dayoff = Group.objects.create(name='DayOff', teacher=teacher, class_days=[0])
    GroupDayOff.objects.create(group=g_dayoff, date=fixed_date, reason='sick', created_by=teacher)

    teacher.telegram_id = 555
    teacher.save()

    report_mod.run_report_for_academy(academy)

    reminder_texts = [text for chat_id, text in sent if chat_id == teacher.telegram_id]
    assert len(reminder_texts) == 1
    assert 'Forgot' in reminder_texts[0]
    assert 'DayOff' not in reminder_texts[0]


# ── Day off (mirrors the Telegram bot's /nolesson flow) ─────────────────────

@pytest.mark.django_db
def test_mark_day_off(teacher_client, group):
    res = teacher_client.post(f'/api/groups/{group.id}/day-off/', {
        'date': '2026-05-25', 'reason': 'sick',
    })
    assert res.status_code == 201
    assert GroupDayOff.objects.filter(group=group, date='2026-05-25', reason='sick').exists()


@pytest.mark.django_db
def test_mark_day_off_is_idempotent(teacher_client, group, teacher):
    GroupDayOff.objects.create(group=group, date='2026-05-25', reason='sick', created_by=teacher)
    res = teacher_client.post(f'/api/groups/{group.id}/day-off/', {
        'date': '2026-05-25', 'reason': 'holiday',
    })
    assert res.status_code == 200
    assert GroupDayOff.objects.filter(group=group, date='2026-05-25').count() == 1
    # Existing reason is preserved — only the first call sets it.
    assert GroupDayOff.objects.get(group=group, date='2026-05-25').reason == 'sick'


@pytest.mark.django_db
def test_mark_day_off_defaults_to_today(teacher_client, group):
    from django.utils import timezone
    res = teacher_client.post(f'/api/groups/{group.id}/day-off/', {'reason': 'other'})
    assert res.status_code == 201
    assert GroupDayOff.objects.filter(group=group, date=timezone.localdate()).exists()


@pytest.mark.django_db
def test_mark_day_off_rejects_other_teacher(academy, group, student):
    other_teacher = User.objects.create_user(
        username='teacher2', password='pass1234', role='teacher', academy=academy,
    )
    client = APIClient()
    res = client.post('/api/auth/login/', {'username': 'teacher2', 'password': 'pass1234'})
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {res.data["access"]}')
    res = client.post(f'/api/groups/{group.id}/day-off/', {'date': '2026-05-25', 'reason': 'sick'})
    assert res.status_code == 403
    assert not GroupDayOff.objects.filter(group=group).exists()


@pytest.mark.django_db
def test_list_day_off_filtered_by_date(teacher_client, group, teacher):
    GroupDayOff.objects.create(group=group, date='2026-05-25', reason='sick', created_by=teacher)
    GroupDayOff.objects.create(group=group, date='2026-05-26', reason='holiday', created_by=teacher)
    res = teacher_client.get(f'/api/groups/{group.id}/day-off/', {'date': '2026-05-25'})
    assert res.status_code == 200
    assert len(res.data) == 1
    assert res.data[0]['date'] == '2026-05-25'


@pytest.mark.django_db
def test_student_cannot_create_group(student):
    client = APIClient()
    res = client.post('/api/auth/login/', {'username': 'student1', 'password': 'pass1234'})
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {res.data["access"]}')
    res = client.post('/api/groups/', {'name': 'Hack', 'class_days': []})
    assert res.status_code == 403


# ── End lesson: coin notifications ─────────────────────────────────────────

def test_render_coin_line():
    from users.telegram_bot import render_coin_line

    assert render_coin_line('uz', 0, 10) == ''
    assert render_coin_line('uz', 5, 15) == '\n🪙 +5 tangacha (jami: 15)'
    assert render_coin_line('ru', 5, 15) == '\n🪙 +5 монет (всего: 15)'


class _FakeBot:
    sent = []

    def __init__(self, token):
        pass

    async def send_message(self, chat_id, text, parse_mode=None):
        _FakeBot.sent.append((chat_id, text))


@pytest.mark.django_db
def test_end_lesson_includes_coin_line_when_game_awarded_coins(teacher_client, teacher, group, student, monkeypatch):
    from games.models import Game, GameResult
    from users import telegram_bot

    _FakeBot.sent = []
    monkeypatch.setenv('TELEGRAM_BOT_TOKEN', 'test-token')
    monkeypatch.setattr(telegram_bot, 'Bot', _FakeBot)

    student.telegram_id = 111
    student.telegram_lang = 'uz'
    student.save()

    group.memberships.create(student=student)
    lesson = Lesson.objects.create(group=group, title='Lesson 1', date='2026-08-10')
    Attendance.objects.create(lesson=lesson, student=student, present=True)

    game = Game.objects.create(lesson=lesson, group=group, teacher=teacher, date=lesson.date, status=Game.Status.CLOSED)
    GameResult.objects.create(game=game, student=student, place=1, coins=10)

    from coins.models import CoinTransaction
    CoinTransaction.objects.create(student=student, amount=10, type=CoinTransaction.Type.GAME_PLACE, reason='1-o\'rin')

    res = teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/end/')
    assert res.status_code == 200

    from users.models import Notification
    notif = Notification.objects.exclude(type='lesson').get(user=student, title=lesson.title)
    assert '+10 tangacha' in notif.body

    student_texts = [text for chat_id, text in _FakeBot.sent if chat_id == student.telegram_id]
    assert len(student_texts) == 1
    assert '+10 tangacha (jami: 10)' in student_texts[0]


@pytest.mark.django_db
def test_end_lesson_no_coin_line_without_a_game(teacher_client, group, student):
    group.memberships.create(student=student)
    lesson = Lesson.objects.create(group=group, title='Lesson 2', date='2026-08-11')
    Attendance.objects.create(lesson=lesson, student=student, present=True)

    res = teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/end/')
    assert res.status_code == 200

    from users.models import Notification
    notif = Notification.objects.exclude(type='lesson').get(user=student, title=lesson.title)
    assert 'tangacha' not in notif.body


@pytest.mark.django_db
def test_end_lesson_no_coin_line_for_student_with_zero_coins(teacher_client, teacher, group, student):
    from games.models import Game, GameResult

    group.memberships.create(student=student)
    lesson = Lesson.objects.create(group=group, title='Lesson 3', date='2026-08-12')
    Attendance.objects.create(lesson=lesson, student=student, present=False)

    game = Game.objects.create(lesson=lesson, group=group, teacher=teacher, date=lesson.date, status=Game.Status.CLOSED)
    GameResult.objects.create(game=game, student=student, effort=GameResult.Effort.NONE, coins=0)

    res = teacher_client.post(f'/api/groups/{group.id}/lessons/{lesson.id}/end/')
    assert res.status_code == 200

    from users.models import Notification
    notif = Notification.objects.exclude(type='lesson').get(user=student, title=lesson.title)
    assert 'tangacha' not in notif.body
