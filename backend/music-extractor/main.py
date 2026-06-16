from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import JSONResponse
import yt_dlp
import uuid
import logging

app = FastAPI(title="MiniDiscord Music Extractor")
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("music-extractor")

import shutil
import os

YDL_OPTS = {
    "format": "bestaudio/best",
    "quiet": True,
    "no_warnings": True,
    "extract_flat": False,
    "noplaylist": True,
}

# Determine if we should use writeable cookies.txt
if os.path.exists("/app/cookies.txt"):
    try:
        with open("/app/cookies.txt", "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
        has_cookies = any(line.strip() and not line.startswith("#") for line in lines)
        if has_cookies:
            shutil.copy2("/app/cookies.txt", "/tmp/cookies.txt")
            # Make sure it is writable
            try:
                os.chmod("/tmp/cookies.txt", 0o666)
            except Exception:
                pass
            YDL_OPTS["cookiefile"] = "/tmp/cookies.txt"
            log.info("Loaded YouTube cookies to writable /tmp/cookies.txt")
        else:
            log.info("Mounted cookies.txt is placeholder/empty. Skipping cookiefile.")
    except Exception as e:
        log.warning(f"Could not load cookies.txt: {e}")

def extract_audio_info(query: str):
    try:
        with yt_dlp.YoutubeDL(YDL_OPTS) as ydl:
            # download=False because we only want the direct streaming URL, not saving it to disk
            info = ydl.extract_info(query, download=False)
            
            # If it's a playlist or list of entries (e.g. search page), pick the first one
            if 'entries' in info:
                info = info['entries'][0]

        audio_url = info.get("url")
        if not audio_url:
            # Fallback: pick best audio format
            for fmt in info.get("formats", []):
                if fmt.get("acodec") != "none" and fmt.get("vcodec") == "none":
                    audio_url = fmt["url"]
                    break
            if not audio_url:
                audio_url = info["formats"][-1]["url"]

        return {
            "trackId": str(uuid.uuid4()),
            "title": info.get("title", "Unknown"),
            "directUrl": audio_url,
            "duration": info.get("duration", 0),
            "thumbnail": info.get("thumbnail", ""),
        }

    except Exception as e:
        log.error(f"yt-dlp error: {e}")
        raise e

@app.get("/extract")
def extract(q: str = Query(..., description="Link YouTube hoặc từ khóa tìm kiếm")):
    try:
        # Validate: only accept YouTube video URLs
        if not q or not any(
            q.startswith(p) for p in [
                "https://www.youtube.com/",
                "https://youtu.be/",
                "https://m.youtube.com/",
                "https://music.youtube.com/",
            ]
        ):
            raise HTTPException(status_code=400, detail="Only YouTube video URLs are supported")
        return extract_audio_info(q)
    except yt_dlp.utils.DownloadError as e:
        if "429" in str(e) or "Sign in" in str(e):
            raise HTTPException(status_code=429, detail="YouTube is rate-limiting this server")
        raise HTTPException(status_code=500, detail=str(e))
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok", "service": "music-extractor", "engine": "yt-dlp"}
