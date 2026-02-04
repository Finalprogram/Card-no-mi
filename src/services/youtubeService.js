const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';

function parseChannelConfig(rawValue) {
  if (!rawValue) return [];

  return rawValue
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const [channelId, ...nameParts] = item.split(':');
      return {
        channelId: (channelId || '').trim(),
        name: (nameParts.join(':') || '').trim()
      };
    })
    .filter(item => item.channelId);
}

function interleaveVideosByCreator(creators, maxTotal = 24) {
  const queues = creators
    .map(creator => ({
      creator,
      videos: Array.isArray(creator.videos) ? [...creator.videos] : []
    }))
    .filter(item => item.videos.length > 0);

  const mixed = [];

  while (queues.length > 0 && mixed.length < maxTotal) {
    for (let index = 0; index < queues.length && mixed.length < maxTotal; index += 1) {
      const queue = queues[index];
      const nextVideo = queue.videos.shift();
      if (nextVideo) {
        mixed.push({
          ...nextVideo,
          creatorChannelId: queue.creator.channelId,
          creatorChannelUrl: queue.creator.channelUrl,
          creatorDisplayName: queue.creator.name
        });
      }
    }

    for (let index = queues.length - 1; index >= 0; index -= 1) {
      if (queues[index].videos.length === 0) queues.splice(index, 1);
    }
  }

  return mixed;
}

function parseIsoDurationToSeconds(isoDuration = '') {
  // PT1H2M3S, PT4M, PT59S, etc.
  const match = isoDuration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = Number(match[3] || 0);
  return (hours * 3600) + (minutes * 60) + seconds;
}

async function fetchVideoDurationsById(videoIds, apiKey) {
  const uniqueIds = Array.from(new Set((videoIds || []).filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const params = new URLSearchParams({
    key: apiKey,
    part: 'contentDetails',
    id: uniqueIds.join(',')
  });

  const response = await fetch(`${YOUTUBE_API_BASE}/videos?${params.toString()}`);
  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`YouTube API error (${response.status}): ${payload}`);
  }

  const data = await response.json();
  const items = Array.isArray(data.items) ? data.items : [];
  const durationMap = {};
  items.forEach(item => {
    durationMap[item.id] = parseIsoDurationToSeconds(item.contentDetails?.duration || '');
  });
  return durationMap;
}

async function fetchLatestChannelVideos({ channelId, apiKey, maxResults = 3, creatorName = '' }) {
  const params = new URLSearchParams({
    key: apiKey,
    channelId,
    part: 'snippet',
    order: 'date',
    maxResults: String(maxResults),
    type: 'video'
  });

  const response = await fetch(`${YOUTUBE_API_BASE}/search?${params.toString()}`);
  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`YouTube API error (${response.status}): ${payload}`);
  }

  const data = await response.json();
  const items = Array.isArray(data.items) ? data.items : [];

  const mappedVideos = items
    .filter(item => item.id && item.id.videoId)
    .map(item => ({
      id: item.id.videoId,
      title: item.snippet?.title || 'Vídeo sem título',
      thumbnail: item.snippet?.thumbnails?.high?.url
        || item.snippet?.thumbnails?.medium?.url
        || item.snippet?.thumbnails?.default?.url
        || '',
      publishedAt: item.snippet?.publishedAt || null,
      channelTitle: item.snippet?.channelTitle || creatorName || channelId,
      creatorName: creatorName || item.snippet?.channelTitle || channelId,
      videoUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`
    }));

  const minVideoSeconds = Number(process.env.YOUTUBE_MIN_VIDEO_SECONDS || 61);
  const durationMap = await fetchVideoDurationsById(mappedVideos.map(video => video.id), apiKey);

  return mappedVideos.filter(video => (durationMap[video.id] || 0) >= minVideoSeconds);
}

async function fetchLatestPlaylistVideos({ playlistId, apiKey, maxResults = 3, creatorName = '' }) {
  const fetchLimit = Math.max(10, Math.min(50, Number(maxResults) * 8));
  const params = new URLSearchParams({
    key: apiKey,
    playlistId,
    part: 'snippet',
    maxResults: String(fetchLimit)
  });

  const response = await fetch(`${YOUTUBE_API_BASE}/playlistItems?${params.toString()}`);
  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`YouTube API error (${response.status}): ${payload}`);
  }

  const data = await response.json();
  const items = Array.isArray(data.items) ? data.items : [];

  const mappedVideos = items
    .filter(item => item.snippet?.resourceId?.videoId)
    .map(item => {
      const videoId = item.snippet.resourceId.videoId;
      return {
        id: videoId,
        title: item.snippet?.title || 'Vídeo sem título',
        thumbnail: item.snippet?.thumbnails?.high?.url
          || item.snippet?.thumbnails?.medium?.url
          || item.snippet?.thumbnails?.default?.url
          || '',
        publishedAt: item.snippet?.publishedAt || null,
        channelTitle: item.snippet?.videoOwnerChannelTitle || item.snippet?.channelTitle || creatorName || playlistId,
        creatorName: creatorName || item.snippet?.videoOwnerChannelTitle || item.snippet?.channelTitle || playlistId,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`
      };
    });

  const minVideoSeconds = Number(process.env.YOUTUBE_MIN_VIDEO_SECONDS || 61);
  const durationMap = await fetchVideoDurationsById(mappedVideos.map(video => video.id), apiKey);

  return mappedVideos
    .filter(video => (durationMap[video.id] || 0) >= minVideoSeconds)
    .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0))
    .slice(0, maxResults);
}

