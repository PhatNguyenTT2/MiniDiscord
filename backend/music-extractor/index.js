const express = require('express');
const play = require('play-dl');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Express JSON parsing
app.use(express.json());

// Main extraction endpoint
app.get('/extract', async (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: 'Missing query parameter q' });
  }

  try {
    let videoUrl = query;
    let title = '';
    let duration = 0;
    let thumbnail = '';

    // Check if query is a valid youtube URL, else treat it as a search query
    const validation = play.yt_validate(query);
    if (!validation) {
      // Search for the video
      console.log(`[MusicExtractor] Searching for: "${query}"`);
      const searchResults = await play.search(query, { limit: 1, source: { youtube: 'video' } });
      if (!searchResults || searchResults.length === 0) {
        return res.status(404).json({ error: 'No results found on YouTube' });
      }
      const firstResult = searchResults[0];
      videoUrl = firstResult.url;
      title = firstResult.title;
      duration = firstResult.durationInSec;
      thumbnail = firstResult.thumbnails[0]?.url || '';
    } else {
      console.log(`[MusicExtractor] Resolving URL: "${videoUrl}"`);
      const videoInfo = await play.video_info(videoUrl);
      title = videoInfo.video_details.title;
      duration = videoInfo.video_details.durationInSec;
      thumbnail = videoInfo.video_details.thumbnails[0]?.url || '';
    }

    // Extract raw audio stream URL
    console.log(`[MusicExtractor] Extracting stream for video: "${videoUrl}"`);
    const stream = await play.stream(videoUrl, { filter: 'audioonly' });

    if (!stream || !stream.url) {
      throw new Error('Failed to extract direct audio URL');
    }

    return res.json({
      trackId: uuidv4(),
      title: title,
      directUrl: stream.url,
      duration: duration,
      thumbnail: thumbnail
    });
  } catch (error) {
    console.error('[MusicExtractor] Error extracting stream:', error);
    return res.status(500).json({ error: error.message || 'Internal server error while extracting stream' });
  }
});

app.listen(PORT, () => {
  console.log(`[MusicExtractor] Listening on port ${PORT}`);
});
