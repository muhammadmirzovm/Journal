import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from academies.models import Academy
from groups.models import Group, GroupMembership
from payments.codes import CODE_LENGTH
from payments.models import (
    TuitionCategory, TuitionTemplate, GroupTuition, StudentTuition, Payment, Enrollment,
    balance_for, balances_for,
)

User = get_user_model()


@pytest.fixture
def academy(db):
    return Academy.objects.create(name='Payments Test Academy', slug='payments-test-academy')


@pytest.fixture
def other_academy(db):
    return Academy.objects.create(name='Other Academy', slug='payments-other-academy')


@pytest.fixture
def teacher(academy):
    return User.objects.create_user(username='pay_teacher', password='pass1234', role='teacher', academy=academy)


@pytest.fixture
def admin_user(academy):
    return User.objects.create_user(username='pay_admin', password='pass1234', role='admin', academy=academy)


@pytest.fixture
def other_admin(other_academy):
    return User.objects.create_user(username='pay_other_admin', password='pass1234', role='admin', academy=other_academy)


@pytest.fixture
def student(academy):
    return User.objects.create_user(username='pay_student', password='pass1234', role='student', academy=academy)


@pytest.fixture
def category(academy):
    return TuitionCategory.objects.create(academy=academy, name='Guruhli')


@pytest.fixture
def template(academy, category):
    return TuitionTemplate.objects.create(academy=academy, category=category, name='Ingliz tili', default_price=800000)


@pytest.fixture
def group(teacher, template):
    g = Group.objects.create(name='Ingliz A1', teacher=teacher)
    GroupTuition.objects.create(group=g, template=template)
    return g


@pytest.fixture
def membership(group, student):
    # Past the first billing cycle's due date, so tests exercise the
    # "steady state, one cycle owed" case by default — see the dedicated
    # first-cycle tests below for the "just joined, nothing due yet" case.
    # Returns the Enrollment payments/signals.py creates alongside the
    # GroupMembership — that's what balance_for()/balances_for() consume.
    joined = timezone.now() - timezone.timedelta(days=40)
    GroupMembership.objects.create(group=group, student=student, joined_at=joined)
    return Enrollment.objects.get(student=student, group=group)


def _client_for(username):
    client = APIClient()
    res = client.post('/api/auth/login/', {'username': username, 'password': 'pass1234'})
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {res.data["access"]}')
    return client


# ── Balance computation ──────────────────────────────────────────────────────

@pytest.mark.django_db
def test_cycles_completed_anchors_to_join_day_not_calendar_month():
    from payments.models import cycles_completed
    joined = timezone.datetime(2026, 1, 15).date()

    assert cycles_completed(joined, today=joined) == 0                                    # joined today
    assert cycles_completed(joined, today=timezone.datetime(2026, 2, 10).date()) == 0      # before due date
    assert cycles_completed(joined, today=timezone.datetime(2026, 2, 15).date()) == 1      # due date itself
    assert cycles_completed(joined, today=timezone.datetime(2026, 2, 20).date()) == 1      # just past due
    assert cycles_completed(joined, today=timezone.datetime(2026, 4, 1).date()) == 2       # two cycles due, third not yet


@pytest.mark.django_db
def test_no_debt_before_first_cycle_is_due(group, student):
    # Joined 10 days ago — well within the first month, nothing owed yet
    # even though nothing has been paid.
    GroupMembership.objects.create(group=group, student=student, joined_at=timezone.now() - timezone.timedelta(days=10))
    e = Enrollment.objects.get(student=student, group=group)
    assert balance_for(student, group, e) == 0


@pytest.mark.django_db
def test_balance_uses_template_default_price(group, student, membership):
    assert balance_for(student, group, membership) == 800000


@pytest.mark.django_db
def test_balance_respects_student_override(group, student, membership):
    StudentTuition.objects.create(student=student, group=group, custom_price=300000)
    assert balance_for(student, group, membership) == 300000


@pytest.mark.django_db
def test_balance_drops_after_payment(group, student, membership, admin_user):
    Payment.objects.create(student=student, group=group, amount=500000, method=Payment.Method.CASH, receipt_code='ABCDEF', recorded_by=admin_user)
    assert balance_for(student, group, membership) == 300000  # 800000 - 500000