async function getCreatorsLatestVideos() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const mode = String(process.env.YOUTUBE_CREATOR_MODE || 'channel').trim().toLowerCase();
  const playlists = parseChannelConfig(process.env.YOUTUBE_CREATOR_PLAYLISTS);
  const channels = parseChannelConfig(process.env.YOUTUBE_CREATOR_CHANNELS);
  const maxResults = Number(process.env.YOUTUBE_CREATOR_MAX_RESULTS || 3);

  if (!apiKey || (playlists.length === 0 && channels.length === 0)) {
    return { enabled: false, creators: [] };
  }

  const creators = [];

  const usePlaylistMode = mode === 'playlist';

  if (usePlaylistMode && playlists.length > 0) {
    for (const playlist of playlists) {
      try {
        const videos = await fetchLatestPlaylistVideos({
          playlistId: playlist.channelId,
          creatorName: playlist.name,
          apiKey,
          maxResults
        });

        creators.push({
          channelId: playlist.channelId,
          name: playlist.name || videos[0]?.channelTitle || playlist.channelId,
          channelUrl: `https://www.youtube.com/playlist?list=${playlist.channelId}`,
          videos
        });
      } catch (error) {
        creators.push({
          channelId: playlist.channelId,
          name: playlist.name || playlist.channelId,
          channelUrl: `https://www.youtube.com/playlist?list=${playlist.channelId}`,
          videos: [],
          error: error.message
        });
      }
    }

    return {
      enabled: true,
      mode: 'playlist',
      creators,
      interleavedVideos: interleaveVideosByCreator(creators, Math.max(12, maxResults * Math.max(creators.length, 1)))
    };
  }

  for (const channel of channels) {
    try {
      const videos = await fetchLatestChannelVideos({
        channelId: channel.channelId,
        creatorName: channel.name,
        apiKey,
        maxResults
      });

      creators.push({
        channelId: channel.channelId,
        name: channel.name || (videos[0]?.channelTitle ?? channel.channelId),
        channelUrl: `https://www.youtube.com/channel/${channel.channelId}`,
        videos
      });
    } catch (error) {
      creators.push({
        channelId: channel.channelId,
        name: channel.name || channel.channelId,
        channelUrl: `https://www.youtube.com/channel/${channel.channelId}`,
        videos: [],
        error: error.message
      });
    }
  }

  return {
    enabled: true,
    mode: 'channel',
    creators,
    interleavedVideos: interleaveVideosByCreator(creators, Math.max(12, maxResults * Math.max(creators.length, 1)))
  };
}

module.exports = {
  getCreatorsLatestVideos
};
