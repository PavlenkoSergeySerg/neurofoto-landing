/* api/lead.js — serverless-функция Vercel.
   Принимает заявку с формы и отправляет её тебе в ВК.
   Токен ВК берётся ТОЛЬКО из env-переменных (process.env). */

export default async function handler(req, res) {
  // Разрешаем только POST
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Метод не поддерживается' });
  }

  try {
    const { name, contact, style, pack, comment } = req.body || {};

    // Серверная валидация: браузеру не верим, режем длину
    const cleanName = String(name || '').trim().slice(0, 100);
    const cleanContact = String(contact || '').trim().slice(0, 100);
    const cleanComment = String(comment || '').trim().slice(0, 500);

    if (cleanName.length < 2) return res.status(400).json({ ok: false, error: 'Укажите имя' });
    if (cleanContact.length < 5) return res.status(400).json({ ok: false, error: 'Укажите контакт' });

    // Текст сообщения для ВК
    const text =
      '🔥 Новая заявка с сайта\n' +
      'Имя: ' + cleanName + '\n' +
      'Контакт: ' + cleanContact + '\n' +
      'Стиль: ' + (style || '—') + '\n' +
      'Пакет: ' + (pack || '—') + '\n' +
      'Комментарий: ' + (cleanComment || '—');

    // Отправка в ВК: токен и твой ID — из env
    const params = new URLSearchParams({
      access_token: process.env.VK_TOKEN,
      peer_id: process.env.VK_USER_ID,   // 22801196 (подставится из env)
      random_id: String(Date.now()),     // защита от дублей
      message: text,
      v: '5.199',
    });

    const vk = await fetch('https://api.vk.com/method/messages.send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }).then((r) => r.json());

    if (vk.error) {
      console.error('VK error:', vk.error); // видно в логах Vercel
      return res.status(502).json({ ok: false, error: 'Не удалось отправить в ВК' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'Ошибка сервера' });
  }
}