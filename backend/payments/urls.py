from django.urls import path
from .views import (
    TuitionCategoryListCreateView, TuitionTemplateListCreateView,
    GroupTuitionView, StudentTuitionOverrideView,
    BalancesListView, BalancesExportExcelView, RecordPaymentView, PaymentHistoryView, PaymentVoidView,
    PaymentReceiptView, MyPaymentsView,
)

urlpatterns = [
    path('payments/categories/',                          TuitionCategoryListCreateView.as_view(), name='tuition_categories'),
    path('payments/templates/',                            TuitionTemplateListCreateView.as_view(), name='tuition_templates'),
    path('payments/groups/<int:pk>/tuition/',              GroupTuitionView.as_view(),               name='group_tuition'),
    path('payments/students/<int:pk>/groups/<int:group_id>/override/', StudentTuitionOverrideView.as_view(), name='student_tuition_override'),
    path('payments/balances/export/',                      BalancesExportExcelView.as_view(),         name='payment_balances_export'),
    path('payments/balances/',                             BalancesListView.as_view(),                name='payment_balances'),
    path('payments/record/',                                RecordPaymentView.as_view(),               name='payment_record'),
    path('payments/history/',                               PaymentHistoryView.as_view(),              name='payment_history'),
    path('payments/mine/',                                  MyPaymentsView.as_view(),                  name='my_payments'),
    path('payments/<int:pk>/receipt/',                      PaymentReceiptView.as_view(),               name='payment_receipt'),
    path('payments/<int:pk>/',                               PaymentVoidView.as_view(),                  name='payment_void'),
]
