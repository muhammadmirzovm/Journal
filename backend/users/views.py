from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.db.models import Avg, Count, Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views import View
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.conf import settings
from datetime import timedelta
import json
import logging
import random
import secrets
from asgiref.sync import async_to_sync
from .serializers import RegisterSerializer, UserSerializer
from backend.throttles import LoginRateThrottle, RegisterRateThrottle, PasswordResetRateThrottle

logger = logging.getLogger(__name__)
User = get_user_model()


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = (permissions.AllowAny,)
    throttle_classes = [RegisterRateThrottle]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        refresh = RefreshToken.for_user(user)
        return Response({
            'user': UserSerializer(user, context={'request': request}).data,
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            }
        }, status=status.HTTP_201_CREATED)


class MeView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response(UserSerializer(request.user, context={'request': request}).data)

    def patch(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class ProfileView(generics.RetrieveAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self):
        target = super().get_object()
        viewer = self.request.user
        # Admin/teacher profiles are private — only admins, teachers, or the owner can view
        if target.role in ('admin', 'teacher') and viewer.role not in ('admin', 'teacher') and viewer.pk != target.pk:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('You do not have permission to view this profile.')
        return target


def _class_start_minutes(class_time):
    if not class_time:
        return 24 * 60 + 1  # groups without a time go last
    try:
        hh, mm = class_time.split('-')[0].split(':')
        return int(hh) * 60 + int(mm)
    except (ValueError, IndexError):
        return 24 * 60 + 1


def _build_schedule(groups):
    """Weekly timetable rows for active groups that have class days set,
    ordered by lesson start time so earlier classes come first. Graduated
    groups no longer hold lessons, so they are left out."""
    return sorted(
        [
            {
                'id':            g.id,
                'group':         g.name,
                'class_days':    g.class_days,
                'class_time':    g.class_time,
                'is_individual': g.is_individual,
            }
            for g in groups if g.class_days and not g.is_graduated
        ],
        key=lambda s: _class_start_minutes(s['class_time']),
    )


class UserStatsView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        from django.db.models import Avg, Count, Sum
        from groups.models import Score, Attendance, Group, GroupMembership, Lesson

        if user.role == 'admin':
            academy = user.academy
            if not academy:
                return Response({'role': 'admin', 'total_students': 0, 'total_teachers': 0, 'total_groups': 0, 'total_lessons': 0})
            total_students = User.objects.filter(academy=academy, role='student', is_active=True).count()
            total_teachers = User.objects.filter(academy=academy, role='teacher', is_active=True).count()
            total_groups   = Group.objects.filter(teacher__academy=academy).count()
            total_lessons  = Lesson.objects.filter(group__teacher__academy=academy).count()
            return Response({
                'role': 'admin',
                'total_students': total_students,
                'total_teachers': total_teachers,
                'total_groups':   total_groups,
                'total_lessons':  total_lessons,
            })

        if user.role == 'teacher':
            # Active groups only — graduated groups are excluded from the
            # teacher's profile stats, charts and timetable.
            groups = Group.objects.filter(teacher=user, is_graduated=False).prefetch_related('memberships', 'lessons')

            total_groups   = groups.count()
            total_lessons  = Lesson.objects.filter(group__teacher=user, group__is_graduated=False).count()
            total_students = (
                GroupMembership.objects.filter(group__teacher=user, group__is_graduated=False, student__is_active=True)
                .values('student').distinct().count()
            )
            avg_score_val = (
                Score.objects.filter(lesson__group__teacher=user, lesson__group__is_graduated=False)
                .aggregate(avg=Avg('value'))['avg']
            )

            scores_by_group   = []
            students_by_group = []
            for g in groups:
                # Individual groups are a single student, not a real group, so
                # they would clutter the per-group comparison charts.
                if g.is_individual:
                    continue
                avg = (
                    Score.objects.filter(lesson__group=g)
                    .aggregate(avg=Avg('value'))['avg']
                )
                scores_by_group.append({
                    'group': g.name,
                    'avg_score': round(avg, 2) if avg else 0,
                })
                students_by_group.append({
                    'group': g.name,
                    'students': g.memberships.filter(student__is_active=True).count(),
                })

            # Weekly timetable — every group (incl. individual) that has set days.
            schedule = _build_schedule(groups)

            return Response({
                'role': 'teacher',
                'total_students': total_students,
                'total_groups':   total_groups,
                'total_lessons':  total_lessons,
                'avg_score':      round(avg_score_val, 2) if avg_score_val else 0,
                'scores_by_group':   scores_by_group,
                'students_by_group': students_by_group,
                'schedule':          schedule,
            })

        # ── Student stats ─────────────────────────────────────────────────────
        scores = (
            Score.objects.filter(student=user)
            .select_related('lesson')
            .order_by('lesson__date')
        )
        score_trend = [
            {'lesson': s.lesson.title, 'date': str(s.lesson.date), 'score': s.value}
            for s in scores
        ]
        total   = Attendance.objects.filter(student=user).count()
        present = Attendance.objects.filter(student=user, present=True).count()

        from coins.models import CoinTransaction as GlobalCoinTransaction
        coin_txns = GlobalCoinTransaction.objects.filter(student=user).order_by('created_at')
        # Running balance over time, aggregated per day (earning from games
        # raises it, redeeming a reward lowers it — this is the real balance,
        # not a lifetime-earned counter).
        from collections import OrderedDict
        balance = 0
        daily = OrderedDict()
        for txn in coin_txns:
            balance += txn.amount
            day = str(txn.created_at.date())
            if day in daily:
                daily[day]['total']   = balance
                daily[day]['amount'] += txn.amount
            else:
                daily[day] = {'date': day, 'amount': txn.amount, 'total': balance}
        coin_trend = list(daily.values())

        student_groups = Group.objects.filter(memberships__student=user).distinct()
        schedule = _build_schedule(student_groups)

        from groups.models import ExamResult
        exam_results = (
            ExamResult.objects.filter(student=user)
            .select_related('exam', 'exam__group')
            .order_by('exam__created_at')
        )
        exam_trend = [
            {
                'exam':       r.exam.name,
                'group':      r.exam.group.name,
                'percentage': r.percentage,
                'absent':     r.absent,
                'total':      r.total,
                'max':        r.max_score,
            }
            for r in exam_results
        ]

        # ── Attendance calendar + streaks ─────────────────────────────────────
        att_records = list(
            Attendance.objects.filter(student=user)
            .select_related('lesson')
            .order_by('lesson__date', 'lesson__id')
        )
        # Per-day status: a day counts as absent if any lesson that day was missed
        day_status = OrderedDict()
        for a in att_records:
            d = str(a.lesson.date)
            day_status[d] = a.present if d not in day_status else (day_status[d] and a.present)
        attendance_calendar = [{'date': d, 'present': p} for d, p in day_status.items()]

        # Streaks over lessons in chronological order
        longest_streak = current_streak = 0
        for a in att_records:
            if a.present:
                current_streak += 1
                longest_streak = max(longest_streak, current_streak)
            else:
                current_streak = 0

        return Response({
            'role': 'student',
            'score_trend': score_trend,
            'coin_trend': coin_trend,
            'schedule': schedule,
            'exam_trend': exam_trend,
            'attendance_calendar': attendance_calendar,
            'streak': {'current': current_streak, 'longest': longest_streak},
            'attendance_summary': {
                'present': present,
                'absent':  total - present,
                'total':   total,
            }
        })


class UserGroupsView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, pk):
        viewer = request.user
        if viewer.pk != pk and viewer.role not in ('admin', 'teacher'):
            return Response({'detail': 'No permission.'}, status=403)
        try:
            target = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'detail': 'Not found.'}, status=404)

        from groups.models import Group, GroupMembership
        if target.role == 'student':
            memberships = GroupMembership.objects.filter(student=target).select_related('group', 'group__teacher')
            groups = []
            for m in memberships:
                g = m.group
                teacher_full = f'{g.teacher.first_name} {g.teacher.last_name}'.strip() or g.teacher.username
                groups.append({
                    'id':           g.id,
                    'name':         g.name,
                    'teacher_name': teacher_full,
                    'member_count': g.memberships.count(),
                })
        elif target.role == 'teacher':
            gs = Group.objects.filter(teacher=target)
            groups = [{'id': g.id, 'name': g.name, 'member_count': g.memberships.count()} for g in gs]
        else:
            groups = []
        return Response(groups)


