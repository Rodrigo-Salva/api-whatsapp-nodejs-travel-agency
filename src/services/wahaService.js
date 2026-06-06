import axios from 'axios';

const WAHA_URL = process.env.WAHA_URL || 'http://localhost:3000';
const WAHA_SESSION = process.env.WAHA_SESSION || 'default';

const WAHA_API_KEY = process.env.WAHA_API_KEY || '';

const waha = axios.create({
  baseURL: WAHA_URL,
  timeout: 30000,
  headers: WAHA_API_KEY ? { 'X-Api-Key': WAHA_API_KEY } : {},
});

export async function sendTextMessage(chatId, text) {
  const { data } = await waha.post(`/api/sendText`, {
    session: WAHA_SESSION,
    chatId,
    text,
  });
  return data;
}

export async function getSessionStatus() {
  const { data } = await waha.get(`/api/sessions/${WAHA_SESSION}`);
  return data;
}
