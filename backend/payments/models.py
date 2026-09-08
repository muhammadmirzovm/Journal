import calendar
from django.conf import settings
from django.db import models
from django.db.models import Sum
from django.utils import timezone


class TuitionCategory(models.Model):
    """Admin-defined grouping for templates — e.g. Guruhli, Individual, Mini
    guruh. Not a fixed enum: admins add their own from the Payments page."""

    academy = models.ForeignKey('academies.Academy', on_delete=models.CASCADE, related_name='tuition_categories')
    name    = models.CharField(max_length=60)

    class Meta:
        verbose_name_plural = 'tuition categories'
        unique_together = ('academy', 'name')
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.academy.name})'


class TuitionTemplate(models.Model):
    """A reusable price definition (e.g. "Ingliz tili" — Guruhli — 800000
    so'm) that gets attached to one or more Groups via GroupTuition."""

    academy       = models.ForeignKey('academies.Academy', on_delete=models.CASCADE, related_name='tuition_templates')
    category      = models.ForeignKey(TuitionCategory, on_delete=models.PROTECT, related_name='templates')
    name          = models.CharField(max_length=120)
    default_price = models.PositiveIntegerField(help_text="Oylik narx, so'mda")
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        unique_together = ('academy', 'category', 'name')

    def __str__(self):
        return f'{self.name} — {self.default_price} ({self.academy.name})'


class GroupTuition(models.Model):
    """Attaches a TuitionTemplate to one Group. Kept as its own model
    (instead of a field on groups.Group) so this app never touches the
    existing groups app's schema."""

    group    = models.OneToOneField('groups.Group', on_delete=models.CASCADE, related_name='tuition')
    template = models.ForeignKey(TuitionTemplate, on_delete=models.PROTECT, related_name='group_tuitions')

    def __str__(self):
        return f'{self.group.name} → {self.template.name}'


class StudentTuition(models.Model):
    """Per-student price override for one group. Sparse: a row only exists
    when an admin sets a custom price (discount/scholarship) — otherwise
    the group's template default_price applies."""

    student      = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='tuition_overrides')
    group        = models.ForeignKey('groups.Group', on_delete=models.CASCADE, related_name='student_tuitions')
    custom_price = models.PositiveIntegerField(help_text="Oylik narx, so'mda")
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('student', 'group')

    def __str__(self):
        return f'{self.student.username} @ {self.group.name} — {self.custom_price}'


class Enrollment(models.Model):
    """Independent record of one student's billing-relevant time in one
    group. Kept in the payments app (not a field on groups.GroupMembership)
    and synced via signals (payments/signals.py) so that removing a
    student from a group or graduating a group — both ordinary groups-app
    actions — never silently erases outstanding debt: GroupMembership can
    be hard-deleted, but this row survives with ended_at set, freezing
    billing at that date instead of vanishing or running forever."""

    student    = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payment_enrollments')
    group      = models.ForeignKey('groups.Group', on_delete=models.CASCADE, related_name='payment_enrollments')
    started_at = models.DateTimeField()
    ended_at   = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [models.Index(fields=['student', 'group'])]
        ordering = ['-started_at']

    def __str__(self):
        status = 'faol' if self.ended_at is None else f'tugagan {self.ended_at:%Y-%m-%d}'
        return f'{self.student.username} @ {self.group.name} ({status})'


class Payment(models.Model):
    class Method(models.TextChoices):
        CASH  = 'cash',  'Naqd'
        CARD  = 'card',  'Karta'
        CLICK = 'click', 'Click'
        PAYME = 'payme', 'Payme'

    student       = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='payments')
    group         = models.ForeignKey('groups.Group', on_delete=models.CASCADE, related_name='payments')
    amount        = models.PositiveIntegerField(help_text="So'mda")
    method        = models.CharField(max_length=10, choices=Method.choices)
    note          = models.CharField(max_length=200, blank=True)
    receipt_code  = models.CharField(max_length=6, unique=True, db_index=True)
    recorded_by   = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+')
    paid_at       = models.DateTimeField(default=timezone.now)
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-paid_at']
        indexes = [models.Index(fields=['student', 'group'])]

    def __str__(self):
        return f'{self.student.username} — {self.amount} ({self.group.name})'


def _add_months(d, n):
    month_index = d.month - 1 + n
    year  = d.year + month_index // 12
    month = month_index % 12 + 1
    day   = min(d.day, calendar.monthrange(year, month)[1])  # clamp e.g. Jan 31 + 1mo → Feb 28/29
    return d.replace(year=year, month=month, day=day)