class AdminStatsView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        user = request.user
        if user.role != 'admin' or not user.academy:
            return Response({'detail': 'Admin only.'}, status=403)

        academy = user.academy
        from groups.models import Group, Lesson, Score, GroupMembership
        from django.db.models import Avg, Sum

        total_students = User.objects.filter(academy=academy, role='student', is_active=True).count()
        total_teachers = User.objects.filter(academy=academy, role='teacher', is_active=True).count()
        total_groups   = Group.objects.filter(teacher__academy=academy).count()
        total_lessons  = Lesson.objects.filter(group__teacher__academy=academy).count()

        # Top groups by avg score (converted to 0-100%) — active, non-individual
        # groups only; a 1-student individual group isn't a "group" to rank.
        groups = Group.objects.filter(teacher__academy=academy, is_graduated=False, is_individual=False)
        group_data = []
        for g in groups:
            avg = Score.objects.filter(lesson__group=g).aggregate(avg=Avg('value'))['avg']
            group_data.append({
                'id':           g.id,
                'name':         g.name,
                'teacher_name': g.teacher.first_name or g.teacher.username,
                'member_count': g.memberships.filter(student__is_active=True).count(),
                'avg_score':    round(avg * 20, 1) if avg else 0,
            })
        top_groups = sorted(group_data, key=lambda x: x['avg_score'], reverse=True)[:5]

        # Top students by comprehension % — active groups only
        memberships = GroupMembership.objects.filter(
            group__teacher__academy=academy, group__is_graduated=False, student__is_active=True
        ).select_related('student', 'group')

        student_map = {}
        for m in memberships:
            sid = m.student.id
            if sid not in student_map:
                student_map[sid] = {
                    'id':            sid,
                    'username':      m.student.username,
                    'first_name':    m.student.first_name,
                    'last_name':     m.student.last_name,
                    'total_score':   0,
                    'total_possible': 0,
                    'group_names':   set(),
                }
            student_map[sid]['group_names'].add(m.group.name)
            join_date   = m.joined_at.date()
            lessons     = m.group.lessons.filter(date__gte=join_date)
            lesson_count = lessons.count()
            if lesson_count > 0:
                score_sum = Score.objects.filter(
                    lesson__in=lessons, student=m.student
                ).aggregate(total=Sum('value'))['total'] or 0
                student_map[sid]['total_score']    += score_sum
                student_map[sid]['total_possible'] += lesson_count * 5

        top_students = []
        for s in student_map.values():
            comp = round(s['total_score'] / s['total_possible'] * 100) if s['total_possible'] > 0 else 0
            full = f"{s['first_name']} {s['last_name']}".strip()
            top_students.append({
                'id':            s['id'],
                'username':      s['username'],
                'display_name':  full or s['username'],
                'comprehension': comp,
                'groups':        sorted(s['group_names']),
            })
        top_students = sorted(top_students, key=lambda x: x['comprehension'], reverse=True)[:5]

        # ── Analytics charts ──────────────────────────────────────────────────
        from django.db.models import Count
        from django.db.models.functions import TruncMonth
        from groups.models import Attendance

        teachers_list = []
        for tch in User.objects.filter(academy=academy, role='teacher', is_active=True):
            name  = f'{tch.first_name} {tch.last_name}'.strip() or tch.username
            scnt  = GroupMembership.objects.filter(group__teacher=tch, group__is_graduated=False, student__is_active=True).values('student').distinct().count()
            gcnt  = Group.objects.filter(teacher=tch, is_graduated=False).count()
            avg   = Score.objects.filter(lesson__group__teacher=tch, lesson__group__is_graduated=False).aggregate(avg=Avg('value'))['avg']
            teachers_list.append({
                'id':            tch.id,
                'name':          name,
                'group_count':   gcnt,
                'student_count': scnt,
                'avg_score':     round(avg * 20, 1) if avg else 0,
            })
        teachers_list.sort(key=lambda x: x['student_count'], reverse=True)
        students_per_teacher = [{'teacher': t['name'], 'students': t['student_count']} for t in teachers_list]

        growth_qs = (
            User.objects.filter(academy=academy, role='student')
            .annotate(m=TruncMonth('date_joined'))
            .values('m').annotate(c=Count('id')).order_by('m')
        )
        students_growth = [
            {'month': r['m'].strftime('%Y-%m'), 'count': r['c']}
            for r in growth_qs if r['m']
        ]

        absence_qs = (
            Attendance.objects.filter(lesson__group__teacher__academy=academy, present=False, lesson__group__is_graduated=False)
            .annotate(m=TruncMonth('lesson__date'))
            .values('m').annotate(c=Count('id')).order_by('m')
        )
        absences_by_month = [
            {'month': r['m'].strftime('%Y-%m'), 'count': r['c']}
            for r in absence_qs if r['m']
        ]

        return Response({
            'total_students': total_students,
            'total_teachers': total_teachers,
            'total_groups':   total_groups,
            'total_lessons':  total_lessons,
            'top_groups':     top_groups,
            'top_students':   top_students,
            'teachers':       teachers_list,
            'students_per_teacher': students_per_teacher,
            'students_growth':      students_growth,
            'absences_by_month':    absences_by_month,
        })


