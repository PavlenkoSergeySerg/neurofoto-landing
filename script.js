/* ==== Форма заявки: валидация и состояния */

const form = document.getElementById('lead-form');

// Если формы на странице нет — скрипт молча завершается без ошибок
if (form) {
  form.addEventListener('submit', onSubmit);
}

/* Сжимаем фото в браузере перед отправкой */
async function compressImage(file, maxSide = 1200, quality = 0.8) {
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality).split(',')[1]; // base64 без префикса
}

async function onSubmit(event) {
  // Отключаем стандартное поведение браузера (перезагрузку страницы)
  event.preventDefault();
    // -- 0. Фото: проверяем и сжимаем, если прикреплено
  let photoBase64 = '';
  const fileInput = form.elements['photo'];
  if (fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    if (!file.type.startsWith('image/')) {
      showStatus('Прикрепить можно только изображение (JPG/PNG)', 'error');
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      showStatus('Фото больше 15 МБ — выберите файл поменьше', 'error');
      return;
    }
    photoBase64 = await compressImage(file);
  }


  // -- 1. Собираем данные.
  // ВАЖНО: используем form.elements['...'], а не form.name / form.style —
  // эти имена конфликтуют со встроенными свойствами и вернут не то, что нужно.
  const data = {
    name:    form.elements['name'].value.trim(),
    contact: form.elements['contact'].value.trim(),
    style:   form.elements['style'].value,
    pack:    form.elements['package'].value,
    comment: form.elements['comment'].value.trim(),
    photo:   photoBase64,
  };

  // -- 2. Валидация: показываем ошибку и НЕ отправляем
  const error = validate(data);
  if (error) {
    showStatus(error, 'error');
    return;
  }

  // -- 3. Защита от двойной отправки: блокируем кнопку
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Отправляем...';

  try {
    // Отправляем заявку в serverless-функцию, она перешлёт в ВК
    const response = await fetch('/api/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const result = await response.json();

    // Сервер вернул ошибку — показываем её текст
    if (!response.ok || !result.ok) {
      throw new Error(result.error || 'Не удалось отправить. Попробуйте ещё раз.');
    }

    // -- Успех: очищаем форму и показываем сообщение
    form.reset();
    showStatus('Заявка отправлена! Свяжусь с вами в ближайшее время.', 'success');
  } catch (e) {
    showStatus(e.message || 'Не удалось отправить. Попробуйте ещё раз.', 'error');
  } finally {
    // Возвращаем кнопку в любом случае (даже при ошибке)
    button.disabled = false;
    button.textContent = 'Отправить заявку';
  }
}

/* Простые и понятные проверки */
function validate(data) {
  if (!data.name)               return 'Укажите имя';
  if (data.name.length < 2)     return 'Имя слишком короткое';
  if (!data.contact)            return 'Укажите контакт: ВК, телефон или email';
  if (data.contact.length < 5)  return 'Контакт выглядит слишком коротким';
  if (data.comment.length > 500) return 'Комментарий слишком длинный (макс. 500 символов)';
  return null; // ошибок нет
}

/* Сообщение под кнопкой: создаётся один раз, дальше только меняем текст */
function showStatus(text, type) {
  let box = document.getElementById('form-status');
  if (!box) {
    box = document.createElement('p');
    box.id = 'form-status';
    form.appendChild(box);
  }
  box.textContent = text;
  box.className = type === 'error' ? 'status-error' : 'status-success';
}
