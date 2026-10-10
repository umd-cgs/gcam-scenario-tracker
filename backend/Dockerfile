FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app
COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --uid 10001 --create-home tracker
COPY backend ./backend
COPY mappings ./mappings
USER tracker
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=4)"
CMD ["gunicorn", "backend.app:app", "--bind", "0.0.0.0:8000", "--workers", "1", "--worker-class", "sync", "--timeout", "180", "--graceful-timeout", "180", "--access-logfile", "-", "--error-logfile", "-"]