class UserChildrenView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, pk):
        viewer = request.user
        if viewer.pk != pk and viewer.role not in ('admin', 'teacher'):
            return Response({'detail': 'No permission.'}, status=403)
        from .models import ParentStudent
        links = ParentStudent.objects.filter(parent_id=pk).select_related('student')
        children = []
        for link in links:
            s = link.student
            full = f'{s.first_name} {s.last_name}'.strip()
            children.append({
                'id':           s.id,
                'username':     s.username,
                'first_name':   s.first_name,
                'last_name':    s.last_name,
                'display_name': full or s.username,
            })
        return Response(children)


class ParentChildrenView(APIView):
    """GET  — parent sees their linked children.
       POST — admin/teacher links an existing parent to an existing student."""
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        if request.user.role != 'parent':
            return Response({'detail': 'Only parents can access this.'}, status=403)
        from .models import ParentStudent
        links = ParentStudent.objects.filter(parent=request.user).select_related('student')
        children = []
        for link in links:
            s = link.student
            full = f'{s.first_name} {s.last_name}'.strip()
            children.append({
                'id':         s.id,
                'username':   s.username,
                'first_name': s.first_name,
                'last_name':  s.last_name,
                'display_name': full or s.username,
            })
        return Response(children)

    def post(self, request):
        user = request.user
        if user.role not in ('admin', 'teacher'):
            return Response({'detail': 'Only admins and teachers can link children.'}, status=403)
        if not user.academy:
            return Response({'detail': 'No academy.'}, status=400)

        parent_id  = request.data.get('parent')
        student_id = request.data.get('student')
        if not parent_id or not student_id:
            return Response({'detail': 'parent and student are required.'}, status=400)

        from .models import ParentStudent
        from django.contrib.auth import get_user_model
        U = get_user_model()
        parent  = get_object_or_404(U, pk=parent_id,  academy=user.academy, role='parent')
        student = get_object_or_404(U, pk=student_id, academy=user.academy, role='student')
        _, created = ParentStudent.objects.get_or_create(parent=parent, student=student)
        return Response({'detail': 'Linked.' if created else 'Already linked.'}, status=201 if created else 200)

    def delete(self, request):
        user = request.user
        if user.role not in ('admin', 'teacher'):
            return Response({'detail': 'Only admins and teachers can unlink children.'}, status=403)
        if not user.academy:
            return Response({'detail': 'No academy.'}, status=400)

        parent_id  = request.data.get('parent')
        student_id = request.data.get('student')
        if not parent_id or not student_id:
            return Response({'detail': 'parent and student are required.'}, status=400)

        from .models import ParentStudent
        deleted, _ = ParentStudent.objects.filter(
            parent_id=parent_id, student_id=student_id,
            parent__academy=user.academy,
        ).delete()
        if deleted:
            return Response(status=204)
        return Response({'detail': 'Link not found.'}, status=404)