@pytest.mark.django_db
def test_group_with_no_template_has_zero_price(teacher, student):
    g = Group.objects.create(name='No pricing yet', teacher=teacher)
    GroupMembership.objects.create(group=g, student=student)
    e = Enrollment.objects.get(student=student, group=g)
    assert balance_for(student, g, e) == 0


@pytest.mark.django_db
def test_balances_for_bulk_matches_single(academy, group, student, membership):
    rows = balances_for(academy)
    assert len(rows) == 1
    assert rows[0]['balance'] == balance_for(student, group, membership)


# ── Removal / graduation / switching groups ──────────────────────────────────
# The Enrollment model (payments/signals.py) exists specifically so these
# groups-app actions never silently erase outstanding debt.

@pytest.mark.django_db
def test_removing_student_freezes_debt_instead_of_erasing_it(group, student, membership, admin_user):
    assert balance_for(student, group, membership) == 800000  # one cycle owed, unpaid

    gm = GroupMembership.objects.get(student=student, group=group)
    gm.delete()  # the ordinary "remove student from group" action

    e = Enrollment.objects.get(student=student, group=group)
    assert e.ended_at is not None
    # Still shows the 800000 owed from before they left — not zero, not gone —
    # and balance_for() always freezes at ended_at (see its `cap` logic), so
    # this figure will not keep growing no matter how much later it's checked.
    assert balance_for(student, group, e) == 800000


@pytest.mark.django_db
def test_removed_students_settled_debt_drops_out_of_balances_list(academy, group, student, membership, admin_user):
    GroupMembership.objects.get(student=student, group=group).delete()
    Payment.objects.create(student=student, group=group, amount=800000, method=Payment.Method.CASH, receipt_code='SETLED', recorded_by=admin_user)

    rows = balances_for(academy)
    assert rows == []  # fully paid off after leaving — nothing left to show


@pytest.mark.django_db
def test_graduating_group_freezes_billing_for_its_members(group, student, membership):
    group.is_graduated = True
    group.save(update_fields=['is_graduated'])

    e = Enrollment.objects.get(student=student, group=group)
    assert e.ended_at is not None
    assert balance_for(student, group, e) == 800000  # still what was owed at graduation, no more accruing


@pytest.mark.django_db
def test_switching_groups_bills_each_group_independently(teacher, student, category):
    template_a = TuitionTemplate.objects.create(academy=teacher.academy, category=category, name='Frontend', default_price=900000)
    template_b = TuitionTemplate.objects.create(academy=teacher.academy, category=category, name='Backend', default_price=1000000)
    group_a = Group.objects.create(name='Frontend A', teacher=teacher)
    group_b = Group.objects.create(name='Backend A', teacher=teacher)
    GroupTuition.objects.create(group=group_a, template=template_a)
    GroupTuition.objects.create(group=group_b, template=template_b)

    ma = GroupMembership.objects.create(group=group_a, student=student, joined_at=timezone.now() - timezone.timedelta(days=40))
    ma.delete()  # student switches out of Frontend...
    mb = GroupMembership.objects.create(group=group_b, student=student, joined_at=timezone.now() - timezone.timedelta(days=40))  # ...into Backend

    ea = Enrollment.objects.get(student=student, group=group_a)
    eb = Enrollment.objects.get(student=student, group=group_b)
    assert ea.ended_at is not None
    assert eb.ended_at is None
    assert balance_for(student, group_a, ea) == 900000   # Frontend debt preserved
    assert balance_for(student, group_b, eb) == 1000000  # Backend billed independently


@pytest.mark.django_db
def test_paid_this_month_only_counts_current_calendar_month(group, student, membership, admin_user):
    Payment.objects.create(student=student, group=group, amount=100000, method=Payment.Method.CASH, receipt_code='THISM1', recorded_by=admin_user, paid_at=timezone.now())
    last_month = timezone.now() - timezone.timedelta(days=35)
    Payment.objects.create(student=student, group=group, amount=300000, method=Payment.Method.CASH, receipt_code='LASTM1', recorded_by=admin_user, paid_at=last_month)

    rows = balances_for(group.teacher.academy)
    assert rows[0]['paid_this_month'] == 100000
    assert rows[0]['paid'] == 400000  # total is unaffected


