import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class Academy(models.Model):
    name          = models.CharField(max_length=120)
    slug          = models.SlugField(unique=True)
    primary_color = models.CharField(max_length=7, default='#0D9488')
    created_by    = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='owned_academies',
    )
    report_time        = models.TimeField(null=True, blank=True, help_text='Daily report time in UTC (e.g. 15:00)')
    weekly_report_time = models.TimeField(null=True, blank=True, help_text='Weekly parent report time in UTC (sent every Sunday)')
    stamp              = models.ImageField(upload_to='academy_stamps/', blank=True, null=True, help_text="To'lov kvitansiyalarida ko'rinadigan muhr/pechat rasmi")
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'academies'

    def __str__(self):
        return self.name


class AcademyTelegramGroup(models.Model):
    LANG_CHOICES = [('uz', 'Uzbek'), ('ru', 'Russian')]
    academy  = models.ForeignKey(Academy, on_delete=models.CASCADE, related_name='telegram_groups')
    chat_id  = models.BigIntegerField()
    name     = models.CharField(max_length=120)
    language = models.CharField(max_length=2, default='uz', choices=LANG_CHOICES)

    class Meta:
        unique_together = ('academy', 'chat_id')

    def __str__(self):
        return f'{self.name} ({self.chat_id})'


class InviteToken(models.Model):
    ROLE_CHOICES = [
        ('teacher', 'Teacher'),
        ('student', 'Student'),
        ('admin',   'Admin'),
        ('parent',  'Parent'),
    ]

    token      = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    academy    = models.ForeignKey(Academy, on_delete=models.CASCADE, related_name='invite_tokens')
    group      = models.ForeignKey(
        'groups.Group',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='invite_tokens',
    )
    role       = models.CharField(max_length=10, choices=ROLE_CHOICES)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='created_invites',
    )
    expires_at = models.DateTimeField()
    max_uses   = models.PositiveIntegerField(default=1)
    use_count  = models.PositiveIntegerField(default=0)
    used_by    = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='used_invites',
    )
    student    = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='parent_invites',
        limit_choices_to={'role': 'student'},
    )
    note       = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def is_valid(self):
        return self.use_count < self.max_uses and self.expires_at > timezone.now()

    def __str__(self):
        return f'{self.role} invite for {self.academy.name} [{self.token}]'