class OnlineCountView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        cutoff = timezone.now() - timedelta(minutes=5)
        count  = User.objects.filter(last_seen__gte=cutoff).count()
        return Response({'online': count})


class PlatformStatsView(APIView):
    permission_classes = (permissions.AllowAny,)

    def get(self, request):
        from groups.models import Group, Lesson
        return Response({
            'total_users':    User.objects.count(),
            'total_teachers': User.objects.filter(role='teacher').count(),
            'total_students': User.objects.filter(role='student').count(),
            'total_groups':   Group.objects.count(),
            'total_lessons':  Lesson.objects.count(),
        })



class AdminStudentsView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        role = request.user.role
        if role not in ('admin', 'teacher') or not request.user.academy:
            return Response({'detail': 'Admin or teacher only.'}, status=403)

        academy = request.user.academy
        from groups.models import GroupMembership, Attendance, Score

        qs = User.objects.filter(academy=academy, role='student').order_by('first_name', 'last_name')

        if role == 'teacher':
            qs = qs.filter(memberships__group__teacher=request.user).distinct()

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(username__icontains=search)
            )

        group_id = request.query_params.get('group')
        if group_id:
            qs = qs.filter(memberships__group_id=group_id).distinct()

        status_filter = request.query_params.get('status', 'active')
        if status_filter == 'active':
            qs = qs.filter(is_active=True)
        elif status_filter == 'inactive':
            qs = qs.filter(is_active=False)
        # 'all' → no filter

        # Pagination
        page_size = int(request.query_params.get('page_size', 20))
        page      = int(request.query_params.get('page', 1))
        total     = qs.count()
        students  = qs[(page - 1) * page_size : page * page_size]

        data = []
        for s in students:
            memberships = GroupMembership.objects.filter(student=s).select_related('group')
            groups = [{'id': m.group.id, 'name': m.group.name} for m in memberships]

            total_att  = Attendance.objects.filter(student=s).count()
            present    = Attendance.objects.filter(student=s, present=True).count()
            att_pct    = round(present / total_att * 100) if total_att else None

            scores     = Score.objects.filter(student=s)
            avg_score  = scores.aggregate(avg=Avg('value'))['avg']
            avg_pct    = round(avg_score * 20) if avg_score else None

            data.append({
                'id':               s.id,
                'username':         s.username,
                'first_name':       s.first_name,
                'last_name':        s.last_name,
                'groups':           groups,
                'attendance_pct':   att_pct,
                'avg_score_pct':    avg_pct,
                'telegram_linked':  bool(s.telegram_id),
                'has_parent':       s.parents.exists(),
                'date_joined':      s.date_joined,
                'is_active':        s.is_active,
            })

        return Response({
            'count':    total,
            'pages':    (total + page_size - 1) // page_size,
            'page':     page,
            'results':  data,
        })


