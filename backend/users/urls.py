from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from backend.throttles import LoginRateThrottle
from .views import (
    RegisterView, MeView, ProfileView, UserStatsView,
    OnlineCountView, PlatformStatsView,
    ParentChildrenView, AdminStatsView, AdminStudentsView, StudentActiveView, TeacherActiveView, UserChildrenView, UserGroupsView,
    ChangePasswordView, ConnectTelegramView, TelegramMiniAppLoginView,
    PasswordResetRequestView, PasswordResetConfirmView,
    TelegramWebhookView, TeacherLeaderboardView,
    NotificationListView, NotificationReadView, UserNotifyView,
    PushSubscribeView,
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    # Brute-force protection: TokenObtainPairView has no throttle of its own,
    # so give it the dedicated 'login' scope instead of falling back to the
    # generic shared 'anon' bucket used by every other public endpoint.
    path('login/', TokenObtainPairView.as_view(throttle_classes=[LoginRateThrottle]), name='token_obtain'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('users/online/', OnlineCountView.as_view(), name='online_count'),
    path('users/platform-stats/', PlatformStatsView.as_view(), name='platform_stats'),
    path('users/<int:pk>/', ProfileView.as_view(), name='profile'),
    path('users/<int:pk>/stats/', UserStatsView.as_view(), name='user_stats'),
    path('users/<int:pk>/children/', UserChildrenView.as_view(), name='user_children'),
    path('users/<int:pk>/groups/',   UserGroupsView.as_view(),   name='user_groups'),
    path('my-children/', ParentChildrenView.as_view(), name='my_children'),
    path('link-child/', ParentChildrenView.as_view(), name='link_child'),
    path('admin-stats/',     AdminStatsView.as_view(),    name='admin_stats'),
    path('admin/students/',  AdminStudentsView.as_view(), name='admin_students'),
    path('students/<int:pk>/active/', StudentActiveView.as_view(), name='student_active'),
    path('teachers/<int:pk>/active/', TeacherActiveView.as_view(), name='teacher_active'),
    path('change-password/', ChangePasswordView.as_view(), name='change_password'),
    path('connect-telegram/', ConnectTelegramView.as_view(), name='connect_telegram'),
    path('telegram/miniapp-login/', TelegramMiniAppLoginView.as_view(), name='telegram_miniapp_login'),
    path('password-reset/request/', PasswordResetRequestView.as_view(), name='password_reset_request'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password_reset_confirm'),
    path('telegram/webhook/', TelegramWebhookView.as_view(), name='telegram_webhook'),
    path('teacher/leaderboard/', TeacherLeaderboardView.as_view(), name='teacher_leaderboard'),
    path('notifications/', NotificationListView.as_view(), name='notifications'),
    path('notifications/<int:pk>/read/', NotificationReadView.as_view(), name='notification_read'),
    path('users/<int:pk>/notify/',       UserNotifyView.as_view(),       name='user_notify'),
    path('push/subscribe/',              PushSubscribeView.as_view(),    name='push_subscribe'),
]