# ── API: group filter ─────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_balances_endpoint_filters_by_group(teacher, student, category, admin_user):
    template_a = TuitionTemplate.objects.create(academy=teacher.academy, category=category, name='Frontend', default_price=900000)
    template_b = TuitionTemplate.objects.create(academy=teacher.academy, category=category, name='Backend', default_price=1000000)
    group_a = Group.objects.create(name='Frontend A', teacher=teacher)
    group_b = Group.objects.create(name='Backend A', teacher=teacher)
    GroupTuition.objects.create(group=group_a, template=template_a)
    GroupTuition.objects.create(group=group_b, template=template_b)
    GroupMembership.objects.create(group=group_a, student=student, joined_at=timezone.now() - timezone.timedelta(days=40))
    GroupMembership.objects.create(group=group_b, student=student, joined_at=timezone.now() - timezone.timedelta(days=40))

    client = _client_for('pay_admin')
    res = client.get(f'/api/payments/balances/?group={group_a.id}')
    assert res.status_code == 200
    assert len(res.data['groups']) == 1
    assert res.data['groups'][0]['group_id'] == group_a.id


@pytest.mark.django_db
def test_payment_history_filters_by_group(teacher, student, category, admin_user):
    template_a = TuitionTemplate.objects.create(academy=teacher.academy, category=category, name='Frontend', default_price=900000)
    template_b = TuitionTemplate.objects.create(academy=teacher.academy, category=category, name='Backend', default_price=1000000)
    group_a = Group.objects.create(name='Frontend A', teacher=teacher)
    group_b = Group.objects.create(name='Backend A', teacher=teacher)
    GroupTuition.objects.create(group=group_a, template=template_a)
    GroupTuition.objects.create(group=group_b, template=template_b)
    Payment.objects.create(student=student, group=group_a, amount=100000, method=Payment.Method.CASH, receipt_code='GA0001', recorded_by=admin_user)
    Payment.objects.create(student=student, group=group_b, amount=200000, method=Payment.Method.CASH, receipt_code='GB0001', recorded_by=admin_user)

    client = _client_for('pay_admin')
    res = client.get(f'/api/payments/history/?group={group_a.id}')
    assert res.status_code == 200
    assert res.data['total'] == 1
    assert res.data['results'][0]['receipt_code'] == 'GA0001'


# ── Excel export ───────────────────────────────────────────────────────────────

XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'


@pytest.mark.django_db
def test_balances_export_returns_xlsx(group, student, membership, admin_user):
    client = _client_for('pay_admin')
    res = client.get('/api/payments/balances/export/')
    assert res.status_code == 200
    assert res['Content-Type'] == XLSX_CONTENT_TYPE
    assert len(res.content) > 0


@pytest.mark.django_db
def test_balances_export_respects_group_filter(teacher, student, category, admin_user):
    template_a = TuitionTemplate.objects.create(academy=teacher.academy, category=category, name='Frontend', default_price=900000)
    template_b = TuitionTemplate.objects.create(academy=teacher.academy, category=category, name='Backend', default_price=1000000)
    group_a = Group.objects.create(name='Frontend A', teacher=teacher)
    group_b = Group.objects.create(name='Backend A', teacher=teacher)
    GroupTuition.objects.create(group=group_a, template=template_a)
    GroupTuition.objects.create(group=group_b, template=template_b)
    GroupMembership.objects.create(group=group_a, student=student, joined_at=timezone.now() - timezone.timedelta(days=40))
    GroupMembership.objects.create(group=group_b, student=student, joined_at=timezone.now() - timezone.timedelta(days=40))

    client = _client_for('pay_admin')
    res = client.get(f'/api/payments/balances/export/?group={group_a.id}')
    assert res.status_code == 200
    assert res['Content-Type'] == XLSX_CONTENT_TYPE
    assert 'Frontend_A' in res['Content-Disposition']


@pytest.mark.django_db
def test_balances_export_empty_academy_still_returns_valid_file(academy, admin_user):
    client = _client_for('pay_admin')
    res = client.get('/api/payments/balances/export/')
    assert res.status_code == 200
    assert res['Content-Type'] == XLSX_CONTENT_TYPE


