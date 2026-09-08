from rest_framework import serializers
from .models import TuitionCategory, TuitionTemplate, GroupTuition, StudentTuition, Payment


class TuitionCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = TuitionCategory
        fields = ('id', 'name')


class TuitionTemplateSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True)

    class Meta:
        model = TuitionTemplate
        fields = ('id', 'category', 'category_name', 'name', 'default_price', 'created_at')


class GroupTuitionSerializer(serializers.ModelSerializer):
    template_name  = serializers.CharField(source='template.name', read_only=True)
    default_price  = serializers.IntegerField(source='template.default_price', read_only=True)

    class Meta:
        model = GroupTuition
        fields = ('id', 'group', 'template', 'template_name', 'default_price')


class StudentTuitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentTuition
        fields = ('id', 'student', 'group', 'custom_price', 'updated_at')


class PaymentSerializer(serializers.ModelSerializer):
    student_name = serializers.SerializerMethodField()
    group_name   = serializers.CharField(source='group.name', read_only=True)
    method_label = serializers.CharField(source='get_method_display', read_only=True)

    class Meta:
        model = Payment
        fields = (
            'id', 'student', 'student_name', 'group', 'group_name', 'amount',
            'method', 'method_label', 'note', 'receipt_code', 'paid_at', 'created_at',
        )

    def get_student_name(self, obj):
        return f'{obj.student.first_name} {obj.student.last_name}'.strip() or obj.student.username
