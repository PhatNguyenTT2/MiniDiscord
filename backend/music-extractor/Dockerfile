FROM python:3.12-slim

WORKDIR /app

# Install ffmpeg for yt-dlp
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

COPY music-extractor/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install -U yt-dlp

COPY music-extractor/ .

EXPOSE 3001

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "3001"]
