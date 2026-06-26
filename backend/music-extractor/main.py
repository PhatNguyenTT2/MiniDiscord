from fastapi import FastAPI, Query, HTTPException
from fastapi.responses import JSONResponse
import yt_dlp
import uuid
import logging
import shutil
import os
from huggingface_hub import InferenceClient
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="MiniDiscord AI Worker")
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("ai-worker")

HF_TOKEN = os.getenv("HF_ACCESS_TOKEN")
client = InferenceClient(
    model="Qwen/Qwen2.5-7B-Instruct",
    token=HF_TOKEN
)

class MessageItem(BaseModel):
    sender: str
    content: str

class ChatPayload(BaseModel):
    prompt: str
    senderName: Optional[str] = "User"
    history: Optional[List[MessageItem]] = None

class SummarizePayload(BaseModel):
    messages: List[MessageItem]

YDL_OPTS = {
    "format": "bestaudio/best",
    "quiet": True,
    "no_warnings": True,
    "extract_flat": False,
    "noplaylist": True,
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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

@app.post("/ai/chat")
async def ai_chat(payload: ChatPayload):
    try:
        user_prompt = payload.prompt
        system_prompt = (
            "You are a helpful and friendly AI Assistant in a Discord-like server named MiniDiscord. "
            "Keep responses concise, interactive, and friendly. "
            "Always respond in the exact language the user used (such as English or Vietnamese)."
        )
        messages = [{"role": "system", "content": system_prompt}]
        
        if payload.history:
            formatted_history = "Here is the recent chat history in this channel for context:\n"
            for msg in payload.history:
                formatted_history += f"[{msg.sender}]: {msg.content}\n"
            messages.append({"role": "user", "content": formatted_history + "\nUnderstood. Please perform the user's request based on this context if relevant."})
            messages.append({"role": "assistant", "content": "I have read the history. How can I help you?"})
            
        messages.append({"role": "user", "content": user_prompt})
        
        response = client.chat_completion(
            model="Qwen/Qwen2.5-7B-Instruct",
            messages=messages,
            max_tokens=256
        )
        bot_response = response.choices[0].message.content
        return {"response": bot_response.strip()}
    except Exception as e:
        log.error(f"Hugging Face Inference Chat Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ai/summarize")
async def ai_summarize(payload: SummarizePayload):
    try:
        if not payload.messages:
            return {"summary": "Không có tin nhắn nào để tóm tắt."}
        formatted_chat = ""
        for msg in payload.messages:
            formatted_chat += f"[{msg.sender}]: {msg.content}\n"
        system_prompt = (
            "You are an AI assistant. Summarize the conversation log concisely as a bulleted list. "
            "Always reply in the same language as the conversation log (e.g. Vietnamese if chat log is Vietnamese, English if English)."
        )
        user_prompt = f"Here is the chat conversation:\n{formatted_chat}\nProvide a brief summary of the conversation."
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ]
        response = client.chat_completion(
            model="Qwen/Qwen2.5-7B-Instruct",
            messages=messages,
            max_tokens=256
        )
        summary = response.choices[0].message.content
        return {"summary": summary.strip()}
    except Exception as e:
        log.error(f"Hugging Face Inference Summarize Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-worker", "engine": "yt-dlp+huggingface"}
