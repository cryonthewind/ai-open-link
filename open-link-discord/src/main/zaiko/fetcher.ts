import axios from 'axios';
// @ts-ignore
import randomUseragent from 'random-useragent';

export async function fetchPage(url: string) {
  try {
    const userAgent = randomUseragent.getRandom();
    const headers = {
      'User-Agent': userAgent,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Cookie': process.env.COOKIE || ''
    };

    const response = await axios.get(url, {
      headers: headers,
      timeout: 10000
    });
    return {
      status: response.status,
      data: response.data
    };
  } catch (error: any) {
    if (error.response) {
      return {
        status: error.response.status,
        data: error.response.data,
        error: error.message
      };
    }
    return {
      status: 0,
      error: error.message
    };
  }
}
