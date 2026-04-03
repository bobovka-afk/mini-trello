# Mini Trello на NestJS и Prisma

Этот проект представляет собой учебное fullstack-приложение в стиле Trello. Основная часть разработки сосредоточена на серверной логике: аутентификации, управлении workspace, board, list, card, комментариями, приглашениями пользователей и работе с файлами. Бэкенд построен на `NestJS`, использует `Prisma` для доступа к PostgreSQL и `Redis` для вспомогательных сценариев.

## Установка

1. Клонируйте репозиторий:
   ```bash
   git clone https://github.com/your-username/mini-trello.git
   cd mini-trello
   ```
2. Установите зависимости для бэкенда:
   ```bash
   cd backend
   npm install
   ```
3. Установите зависимости для фронтенда:
   ```bash
   cd ../frontend
   npm install
   ```
4. Создайте файлы окружения из шаблонов:
   ```bash
   cd backend
   cp .env.example .env
   cd ../frontend
   cp .env.example .env
   ```
5. Заполните переменные окружения в `backend/.env`.

## Использование

### Запуск backend

Для локального запуска API в режиме разработки:

```bash
cd backend
npm run start:dev
```

Основные переменные для backend находятся в шаблоне `backend/.env.example`.

### Запуск frontend

Для запуска клиентской части:

```bash
cd frontend
cp .env.example .env
npm run dev
```

### Запуск через Docker

Docker-конфигурация находится внутри `backend/`:

```bash
cd backend
docker compose up --build
```

## Backend

Бэкенд включает в себя:

- регистрацию и логин пользователей
- обновление access token через refresh cookie
- Google OAuth
- управление workspace и участниками
- создание и редактирование board, list и card
- комментарии к карточкам
- Prisma-схему и миграции для PostgreSQL
- интеграцию с Redis
- загрузку файлов и почтовые уведомления

## Frontend

`frontend/` используется как клиент для тестирования и демонстрации API.

Важно: `frontend/` был полностью сгенерирован. Основной предмет разработки и архитектурной работы в этом репозитории находится в `backend/`.

## Структура проекта

- `backend/`: сервер на `NestJS`, Prisma-схема, миграции, Docker-конфиги и runtime-данные.
- `frontend/`: клиент на `React` + `Vite`.
- `REQUIREMENTS_AND_PLAN.md`: требования и план разработки проекта.

## API документация

Для просмотра и проверки всех доступных эндпоинтов используйте Swagger:

```text
http://localhost:3000/api/docs
```

Через Swagger можно посмотреть доступные маршруты, DTO, параметры запросов и протестировать API напрямую.