@pytest.mark.django_db
def test_non_admin_cannot_export_balances(group, student, membership):
    client = _client_for('pay_student')
    res = client.get('/api/payments/balances/export/')
    assert res.status_code == 403


# ── API: academy scoping ─────────────────────────────────────────────────────

@pytest.mark.django_db
def test_balances_endpoint_scoped_to_own_academy(group, student, membership, admin_user, other_admin):
    own_client = _client_for('pay_admin')
    res = own_client.get('/api/payments/balances/')
    assert res.status_code == 200
    assert len(res.data['groups']) == 1
    assert len(res.data['groups'][0]['rows']) == 1

    other_client = _client_for('pay_other_admin')
    res = other_client.get('/api/payments/balances/')
    assert res.status_code == 200
    assert res.data['groups'] == []


@pytest.mark.django_db
def test_balances_endpoint_exposes_joined_and_next_due_date(group, student, membership, admin_user):
    from payments.models import Enrollment
    enrollment = Enrollment.objects.get(student=student, group=group)

    client = _client_for('pay_admin')
    res = client.get('/api/payments/balances/')
    row = res.data['groups'][0]['rows'][0]

    assert row['joined_at'].date() == enrollment.started_at.date()
    assert row['ended_at'] is None
    assert row['next_due_date'] is not None  # membership joined 40 days ago — a cycle is due


@pytest.mark.django_db
def test_balances_endpoint_next_due_date_null_after_leaving(group, student, membership, admin_user):
    GroupMembership.objects.get(student=student, group=group).delete()

    client = _client_for('pay_admin')
    res = client.get('/api/payments/balances/')
    row = res.data['groups'][0]['rows'][0]
    assert row['next_due_date'] is None
    assert row['ended_at'] is not None


@pytest.mark.django_db
def test_non_admin_cannot_list_balances(group, student, membership):
    client = _client_for('pay_student')
    res = client.get('/api/payments/balances/')
    assert res.status_code == 403


# ── API: recording a payment ─────────────────────────────────────────────────

@pytest.mark.django_db
def test_record_payment_creates_receipt_and_reduces_balance(group, student, membership, admin_user):
    client = _client_for('pay_admin')
    res = client.post('/api/payments/record/', {
        'student': student.id, 'group': group.id, 'amount': 200000, 'method': 'cash',
    }, format='json')
    assert res.status_code == 201
    assert len(res.data['receipt_code']) == CODE_LENGTH

    balances = balances_for(group.teacher.academy)
    assert balances[0]['balance'] == 600000  # 800000 - 200000


@pytest.mark.django_db
def test_record_payment_allowed_for_student_who_already_left(group, student, membership, admin_user):
    # Settling old debt shouldn't require re-adding a departed student.
    GroupMembership.objects.get(student=student, group=group).delete()
    client = _client_for('pay_admin')
    res = client.post('/api/payments/record/', {
        'student': student.id, 'group': group.id, 'amount': 800000, 'method': 'cash',
    }, format='json')
    assert res.status_code == 201


@pytest.mark.django_db
def test_record_payment_accepts_backdated_paid_at(group, student, membership, admin_user):
    client = _client_for('pay_admin')
    backdate = (timezone.localdate() - timezone.timedelta(days=5)).isoformat()
    res = client.post('/api/payments/record/', {
        'student': student.id, 'group': group.id, 'amount': 200000, 'method': 'cash', 'paid_at': backdate,
    }, format='json')
    assert res.status_code == 201
    payment = Payment.objects.get(pk=res.data['id'])
    assert timezone.localtime(payment.paid_at).date().isoformat() == backdate


@pytest.mark.django_db
def test_record_payment_rejects_future_paid_at(group, student, membership, admin_user):
    client = _client_for('pay_admin')
    future = (timezone.localdate() + timezone.timedelta(days=1)).isoformat()
    res = client.post('/api/payments/record/', {
        'student': student.id, 'group': group.id, 'amount': 200000, 'method': 'cash', 'paid_at': future,
    }, format='json')
    assert res.status_code == 400


