from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from django.utils import timezone

from groups.models import Group, GroupMembership
from .models import Enrollment


@receiver(post_save, sender=GroupMembership)
def _sync_enrollment_on_membership_save(sender, instance, **kwargs):
    """A student joining (or having their join date edited) keeps the
    matching open Enrollment's started_at in sync. If no open Enrollment
    exists yet (first time, or rejoining after a previous stint was
    closed), one is created."""
    enrollment = Enrollment.objects.filter(
        student=instance.student, group=instance.group, ended_at__isnull=True,
    ).first()
    if enrollment:
        if enrollment.started_at != instance.joined_at:
            enrollment.started_at = instance.joined_at
            enrollment.save(update_fields=['started_at'])
    else:
        Enrollment.objects.create(student=instance.student, group=instance.group, started_at=instance.joined_at)


@receiver(pre_delete, sender=GroupMembership)
def _close_enrollment_on_membership_delete(sender, instance, **kwargs):
    """Removing a student from a group (groups app hard-deletes the
    GroupMembership) freezes their Enrollment instead of losing it —
    billing stops accruing, but any balance already owed stays visible."""
    Enrollment.objects.filter(
        student=instance.student, group=instance.group, ended_at__isnull=True,
    ).update(ended_at=timezone.now())


@receiver(post_save, sender=Group)
def _close_enrollments_on_group_graduation(sender, instance, **kwargs):
    """Graduating a group freezes billing for everyone still enrolled in
    it, as of the moment it was graduated. Un-graduating does not reopen
    them — resuming billing after that is an admin decision, not implied
    by toggling the flag back."""
    if instance.is_graduated:
        Enrollment.objects.filter(group=instance, ended_at__isnull=True).update(ended_at=timezone.now())
