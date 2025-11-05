import express from 'express';
import axios from 'axios';
import { load } from 'cheerio';
import cron from 'node-cron';
import Redis from 'ioredis';
import dotenv from 'dotenv';
import pRetry from 'p-retry';
import { parseDate } from './util.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configuração do Redis
const redis = new Redis(process.env.REDIS_URL);

const OFFICIAL_NEWS_URL = 'https://en.onepiece-cardgame.com/topics/';
const COMMUNITY_NEWS_URL = 'https://onepiece.gg';

const fetchWithRetry = async (url) => {
  return pRetry(() => axios.get(url), {
    retries: 3,
    onFailedAttempt: error => {
      console.log(`Attempt ${error.attemptNumber} failed. There are ${error.retriesLeft} retries left.`);
    }
  });
};

// --- Scraping Functions ---

const scrapeOfficialNews = async () => {
  try {
            const { data } = await fetchWithRetry(OFFICIAL_NEWS_URL);
            const $ = load(data);    const newsItems = [];

    $('ul.topics_list li.item a').each((i, element) => {
      const url = $(element).attr('href');
      const title = $(element).find('span.title').text().trim();
      const date = $(element).find('span.date').text().trim();
      const category = $(element).find('span.category').text().trim();

      if (title && url.startsWith('/topics/')) {
        newsItems.push({
          title,
          url: `https://en.onepiece-cardgame.com${url}`,
          date: parseDate(date),
          category,
          source: 'official'
        });
      }
    });
    return newsItems;
  } catch (error) {
    console.error('Error scraping official news:', error);
    return [];
  }
};

const scrapeCommunityNews = async () => {
    try {
        const { data } = await fetchWithRetry(COMMUNITY_NEWS_URL + '/articles/');
        const $ = load(data);
        const newsItems = new Set(); // Use a Set to automatically handle duplicates

        // Selectors for different article sections
        const selectors = [
            'a[href^="/articles/"]',
            'a[href^="/news/"]',
            'a[href^="/guides/"]',
            'a[href^="/tier-lists/"]'
        ];

        $(selectors.join(', ')).each((i, element) => {
            const url = $(element).attr('href');
            if (!url) return;

            // Find the most relevant container for title and date
            const container = $(element).closest('.article-card, .article-preview, .tier-list-card');
            if (container.length === 0) return;

            const title = container.find('h3, h2, .article-title').first().text().trim();
            let date = container.find('.date, .publish-date, time').first().text().trim();
            
            // If date is not found, try to get it from a time attribute
            if (!date) {
                const timeAttr = container.find('time').attr('datetime');
                if (timeAttr) {
                    date = timeAttr;
                }
            }

            if (title && url) {
                const categoryMatch = url.match(/\/(articles|news|guides|tier-lists)\//);
                const category = categoryMatch ? categoryMatch[1] : 'general';

                const fullUrl = url.startsWith('http') ? url : `${COMMUNITY_NEWS_URL}${url}`;

                // Add to Set to avoid duplicates
                newsItems.add(JSON.stringify({
                    title,
                    url: fullUrl,
                    date: parseDate(date),
                    category,
                    source: 'community'
                }));
            }
        });

        // Convert Set back to an array of objects
        return Array.from(newsItems).map(item => JSON.parse(item));
    } catch (error) {
        console.error('Error scraping community news:', error);
        return [];
    }
};


// --- API Endpoints ---

app.get('/api/news/official', async (req, res) => {
  const cacheKey = 'news:official';
  let cachedNews = await redis.get(cacheKey);
  if (cachedNews) {
    return res.json(JSON.parse(cachedNews));
  }
  const news = await scrapeOfficialNews();
  redis.set(cacheKey, JSON.stringify(news), 'EX', 900); // 15 minutes TTL
  res.json(news);
});

app.get('/api/news/community', async (req, res) => {
  const cacheKey = 'news:community';
  let cachedNews = await redis.get(cacheKey);
  if (cachedNews) {
    return res.json(JSON.parse(cachedNews));
  }
  const news = await scrapeCommunityNews();
  redis.set(cacheKey, JSON.stringify(news), 'EX', 900); // 15 minutes TTL
  res.json(news);
});

app.get('/api/news', async (req, res) => {
  const official = JSON.parse(await redis.get('news:official') || '[]');
  const community = JSON.parse(await redis.get('news:community') || '[]');

  let allNews = [...official, ...community];

  // Remove duplicates based on URL
  const uniqueNews = Array.from(new Map(allNews.map(item => [item.url, item])).values());

  // Sort by date descending
  uniqueNews.sort((a, b) => new Date(b.date) - new Date(a.date));

  res.json(uniqueNews);
});


// --- Discord Webhook ---

const sendToDiscord = async (newsItem) => {
  const webhookUrl = process.env.DISCORD_WEBHOOK;
  if (!webhookUrl || webhookUrl === 'YOUR_DISCORD_WEBHOOK_URL') {
    console.log('Discord webhook URL not configured. Skipping notification.');
    return;
  }

  const embed = {
    title: newsItem.title,
    url: newsItem.url,
    color: newsItem.source === 'official' ? 0x0099ff : 0xff9900,
    fields: [
      { name: 'Category', value: newsItem.category, inline: true },
      { name: 'Source', value: newsItem.source, inline: true },
      { name: 'Date', value: new Date(newsItem.date).toLocaleDateString('pt-BR'), inline: true },
    ],
    timestamp: new Date().toISOString(),
  };

  try {
    await axios.post(webhookUrl, { embeds: [embed] });
    console.log(`Sent to Discord: ${newsItem.title}`);
  } catch (error) {
    console.error(`Error sending to Discord: ${error.message}`);
  }
};


// --- Cron Job ---

const checkForNewContent = async () => {
  console.log('Checking for new content...');
  const officialNews = await scrapeOfficialNews();
  const communityNews = await scrapeCommunityNews();
  const allNews = [...officialNews, ...communityNews];

  for (const item of allNews) {
    const isSeen = await redis.sismember('seen_news', item.url);
    if (!isSeen) {
      await sendToDiscord(item);
      await redis.sadd('seen_news', item.url);
    }
  }
};

// Schedule to run every 10 minutes
cron.schedule('*/10 * * * *', checkForNewContent);


// --- Server Start ---

app.listen(port, () => {
  console.log(`📰 One Piece TCG Scraper ativo na porta ${port}`);
  // Run once on start
  checkForNewContent();
});