@pytest.mark.django_db
def test_record_payment_rejects_student_never_in_group(group, student, admin_user):
    client = _client_for('pay_admin')
    res = client.post('/api/payments/record/', {
        'student': student.id, 'group': group.id, 'amount': 100000, 'method': 'cash',
    }, format='json')
    assert res.status_code == 404


@pytest.mark.django_db
def test_record_payment_rejects_unknown_method(group, student, membership, admin_user):
    client = _client_for('pay_admin')
    res = client.post('/api/payments/record/', {
        'student': student.id, 'group': group.id, 'amount': 100000, 'method': 'bitcoin',
    }, format='json')
    assert res.status_code == 400


@pytest.mark.django_db
def test_receipt_download_forbidden_for_other_student(group, student, membership, admin_user, academy):
    other_student = User.objects.create_user(username='pay_student_2', password='pass1234', role='student', academy=academy)
    payment = Payment.objects.create(student=student, group=group, amount=100000, method=Payment.Method.CASH, receipt_code='ZZZZZZ', recorded_by=admin_user)

    client = _client_for('pay_student_2')
    res = client.get(f'/api/payments/{payment.id}/receipt/')
    assert res.status_code == 403

    owner_client = _client_for('pay_student')
    res = owner_client.get(f'/api/payments/{payment.id}/receipt/')
    assert res.status_code == 200
    assert res['Content-Type'] == 'application/pdf'


@pytest.mark.django_db
def test_receipt_visible_to_linked_parent_but_not_unrelated_parent(group, student, membership, admin_user, academy):
    from users.models import ParentStudent
    payment = Payment.objects.create(student=student, group=group, amount=100000, method=Payment.Method.CASH, receipt_code='PARNT1', recorded_by=admin_user)

    linked_parent = User.objects.create_user(username='pay_parent', password='pass1234', role='parent', academy=academy)
    ParentStudent.objects.create(parent=linked_parent, student=student)
    other_parent = User.objects.create_user(username='pay_parent_2', password='pass1234', role='parent', academy=academy)

    res = _client_for('pay_parent').get(f'/api/payments/{payment.id}/receipt/')
    assert res.status_code == 200
    assert res['Content-Type'] == 'application/pdf'

    res = _client_for('pay_parent_2').get(f'/api/payments/{payment.id}/receipt/')
    assert res.status_code == 403


# ── Telegram receipt delivery ─────────────────────────────────────────────────

@pytest.mark.django_db
def test_send_payment_receipt_noop_when_nobody_has_telegram(group, student, membership, admin_user):
    from payments.notifications import send_payment_receipt
    payment = Payment.objects.create(student=student, group=group, amount=100000, method=Payment.Method.CASH, receipt_code='NOTG01', recorded_by=admin_user)
    send_payment_receipt(payment)  # must not raise even with no telegram_id anywhere


@pytest.mark.django_db
def test_send_payment_receipt_sends_to_student_and_parent(group, student, membership, admin_user, academy, monkeypatch):
    from users.models import ParentStudent
    from payments.notifications import send_payment_receipt

    student.telegram_id = 111
    student.save(update_fields=['telegram_id'])
    parent = User.objects.create_user(username='pay_parent_3', password='pass1234', role='parent', academy=academy, telegram_id=222)
    ParentStudent.objects.create(parent=parent, student=student)

    sent_to = []
    async def fake_send(telegram_id, lang, pdf_bytes, filename, kwargs):
        sent_to.append(telegram_id)
    monkeypatch.setattr('payments.notifications._send_receipt_document', fake_send)

    payment = Payment.objects.create(student=student, group=group, amount=100000, method=Payment.Method.CASH, receipt_code='TG0001', recorded_by=admin_user)
    send_payment_receipt(payment)

    assert set(sent_to) == {111, 222}


# ── Voiding a wrongly-entered payment ────────────────────────────────────────

@pytest.mark.django_db
def test_admin_can_void_own_academy_payment(group, student, membership, admin_user):
    payment = Payment.objects.create(student=student, group=group, amount=200000, method=Payment.Method.CASH, receipt_code='VOID01', recorded_by=admin_user)
    assert balance_for(student, group, membership) == 600000  # 800000 - 200000

    client = _client_for('pay_admin')
    res = client.delete(f'/api/payments/{payment.id}/')
    assert res.status_code == 204
    assert not Payment.objects.filter(pk=payment.id).exists()
    assert balance_for(student, group, membership) == 800000  # back to the full amount


