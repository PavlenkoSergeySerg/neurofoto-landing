/* ==== Форма заявки: валидация и состояния (шаг 4) ==== */

const form = document.getElementById('lead-form');

// Если формы на странице нет — скрипт молча завершается без ошибок
if (form) {
  form.addEventListener('submit', onSubmit);
}

async function onSubmit(event) {
  // Отключаем стандартное поведение браузера (перезагрузку страницы)
  event.preventDefault();

  // -- 1. Собираем данные.
  // ВАЖНО: используем form.elements['...'], а не form.name / form.style —
  // эти имена конфликтуют со встроенными свойствами и вернут не то, что нужно.
  const data = {
    name:    form.elements['name'].value.trim(),
    contact: form.elements['contact'].value.trim(),
    style:   form.elements['style'].value,
    pack:    form.elements['package'].value,
    comment: form.elements['comment'].value.trim(),
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