class StudentActiveView(APIView):
    """Activate / deactivate a student. A deactivated student cannot log in and
    is hidden from every roster, ranking, stat and report — but their data is
    kept and they can be reactivated."""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk):
        actor = request.user
        if actor.role not in ('admin', 'teacher') or not actor.academy:
            return Response({'detail': 'Admin or teacher only.'}, status=403)
        try:
            student = User.objects.get(pk=pk, role='student', academy=actor.academy)
        except User.DoesNotExist:
            return Response({'detail': 'Student not found.'}, status=404)
        if actor.role == 'teacher':
            from groups.models import GroupMembership
            if not GroupMembership.objects.filter(student=student, group__teacher=actor).exists():
                return Response({'detail': 'You can only manage your own students.'}, status=403)
        student.is_active = bool(request.data.get('is_active', True))
        student.save(update_fields=['is_active'])
        return Response({'id': student.id, 'is_active': student.is_active})


class TeacherActiveView(APIView):
    """Activate / deactivate a teacher (admin only). A deactivated teacher
    cannot log in and is hidden from the admin dashboard's Teachers list,
    but their groups and data are untouched — students keep full access."""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk):
        actor = request.user
        if actor.role != 'admin' or not actor.academy:
            return Response({'detail': 'Admin only.'}, status=403)
        try:
            teacher = User.objects.get(pk=pk, role='teacher', academy=actor.academy)
        except User.DoesNotExist:
            return Response({'detail': 'Teacher not found.'}, status=404)
        teacher.is_active = bool(request.data.get('is_active', True))
        teacher.save(update_fields=['is_active'])
        return Response({'id': teacher.id, 'is_active': teacher.is_active})


class ChangePasswordView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        new_password = request.data.get('new_password', '')
        old_password = request.data.get('old_password', '')

        if len(new_password) < 6:
            return Response({'detail': 'Password must be at least 6 characters.'}, status=400)

        user = request.user
        if user.has_usable_password():
            if not old_password:
                return Response({'detail': 'Current password is required.'}, status=400)
            if not user.check_password(old_password):
                return Response({'detail': 'Current password is incorrect.'}, status=400)

        user.set_password(new_password)
        user.save()
        return Response({'detail': 'Password changed successfully.'})