@pytest.mark.django_db
def test_cannot_void_payment_from_other_academy(group, student, membership, admin_user, other_admin):
    payment = Payment.objects.create(student=student, group=group, amount=200000, method=Payment.Method.CASH, receipt_code='VOID02', recorded_by=admin_user)
    client = _client_for('pay_other_admin')
    res = client.delete(f'/api/payments/{payment.id}/')
    assert res.status_code == 404
    assert Payment.objects.filter(pk=payment.id).exists()


@pytest.mark.django_db
def test_non_admin_cannot_void_payment(group, student, membership, admin_user):
    payment = Payment.objects.create(student=student, group=group, amount=200000, method=Payment.Method.CASH, receipt_code='VOID03', recorded_by=admin_user)
    client = _client_for('pay_student')
    res = client.delete(f'/api/payments/{payment.id}/')
    assert res.status_code == 403


# ── Reminder command ──────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_payment_reminders_runs_without_error_and_creates_notification(group, student, membership, academy, monkeypatch):
    from payments.management.commands.send_payment_reminders import run_payment_reminders_for_academy
    from users.models import Notification

    student.telegram_id = 555
    student.save(update_fields=['telegram_id'])
    monkeypatch.setenv('TELEGRAM_BOT_TOKEN', 'test-token')
    monkeypatch.setattr('payments.management.commands.send_payment_reminders._send', lambda *a, **k: None)

    run_payment_reminders_for_academy(academy)

    assert Notification.objects.filter(user=student, type=Notification.PAYMENT).exists()


@pytest.mark.django_db
def test_payment_reminders_noop_without_token(group, student, membership, academy, monkeypatch):
    from payments.management.commands.send_payment_reminders import run_payment_reminders_for_academy
    from users.models import Notification

    monkeypatch.delenv('TELEGRAM_BOT_TOKEN', raising=False)
    run_payment_reminders_for_academy(academy)
    assert not Notification.objects.filter(type=Notification.PAYMENT).exists()


# ── Duplicate prevention ──────────────────────────────────────────────────────

@pytest.mark.django_db
def test_duplicate_category_name_rejected(academy, category, admin_user):
    client = _client_for('pay_admin')
    res = client.post('/api/payments/categories/', {'name': 'Guruhli'}, format='json')
    assert res.status_code == 400

    res = client.post('/api/payments/categories/', {'name': 'guruhli'}, format='json')  # case-insensitive
    assert res.status_code == 400


@pytest.mark.django_db
def test_duplicate_template_name_in_same_category_rejected(academy, category, template, admin_user):
    client = _client_for('pay_admin')
    res = client.post('/api/payments/templates/', {
        'name': 'Ingliz tili', 'category': category.id, 'default_price': 500000,
    }, format='json')
    assert res.status_code == 400


@pytest.mark.django_db
def test_same_template_name_allowed_in_different_category(academy, category, template, admin_user):
    other_category = TuitionCategory.objects.create(academy=academy, name='Individual')
    client = _client_for('pay_admin')
    res = client.post('/api/payments/templates/', {
        'name': 'Ingliz tili', 'category': other_category.id, 'default_price': 1500000,
    }, format='json')
    assert res.status_code == 201


# ── GroupSerializer's additive `tuition` field ───────────────────────────────

@pytest.mark.django_db
def test_group_list_exposes_tuition_field(teacher, template, admin_user):
    g = Group.objects.create(name='No template yet', teacher=teacher)
    client = _client_for('pay_admin')

    res = client.get('/api/groups/')
    row = next(r for r in res.data if r['id'] == g.id)
    assert row['tuition'] is None

    GroupTuition.objects.create(group=g, template=template)
    res = client.get('/api/groups/')
    row = next(r for r in res.data if r['id'] == g.id)
    assert row['tuition'] == {
        'template': template.id,
        'template_name': template.name,
        'default_price': template.default_price,
    }
