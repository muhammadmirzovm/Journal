from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import FileResponse, Http404
import os

def serve_spa(request, path=''):
    whitenoise_root = getattr(settings, 'WHITENOISE_ROOT', None)
    if whitenoise_root:
        index_file = whitenoise_root / 'index.html'
        if os.path.exists(index_file):
            return FileResponse(open(index_file, 'rb'), content_type='text/html')
    raise Http404('Frontend is served separately.')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('users.urls')),
    path('api/', include('groups.urls')),
    path('api/', include('quiz.urls')),
    path('api/', include('academies.urls')),
    path('api/', include('rewards.urls')),
    path('api/', include('games.urls')),
    path('api/', include('coins.urls')),
    path('api/', include('purchases.urls')),
    path('api/', include('payments.urls')),
    re_path(r'^(?!api/|admin/|static/|media/).*$', serve_spa),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