class ConnectTelegramView(APIView):
    """Generates a one-time deep-link token so a logged-in user can link their Telegram."""
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        from .models import TelegramConnectToken
        import os

        if request.user.telegram_id:
            return Response({'detail': 'Telegram is already connected.'}, status=400)

        token_str = secrets.token_urlsafe(16)
        TelegramConnectToken.objects.filter(user=request.user).delete()
        TelegramConnectToken.objects.create(user=request.user, token=token_str)

        bot_username = os.environ.get('TELEGRAM_BOT_USERNAME', 'YourAcademyBot')
        deep_link = f'https://t.me/{bot_username}?start={token_str}'
        return Response({'link': deep_link})

    def delete(self, request):
        """Unlink Telegram from account."""
        request.user.telegram_id = None
        request.user.save(update_fields=['telegram_id'])
        return Response({'detail': 'Telegram disconnected.'})


class TelegramMiniAppLoginView(APIView):
    """Silent login for the Telegram Mini App: verifies `Telegram.WebApp.initData`
    and, if that Telegram account is already linked to a user, issues JWTs —
    same response shape as RegisterView, so the frontend reuses its login()."""
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        from .telegram_webapp import verify_init_data

        init_data = request.data.get('init_data', '')
        bot_token = getattr(settings, 'TELEGRAM_BOT_TOKEN', '')
        tg_user = verify_init_data(init_data, bot_token)
        if not tg_user:
            return Response({'detail': 'Invalid Telegram data.'}, status=400)

        user = User.objects.filter(telegram_id=tg_user.get('id')).first()
        if not user:
            return Response({'linked': False})

        refresh = RefreshToken.for_user(user)
        return Response({
            'linked': True,
            'user': UserSerializer(user, context={'request': request}).data,
            'tokens': {
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            },
        })


class PasswordResetRequestView(APIView):
    """Step 1 — user enters their username, OTP is sent to their Telegram."""
    permission_classes = (permissions.AllowAny,)
    throttle_classes = [PasswordResetRateThrottle]

    def post(self, request):
        from .models import TelegramOTP

        username = request.data.get('username', '').strip()
        if not username:
            return Response({'detail': 'Username is required.'}, status=400)

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            # Avoid username enumeration — return same response
            return Response({'detail': 'If this account exists and has Telegram connected, an OTP has been sent.'})

        if not user.telegram_id:
            return Response(
                {'detail': 'no_telegram',
                 'message': 'This account has no Telegram connected. Contact your admin to reset your password.'},
                status=400,
            )

        code = f'{random.randint(0, 999999):06d}'
        expires_at = timezone.now() + timedelta(minutes=5)

        # Invalidate any previous unused OTPs
        TelegramOTP.objects.filter(user=user, used=False).delete()
        TelegramOTP.objects.create(user=user, code=code, expires_at=expires_at)

        try:
            from asgiref.sync import async_to_sync
            from .telegram_bot import send_otp
            lang = user.telegram_lang or 'uz'
            async_to_sync(send_otp)(user.telegram_id, code, lang)
        except Exception as e:
            import logging
            logging.getLogger(__name__).error(f'OTP send failed: {e}')
            return Response({'detail': 'Failed to send OTP. Please try again later.'}, status=500)

        return Response({'detail': 'If this account exists and has Telegram connected, an OTP has been sent.'})


class PasswordResetConfirmView(APIView):
    """Step 2 — user submits username + OTP + new password."""
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        from .models import TelegramOTP

        username     = request.data.get('username', '').strip()
        code         = request.data.get('code', '').strip()
        new_password = request.data.get('new_password', '').strip()

        if not username or not code or not new_password:
            return Response({'detail': 'username, code, and new_password are required.'}, status=400)

        if len(new_password) < 6:
            return Response({'detail': 'Password must be at least 6 characters.'}, status=400)

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            return Response({'detail': 'Invalid code or username.'}, status=400)

        otp = TelegramOTP.objects.filter(user=user, code=code, used=False).order_by('-expires_at').first()

        if not otp or not otp.is_valid():
            return Response({'detail': 'Invalid or expired code.'}, status=400)

        otp.used = True
        otp.save(update_fields=['used'])

        user.set_password(new_password)
        user.save()

        return Response({'detail': 'Password reset successfully. You can now log in.'})


class NotificationListView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        from .models import Notification
        notifs = Notification.objects.filter(user=request.user)[:50]
        data = [
            {
                'id':         n.id,
                'type':       n.type,
                'title':      n.title,
                'body':       n.body,
                'is_read':    n.is_read,
                'created_at': n.created_at.isoformat(),
            }
            for n in notifs
        ]
        unread = sum(1 for n in data if not n['is_read'])
        return Response({'results': data, 'unread': unread})

    def post(self, request):
        from .models import Notification
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({'detail': 'All marked as read.'})


