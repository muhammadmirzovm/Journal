from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    TEACHER = 'teacher'
    STUDENT = 'student'
    ADMIN   = 'admin'
    PARENT  = 'parent'
    ROLE_CHOICES = [
        (TEACHER, 'Teacher'),
        (STUDENT, 'Student'),
        (ADMIN,   'Admin'),
        (PARENT,  'Parent'),
    ]

    role        = models.CharField(max_length=10, choices=ROLE_CHOICES, default=STUDENT)
    bio         = models.TextField(blank=True)
    last_seen   = models.DateTimeField(null=True, blank=True)
    telegram_id   = models.BigIntegerField(null=True, blank=True, unique=True)
    telegram_lang = models.CharField(max_length=2, null=True, blank=True, default='uz')
    academy   = models.ForeignKey(
        'academies.Academy',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='members',
    )

    def __str__(self):
        return f'{self.username} ({self.role})'


class TelegramConnectToken(models.Model):
    """Short-lived token used to link a Telegram account to an existing user."""
    user       = models.OneToOneField(User, on_delete=models.CASCADE, related_name='telegram_token')
    token      = models.CharField(max_length=32, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def is_expired(self):
        return timezone.now() > self.created_at + timezone.timedelta(minutes=10)


class TelegramOTP(models.Model):
    """One-time password sent via Telegram for password reset."""
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='otps')
    code       = models.CharField(max_length=6)
    expires_at = models.DateTimeField()
    used       = models.BooleanField(default=False)

    def is_valid(self):
        return not self.used and timezone.now() < self.expires_at


class Notification(models.Model):
    SCORE        = 'score'
    ABSENT       = 'absent'
    LESSON       = 'lesson'
    ANNOUNCEMENT = 'announcement'
    EXAM         = 'exam'
    PAYMENT      = 'payment'
    TYPE_CHOICES = [
        (SCORE,        'Score Added'),
        (ABSENT,       'Marked Absent'),
        (LESSON,       'New Lesson'),
        (ANNOUNCEMENT, 'Announcement'),
        (EXAM,         'Exam Result'),
        (PAYMENT,      'Payment Reminder'),
    ]
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    type       = models.CharField(max_length=20, choices=TYPE_CHOICES)
    title      = models.CharField(max_length=200)
    body       = models.CharField(max_length=500)
    is_read    = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.username} — {self.type}: {self.title}'


class PushSubscription(models.Model):
    user     = models.ForeignKey(User, on_delete=models.CASCADE, related_name='push_subscriptions')
    endpoint = models.TextField(unique=True)
    p256dh   = models.TextField()
    auth     = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.user.username} push sub'


class ParentStudent(models.Model):
    parent  = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='children',
        limit_choices_to={'role': 'parent'},
    )
    student = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name='parents',
        limit_choices_to={'role': 'student'},
    )

    class Meta:
        unique_together = ('parent', 'student')

    def __str__(self):
        return f'{self.parent.username} → {self.student.username}'
