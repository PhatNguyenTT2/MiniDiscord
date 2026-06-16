const express = require('express');
const play = require('play-dl');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());

// Main extraction endpoint — only accepts direct YouTube video URLs
app.get('/extract', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter q' });
  }

  try {
    // Validate: only accept direct YouTube video URLs
    const validation = play.yt_validate(query);
    if (validation !== 'video') {
      console.log(`[MusicExtractor] Rejected non-video input: "${query}" (type: ${validation})`);
      return res.status(400).json({
        error: 'Please provide a valid YouTube video URL (e.g. https://www.youtube.com/watch?v=xxxxx)'
      });
    }

    console.log(`[MusicExtractor] Resolving video URL: "${query}"`);
    const videoInfo = await play.video_info(query);
    const title = videoInfo.video_details.title;
    const duration = videoInfo.video_details.durationInSec;
    const thumbnail = videoInfo.video_details.thumbnails[0]?.url || '';

    console.log(`[MusicExtractor] Extracting audio stream for: "${title}"`);
    const stream = await play.stream(query, { quality: 2 });

    if (!stream || !stream.url) {
      throw new Error('Failed to extract direct audio URL from YouTube');
    }

    console.log(`[MusicExtractor] Success — streaming: "${title}" (${duration}s)`);
    return res.json({
      trackId: uuidv4(),
      title: title,
      directUrl: stream.url,
      duration: duration,
      thumbnail: thumbnail
    });
  } catch (error) {
    console.error('[MusicExtractor] Extraction failed:', error.message);

    // Provide actionable error messages based on failure type
    if (error.message?.includes('Sign in to confirm') || error.message?.includes('429')) {
      return res.status(429).json({
        error: 'YouTube is temporarily blocking requests from this server. Please try again later.'
      });
    }
    if (error.message?.includes('Captcha')) {
      return res.status(429).json({
        error: 'YouTube CAPTCHA triggered. The server IP may be rate-limited.'
      });
    }

    return res.status(500).json({
      error: error.message || 'Internal server error while extracting stream'
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'music-extractor' });
});

app.listen(PORT, () => {
  console.log(`[MusicExtractor] Listening on port ${PORT}`);
});