class NotificationReadView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk):
        from .models import Notification
        Notification.objects.filter(pk=pk, user=request.user).update(is_read=True)
        return Response({'detail': 'Marked as read.'})


class TeacherLeaderboardView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        if request.user.role != 'teacher':
            return Response({'detail': 'Forbidden.'}, status=403)

        from groups.models import GroupMembership, Lesson, Score, Attendance

        memberships = list(
            GroupMembership.objects
            .filter(group__teacher=request.user, group__is_graduated=False, student__is_active=True)
            .select_related('student', 'group')
        )
        if not memberships:
            return Response([])

        # Bulk-fetch everything up front (4 queries total, independent of
        # membership count) instead of re-querying Lesson/Score/Attendance
        # per membership — that used to be ~5 queries each, which got very
        # slow once lesson/score history grew.
        group_ids = {m.group_id for m in memberships}
        lessons_by_group = {}
        for gid, lid, date in Lesson.objects.filter(group_id__in=group_ids).values_list('group_id', 'id', 'date'):
            lessons_by_group.setdefault(gid, []).append((lid, date))
        all_lesson_ids = [lid for lessons in lessons_by_group.values() for lid, _ in lessons]

        student_ids = {m.student_id for m in memberships}
        score_by_key = {
            (student_id, lesson_id): value
            for student_id, lesson_id, value in Score.objects
                .filter(lesson_id__in=all_lesson_ids, student_id__in=student_ids)
                .values_list('student_id', 'lesson_id', 'value')
        }
        attendance_by_key = {
            (student_id, lesson_id): present
            for student_id, lesson_id, present in Attendance.objects
                .filter(lesson_id__in=all_lesson_ids, student_id__in=student_ids)
                .values_list('student_id', 'lesson_id', 'present')
        }

        student_map = {}
        for m in memberships:
            s = m.student
            sid = s.id
            if sid not in student_map:
                student_map[sid] = {
                    'id':            sid,
                    'display_name':  f'{s.first_name} {s.last_name}'.strip() or s.username,
                    'username':      s.username,
                    'groups':        set(),
                    'total_score':   0,
                    'total_possible': 0,
                    'total_att':     0,
                    'present_att':   0,
                }
            data = student_map[sid]
            data['groups'].add(m.group.name)
            join_date = m.joined_at.date()
            eligible_lesson_ids = [lid for lid, date in lessons_by_group.get(m.group_id, []) if date >= join_date]
            if eligible_lesson_ids:
                data['total_score']    += sum(score_by_key.get((sid, lid), 0) for lid in eligible_lesson_ids)
                data['total_possible'] += len(eligible_lesson_ids) * 5
                for lid in eligible_lesson_ids:
                    present = attendance_by_key.get((sid, lid))
                    if present is not None:
                        data['total_att']   += 1
                        data['present_att'] += 1 if present else 0

        results = []
        for sid, data in student_map.items():
            comp = round(data['total_score'] / data['total_possible'] * 100) if data['total_possible'] > 0 else None
            results.append({
                'id':           data['id'],
                'display_name': data['display_name'],
                'username':     data['username'],
                'groups':       sorted(data['groups']),
                'avg_score':    comp,
                'attendance':   round(data['present_att'] / data['total_att'] * 100) if data['total_att'] else None,
            })

        results.sort(key=lambda x: (x['avg_score'] is None, -(x['avg_score'] or 0)))
        return Response(results)


class TelegramWebhookView(APIView):
    authentication_classes = []
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        secret = request.headers.get('X-Telegram-Bot-Api-Secret-Token', '')
        expected = getattr(settings, 'TELEGRAM_WEBHOOK_SECRET', '')
        if expected and secret != expected:
            return Response(status=403)

        try:
            data = request.data
            from users.telegram_bot import get_application
            from telegram import Update
            app = get_application()
            update = Update.de_json(data, app.bot)
            async_to_sync(app.process_update)(update)
        except Exception as e:
            logger.error('Telegram webhook error: %s', e, exc_info=True)

        return Response({'ok': True})


# ── Individual Notification ───────────────────────────────────────────────────

