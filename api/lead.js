/* api/lead.js — заявка + фото уходят в сообщение ВК (фото — картинкой).
   Без PHP и без почты: Vercel (Node.js) + VK API. Секреты — только в env. */

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Метод не поддерживается' });

  try {
    const { name, contact, style, pack, comment, photo } = req.body || {};

    // Серверная валидация
    const cleanName = String(name || '').trim().slice(0, 100);
    const cleanContact = String(contact || '').trim().slice(0, 100);
    const cleanComment = String(comment || '').trim().slice(0, 500);
    const cleanPhoto = (typeof photo === 'string' && photo.length < 2500000) ? photo : '';

    if (cleanName.length < 2) return res.status(400).json({ ok: false, error: 'Укажите имя' });
    if (cleanContact.length < 5) return res.status(400).json({ ok: false, error: 'Укажите контакт' });

    const text =
      '🔥 Новая заявка с сайта\n' +
      'Имя: ' + cleanName + '\n' +
      'Контакт: ' + cleanContact + '\n' +
      'Стиль: ' + (style || '—') + '\n' +
      'Пакет: ' + (pack || '—') + '\n' +
      'Комментарий: ' + (cleanComment || '—');

    const token = process.env.VK_TOKEN;
    const vkApi = 'https://api.vk.com/method/';

        // 1) Если есть фото — загружаем в ВК, теперь с логами каждого шага
    let attachment = '';
    if (cleanPhoto) {
      try {
        const up = await fetch(vkApi + 'photos.getMessagesUploadServer?access_token=' + token + '&v=5.199').then((r) => r.json());
        console.log('VK getUploadServer:', JSON.stringify(up).slice(0, 200));

        if (up.response && up.response.upload_url) {
          const buffer = Buffer.from(cleanPhoto, 'base64');
          const form = new FormData();
          form.append('photo', new Blob([buffer], { type: 'image/jpeg' }), 'photo.jpg');
          const uploaded = await fetch(up.response.upload_url, { method: 'POST', body: form }).then((r) => r.json());
          console.log('VK upload:', JSON.stringify(uploaded).slice(0, 200));

          const save = await fetch(vkApi + 'photos.saveMessagePhoto', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              access_token: token,
              photo: String(uploaded.photo || ''),
              server: String(uploaded.server || ''),
              hash: String(uploaded.hash || ''),
              v: '5.199',
            }).toString(),
          }).then((r) => r.json());
          console.log('VK save:', JSON.stringify(save).slice(0, 300));

          if (save.response && save.response[0]) {
            attachment = 'photo' + save.response[0].owner_id + '_' + save.response[0].id;
          }
        }
        console.log('attachment:', attachment);
      } catch (e) {
        console.error('VK photo upload error:', e);
      }
    }

    // 2) Сообщение в ВК: текст + фото (если загрузилось)
    const params = new URLSearchParams({
      access_token: token,
      peer_id: process.env.VK_USER_ID,
      random_id: String(Date.now()),
      message: text,
      v: '5.199',
    });
    if (attachment) params.append('attachment', attachment);

    const vk = await fetch(vkApi + 'messages.send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }).then((r) => r.json());

    if (vk.error) {
      console.error('VK error:', vk.error);
      return res.status(502).json({ ok: false, error: 'Не удалось отправить в ВК' });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: 'Ошибка сервера, попробуйте ещё раз' });
  }
}
