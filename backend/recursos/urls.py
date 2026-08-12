from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import RecursoViewSet

router = DefaultRouter()
router.register(r'', RecursoViewSet, basename='recursos')

urlpatterns = [
    path('', include(router.urls)),
]