class UserNotifyView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def _check_permission(self, request):
        return request.user.role in ('teacher', 'admin')

    def get(self, request, pk):
        if not self._check_permission(request) and request.user.pk != pk:
            return Response(status=403)
        student = get_object_or_404(User, pk=pk, role='student')
        parents = []
        for ps in student.parents.select_related('parent').all():
            p = ps.parent
            parents.append({
                'id':                 p.id,
                'name':               f'{p.first_name} {p.last_name}'.strip() or p.username,
                'telegram_connected': bool(p.telegram_id),
            })
        return Response({
            'student': {
                'id':                 student.id,
                'name':               f'{student.first_name} {student.last_name}'.strip() or student.username,
                'telegram_connected': bool(student.telegram_id),
            },
            'parents': parents,
        })

    def post(self, request, pk):
        if not self._check_permission(request):
            return Response(status=403)
        student = get_object_or_404(User, pk=pk, role='student')

        message    = request.data.get('message', '').strip()
        recipients = request.data.get('recipients', [])

        if not message:
            return Response({'detail': 'Message is required.'}, status=400)
        if len(message) > 300:
            return Response({'detail': 'Message too long (max 300 chars).'}, status=400)
        if not recipients:
            return Response({'detail': 'Select at least one recipient.'}, status=400)

        from .models import Notification
        from users.telegram_bot import send_notification

        sender_name   = f'{request.user.first_name} {request.user.last_name}'.strip() or request.user.username
        student_name  = f'{student.first_name} {student.last_name}'.strip() or student.username
        sent = 0

        if 'student' in recipients:
            Notification.objects.create(
                user=student, type='lesson',
                title=f'📢 {sender_name}',
                body=message,
            )
            if student.telegram_id:
                try:
                    async_to_sync(send_notification)(
                        student.telegram_id, 'direct_message',
                        student.telegram_lang or 'uz',
                        sender=sender_name, message=message,
                    )
                except Exception:
                    pass
            sent += 1

        parent_ids = [r for r in recipients if isinstance(r, int)]
        for parent_id in parent_ids:
            try:
                parent = User.objects.get(pk=parent_id, role='parent')
            except User.DoesNotExist:
                continue
            Notification.objects.create(
                user=parent, type='lesson',
                title=f'📢 {sender_name}',
                body=f'{student_name}: {message}',
            )
            if parent.telegram_id:
                try:
                    async_to_sync(send_notification)(
                        parent.telegram_id, 'direct_message_parent',
                        parent.telegram_lang or 'uz',
                        sender=sender_name, student=student_name, message=message,
                    )
                except Exception:
                    pass
            sent += 1

        return Response({'ok': True, 'sent': sent})


# ── Web Push ───────────────────────────────────────────────────────────────────

def send_push_notification(user_ids, title, body):
    from .models import PushSubscription
    from django.conf import settings
    from pywebpush import webpush, WebPushException
    import json as _json

    private_key = settings.VAPID_PRIVATE_KEY
    if not private_key:
        return

    subs = PushSubscription.objects.filter(user_id__in=user_ids)
    stale = []
    for sub in subs:
        try:
            webpush(
                subscription_info={
                    'endpoint': sub.endpoint,
                    'keys': {'p256dh': sub.p256dh, 'auth': sub.auth},
                },
                data=_json.dumps({'title': title, 'body': body}),
                vapid_private_key=private_key,
                vapid_claims={'sub': f'mailto:{settings.VAPID_CLAIMS_EMAIL}'},
            )
        except WebPushException as ex:
            if ex.response is not None and ex.response.status_code in (404, 410):
                stale.append(sub.id)
        except Exception:
            pass

    if stale:
        PushSubscription.objects.filter(id__in=stale).delete()


class PushSubscribeView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        from .models import PushSubscription
        endpoint = request.data.get('endpoint')
        p256dh   = request.data.get('p256dh')
        auth     = request.data.get('auth')
        if not (endpoint and p256dh and auth):
            return Response({'detail': 'endpoint, p256dh, auth required.'}, status=400)
        PushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={'user': request.user, 'p256dh': p256dh, 'auth': auth},
        )
        return Response({'ok': True})

    def delete(self, request):
        from .models import PushSubscription
        endpoint = request.data.get('endpoint')
        if endpoint:
            PushSubscription.objects.filter(user=request.user, endpoint=endpoint).delete()
        return Response(status=204)


