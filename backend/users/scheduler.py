import logging
from datetime import datetime, timedelta
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from django.db import close_old_connections

logger = logging.getLogger(__name__)
_scheduler = BackgroundScheduler(timezone='UTC')


def _run_daily(academy_id):
    # APScheduler runs jobs on its own background thread, outside Django's
    # request/response cycle — close_old_connections() is normally called per
    # request, so a connection that goes stale here (e.g. a DB restart) is
    # never refreshed and every future run fails with "connection already closed".
    close_old_connections()
    from academies.models import Academy
    from .management.commands.send_daily_report import run_report_for_academy
    try:
        academy = Academy.objects.get(id=academy_id)
        run_report_for_academy(academy)
    except Exception as exc:
        logger.error('Daily report failed for academy %s: %s', academy_id, exc)
    finally:
        close_old_connections()


def _run_payment_reminders(academy_id):
    close_old_connections()
    from academies.models import Academy
    from payments.management.commands.send_payment_reminders import run_payment_reminders_for_academy
    try:
        academy = Academy.objects.get(id=academy_id)
        run_payment_reminders_for_academy(academy)
    except Exception as exc:
        logger.error('Payment reminders failed for academy %s: %s', academy_id, exc)
    finally:
        close_old_connections()


def _run_weekly(academy_id):
    close_old_connections()
    from academies.models import Academy
    from .management.commands.send_weekly_report import run_weekly_report_for_academy
    try:
        academy = Academy.objects.get(id=academy_id)
        run_weekly_report_for_academy(academy)
    except Exception as exc:
        logger.error('Weekly report failed for academy %s: %s', academy_id, exc)
    finally:
        close_old_connections()


def _load_all():
    close_old_connections()
    from academies.models import Academy
    for academy in Academy.objects.all():
        reschedule(academy)
    logger.info('Loaded %d academy report schedules', len(_scheduler.get_jobs()))


def reschedule(academy):
    # Daily report
    daily_id = f'daily_report_{academy.id}'
    if _scheduler.get_job(daily_id):
        _scheduler.remove_job(daily_id)
    if academy.report_time:
        _scheduler.add_job(
            _run_daily,
            CronTrigger(hour=academy.report_time.hour, minute=academy.report_time.minute, timezone='UTC'),
            id=daily_id,
            args=[academy.id],
        )
        logger.info('Scheduled daily report for academy %s at %s UTC', academy.name, academy.report_time)

    # Payment debt reminders — reuses report_time, no separate config needed
    reminders_id = f'payment_reminders_{academy.id}'
    if _scheduler.get_job(reminders_id):
        _scheduler.remove_job(reminders_id)
    if academy.report_time:
        _scheduler.add_job(
            _run_payment_reminders,
            CronTrigger(hour=academy.report_time.hour, minute=academy.report_time.minute, timezone='UTC'),
            id=reminders_id,
            args=[academy.id],
        )
        logger.info('Scheduled payment reminders for academy %s at %s UTC', academy.name, academy.report_time)

    # Weekly parent report — runs every Sunday
    weekly_id = f'weekly_report_{academy.id}'
    if _scheduler.get_job(weekly_id):
        _scheduler.remove_job(weekly_id)
    if academy.weekly_report_time:
        _scheduler.add_job(
            _run_weekly,
            CronTrigger(
                day_of_week='sun',
                hour=academy.weekly_report_time.hour,
                minute=academy.weekly_report_time.minute,
                timezone='UTC',
            ),
            id=weekly_id,
            args=[academy.id],
        )
        logger.info('Scheduled weekly report for academy %s at Sun %s UTC', academy.name, academy.weekly_report_time)


def start():
    if _scheduler.running:
        return
    _scheduler.start()
    # Load academy schedules 2s after startup to avoid querying DB inside ready()
    _scheduler.add_job(_load_all, 'date', run_date=datetime.now() + timedelta(seconds=2), id='_startup_load')
