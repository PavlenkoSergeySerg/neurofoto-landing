/* functions/api/lead.js — Cloudflare Pages Function.
   Принимает POST с формы, загружает фото в ВК и шлёт заявку в сообщения.
   Токены — только через env (настраиваются в Dashboard Cloudflare). */

const VK_API = 'https://api.vk.com/method/';

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const { name, contact, style, pack, comment, photo } = await request.json();

    // Серверная валидация
    const cleanName = String(name || '').trim().slice(0, 100);
    const cleanContact = String(contact || '').trim().slice(0, 100);
    const cleanComment = String(comment || '').trim().slice(0, 500);
    const cleanPhoto = (typeof photo === 'string' && photo.length < 2500000) ? photo : '';

    if (cleanName.length < 2) return json({ ok: false, error: 'Укажите имя' }, 400);
    if (cleanContact.length < 5) return json({ ok: false, error: 'Укажите контакт' }, 400);

    const text =
      '🔥 Новая заявка с сайта\n' +
      'Имя: ' + cleanName + '\n' +
      'Контакт: ' + cleanContact + '\n' +
      'Стиль: ' + (style || '—') + '\n' +
      'Пакет: ' + (pack || '—') + '\n' +
      'Комментарий: ' + (cleanComment || '—');

    const token = env.VK_TOKEN;

    // 1) Загрузка фото в ВК (3 шага)
    let attachment = '';
    if (cleanPhoto) {
      try {
        const up = await fetch(VK_API + 'photos.getMessagesUploadServer?access_token=' + token + '&v=5.199').then((r) => r.json());
        console.log('VK getUploadServer:', JSON.stringify(up).slice(0, 200));

        if (up.response && up.response.upload_url) {
          // base64 → Uint8Array (без Buffer, чтобы не возиться с nodejs_compat)
          const binary = atob(cleanPhoto);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

          const form = new FormData();
          form.append('photo', new Blob([bytes], { type: 'image/jpeg' }), 'photo.jpg');
          const uploaded = await fetch(up.response.upload_url, { method: 'POST', body: form }).then((r) => r.json());
          console.log('VK upload:', JSON.stringify(uploaded).slice(0, 200));

          const save = await fetch(VK_API + 'photos.saveMessagesPhoto', {
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

    // 2) Сообщение в ВК
    const params = new URLSearchParams({
      access_token: token,
      peer_id: env.VK_USER_ID,
      random_id: String(Date.now()),
      message: text,
      v: '5.199',
    });
    if (attachment) params.append('attachment', attachment);

    const vk = await fetch(VK_API + 'messages.send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }).then((r) => r.json());

    if (vk.error) {
      console.error('VK error:', vk.error);
      return json({ ok: false, error: 'Не удалось отправить в ВК' }, 502);
    }

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ ok: false, error: 'Ошибка сервера' }, 500);
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // CORS: разрешаем тому же домену (для локальных тестов — раскомментируй *)
      'Access-Control-Allow-Origin': '*',
    },
  });
}

// Обработчик preflight-запросов (OPTIONS) для CORS
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}