# Расписание массажной студии

Статический сайт без сборщика: публичное расписание, административная панель и Supabase как общая база данных.

## Файлы проекта

- `index.html` — публичное расписание.
- `admin.html` — вход и административная панель.
- `style.css`, `script.js` — публичная часть.
- `admin.css`, `admin.js` — административная панель.
- `supabase.js` — URL и публичный ключ Supabase.
- `assets/massage-background.png` — фоновая фотография.

## Структура Supabase

В проекте используются две таблицы, созданные через Table Editor.

### `public.schedule_days`

- `day` — `date`, Primary Key.
- `available_slots` — `jsonb`, Default Value: `[]`.
- `updated_at` — `timestamptz`, Default Value: `now()`.

RLS включён. Политики: публичный `SELECT` с условием `true`; `ALL` для `authenticated` с проверкой наличия текущего `auth.uid()` в `public.admin_users` (условие должно стоять и в USING, и в WITH CHECK).

### `public.admin_users`

- `user_id` — `uuid`, Primary Key, совпадает с UID пользователя в Authentication → Users.
- `created_at` — `timestamptz`, Default Value: `now()`.

RLS включён. Политика `SELECT` для `authenticated` с выражением `user_id = (select auth.uid())`.

## Подключение Supabase

1. В Supabase открой **Connect** и скопируй Project URL. Publishable key также можно взять в **Settings → API Keys**.
2. Используй именно **Publishable key** (`sb_publishable_...`) для клиентского JavaScript. Старый `anon` key также поддерживается, если publishable key ещё не создан.
3. Открой `supabase.js` и замени `YOUR_SUPABASE_URL` и `YOUR_SUPABASE_PUBLISHABLE_KEY` на свои значения.
4. Не вставляй `secret` / `service_role` key в браузерный проект.

## Проверка

- Публичная страница: `index.html`.
- Административная панель: `admin.html`.
- При отсутствии строки для даты публичная страница считает все слоты занятыми.
- Администратор отмечает свободные слоты и нажимает «Сохранить изменения». До сохранения изменения остаются только в браузере.
- После успешного сохранения данные месяца передаются в `schedule_days`.
- Публичная страница проверяет обновления через Supabase Realtime и делает резервную проверку раз в минуту.
- Кнопка записи ведёт на `https://t.me/chexova_2`.

## GitHub Pages

Загрузить в корень репозитория **всё содержимое папки `massage-studio`**, включая папку `assets`. Затем открыть Repository → Settings → Pages и выбрать публикацию из нужной ветки и корневой папки (`/root`). Публичная страница откроется по корневому адресу, административная — по адресу `/admin.html`.

После публикации добавь адрес сайта в Supabase → Authentication → URL Configuration → Redirect URLs. Для GitHub Pages адреса будут примерно такими:

- `https://USERNAME.github.io/REPOSITORY/`
- `https://USERNAME.github.io/REPOSITORY/admin.html`

## Примечание

Рекомендации и управление ими в этой версии отключены, поскольку таблицу `recommendations` мы не создавали. Часовой пояс и автоматическое скрытие прошедших слотов нужно отдельно согласовать перед финальным запуском.