def cycles_completed(joined_at, today=None):
    """How many full billing cycles have elapsed since joining — the cycle
    is anchored to the student's own join day-of-month (not the calendar
    month), matching how a real subscription renews. A cycle only counts
    once its due date has actually passed: a student who joined today owes
    nothing yet, and isn't in debt until a full month from their join date
    goes by unpaid."""
    today = today or timezone.localdate()
    joined = joined_at.date() if hasattr(joined_at, 'date') else joined_at
    if today < joined:
        return 0
    months = (today.year - joined.year) * 12 + (today.month - joined.month)
    if _add_months(joined, months) > today:
        months -= 1
    return max(0, months)


def next_due_date(started_at, cap=None):
    """The date the next billing cycle becomes due, anchored to
    started_at's day-of-month — None once billing has stopped (student
    left the group / the group graduated, i.e. cap is set)."""
    if cap is not None:
        return None
    started = started_at.date() if hasattr(started_at, 'date') else started_at
    count = cycles_completed(started_at)
    return _add_months(started, count + 1)


def effective_price(student_id, group):
    """group must have .tuition prefetched or accessible; returns 0 if the
    group has no template assigned yet."""
    override = StudentTuition.objects.filter(student_id=student_id, group=group).first()
    if override:
        return override.custom_price
    tuition = getattr(group, 'tuition', None)
    return tuition.template.default_price if tuition else 0


def balance_for(student, group, enrollment):
    """expected (price × completed billing cycles since enrollment.started_at,
    frozen at enrollment.ended_at if the student has left or the group has
    graduated) minus paid. Positive = qarz (debt), negative = overpaid."""
    cap = enrollment.ended_at.date() if enrollment.ended_at else None
    expected = effective_price(student.id, group) * cycles_completed(enrollment.started_at, today=cap)
    paid = Payment.objects.filter(student=student, group=group).aggregate(s=Sum('amount'))['s'] or 0
    return expected - paid


def balances_for(academy):
    """Bulk balance computation, academy-wide — a handful of queries total,
    not one per student (mirrors coins.models.CoinTransaction.balances_for).
    Returns a list of dicts: [{student, group, membership, expected, paid,
    balance}, ...]. Uses each (student, group) pair's most recent
    Enrollment — if a student left and later rejoined the same group,
    only the current stint is billed going forward; the closed one is
    already reflected in what they've paid overall for that group."""
    enrollments = list(
        Enrollment.objects
        .filter(group__teacher__academy=academy)
        .select_related('student', 'group', 'group__tuition__template')
        .order_by('student_id', 'group_id', '-started_at')
    )
    if not enrollments:
        return []

    latest = {}
    for e in enrollments:
        key = (e.student_id, e.group_id)
        if key not in latest:
            latest[key] = e
    enrollments = list(latest.values())

    student_ids = [e.student_id for e in enrollments]
    group_ids   = [e.group_id for e in enrollments]

    overrides = {
        (row['student'], row['group']): row['custom_price']
        for row in StudentTuition.objects.filter(student_id__in=student_ids, group_id__in=group_ids)
            .values('student', 'group', 'custom_price')
    }
    paid_map = {
        (row['student'], row['group']): row['paid']
        for row in Payment.objects.filter(student_id__in=student_ids, group_id__in=group_ids)
            .values('student', 'group').annotate(paid=Sum('amount'))
    }
    today = timezone.localdate()
    paid_this_month_map = {
        (row['student'], row['group']): row['paid']
        for row in Payment.objects.filter(
            student_id__in=student_ids, group_id__in=group_ids,
            paid_at__year=today.year, paid_at__month=today.month,
        ).values('student', 'group').annotate(paid=Sum('amount'))
    }

    results = []
    for e in enrollments:
        tuition = getattr(e.group, 'tuition', None)
        default_price = tuition.template.default_price if tuition else 0
        price = overrides.get((e.student_id, e.group_id), default_price)
        cap = e.ended_at.date() if e.ended_at else None
        expected = price * cycles_completed(e.started_at, today=cap)
        paid = paid_map.get((e.student_id, e.group_id), 0)
        balance = expected - paid
        if e.ended_at and balance == 0:
            continue  # departed & fully settled — no need to keep surfacing them
        results.append({
            'student': e.student, 'group': e.group, 'membership': e,
            'price': price, 'expected': expected, 'paid': paid,
            'paid_this_month': paid_this_month_map.get((e.student_id, e.group_id), 0),
            'balance': balance,
            'started_at': e.started_at, 'ended_at': e.ended_at,
            'next_due_date': next_due_date(e.started_at, cap),
        })
    return results
