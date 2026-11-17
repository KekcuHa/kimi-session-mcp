# kimi-session-mcp

[Русская версия ниже](#русская-версия)

MCP server for exchanging plain-text messages between parallel [Kimi Code](https://www.kimi.com/code) sessions through the local REST API of `kimi web`.

Built to scratch an itch also tracked upstream as [kimi-code#4232](https://github.com/MoonshotAI/kimi-code/issues/4232) — driving a live interactive session from another local process.

## Features

- `ListAgents` — list unarchived sessions with title, ID, working directory and busy state.
- `SendMessage` — send text to a session by exact title or `session_…` ID, with sender and reply-to.
- `GetMessages` — read a session's recent text messages, including replies from other sessions.
- `ManageSession` — archive, restore, reload, take over, compact or delete a session through Kimi's colon endpoints. `compact` starts context compaction (same as the `/compact` command). Deletion is irreversible and requires `confirm: true`.

Delivery uses Kimi's native prompt queue. With `steer=true` a running turn can also consume the message immediately. No broker and no permanent MCP process: Kimi launches the server over stdio.

## Choosing between kimi-sessions and AgentMBX

Use `kimi-sessions` for live local Kimi conversations, including parallel workers in one workspace. Use AgentMBX for another machine, offline delivery, persistent threads and mailbox receipts.

Kimi web 2.6.1 and AgentMBX 0.5.58 share one `mbx` MCP process between conversations in a workspace. Do not assign separate AgentMBX identities to parallel hosted workers: a new conversation can inherit another conversation's lease. This limitation concerns AgentMBX integration, not `kimi-sessions`.

## Requirements

- Node.js 22 or newer.
- Kimi Code with its local API server (`kimi web --no-open`). Tested on Kimi Code 2.4.1 and 2.6.1.
- A configured model and Kimi Code authorization.

## Install

```bash
git clone https://github.com/KekcuHa/kimi-session-mcp.git
cd kimi-session-mcp
npm install
kimi web --no-open
```

The API server must be running while sessions exchange messages. The desktop app picks the API port dynamically: unless `KIMI_SESSION_MCP_BASE_URL` is set, the address is auto-discovered from `~/.kimi-code/server/instances/*.json` (the instance with the freshest `heartbeat_at`, cached for 30 s; `http://127.0.0.1:58627` is the final fallback). The token is read from `~/.kimi-code/server.token` and is never written to the MCP log.

## Connecting to Kimi Code

Add to the user-level `~/.kimi-code/mcp.json` (or a project's `.kimi-code/mcp.json`):

```json
{
  "mcpServers": {
    "kimi-sessions": {
      "command": "node",
      "args": ["/path/to/kimi-session-mcp/src/index.js"],
      "startupTimeoutMs": 30000,
      "toolTimeoutMs": 30000
    }
  }
}
```

Only **new** sessions pick up the config. The tools appear to the model as `mcp__kimi-sessions__ListAgents`, `mcp__kimi-sessions__SendMessage`, `mcp__kimi-sessions__GetMessages` and `mcp__kimi-sessions__ManageSession`.

## Usage

Give sessions clear titles via `/title`, e.g. `backend` and `frontend`. Then:

```text
List the available sessions with ListAgents.
```

```text
Send a message to the frontend session from the backend session: the API schema has changed.
```

Direct `SendMessage` arguments:

- `to` — recipient's exact title or ID.
- `from` — sender's exact title or ID.
- `text` — plain text, no credentials.
- `steer` — inject into the active turn; default `true`.

`ManageSession` arguments:

- `session` — exact title or ID; archived sessions are resolved too.
- `action` — `archive`, `restore`, `reload`, `takeover`, `compact` or `delete`.
- `confirm` — must be `true` for the irreversible `delete` action.

`from` is required: stdio MCP does not receive the calling session's ID from Kimi, so the server does not guess it from the directory or busy state.

`SendMessage` returns `accepted: true` once the prompt is queued by Kimi. This is the API's acceptance, not a model read receipt. Check the reply via `GetMessages`, or it arrives in the source session as a new message.

## Creating sessions directly via REST

After `POST /api/v1/sessions`, set the model explicitly — an API-created session may not inherit the global model automatically:

```text
POST /api/v1/sessions/<session_id>/profile
{"agent_config":{"model":"<default_model>"}}
```

`GET /api/v1/config` returns the current `<default_model>`. Without this the turn may fail with `Model not set`.

## Environment settings

- `KIMI_SESSION_MCP_BASE_URL` — API address; when unset, auto-discovered from `~/.kimi-code/server/instances/*.json` (fallback `http://127.0.0.1:58627`).
- `KIMI_SESSION_MCP_TOKEN` — explicit token instead of reading the file.
- `KIMI_SESSION_MCP_TOKEN_PATH` — alternative token file path.
- `KIMI_SESSION_MCP_HTTP_TIMEOUT_MS` — REST request timeout, default `15000`.
- `KIMI_CODE_HOME` — respected when locating `server.token`.

## Managing sessions via REST

Session creation and deletion also go through the API (verified 2026-11-13, Kimi Code 2.4.1):

- Create: `POST /api/v1/sessions` with `{"workspace_id": "..."}` — take the workspace ID from `GET /api/v1/sessions` for any session in the same folder.
- Delete: `POST /api/v1/sessions/{id}:delete` — there is **no** plain `DELETE /sessions/{id}` (404).
- Archive/restore: `POST /api/v1/sessions/{id}:archive`, batch — `POST /api/v2/sessions:archive` / `:restore`.
- Also `:reload` and `:takeover`. Full route list: `GET /openapi.json`.

## Limitations

- One MCP instance talks to one `kimi web` address; no automatic merging of multiple API servers.
- Kimi picks up MCP config only in **new** sessions: sessions started before `mcp.json` appeared have no `mcp__kimi-sessions__*` tools. Such a recipient will accept a message but will only answer into its own transcript — fetch the reply via `GetMessages`.
- `ListAgents` shows all unarchived API sessions, including cold ones unloaded from memory, not just open windows.
- Duplicate titles are ambiguous: the server will ask for a `session_…` ID.
- Text only. Files and conversation history are not copied.
- A message carries no permissions and cannot confirm actions on the user's behalf.
- Kimi's local REST API is experimental; after a Kimi update, compare against its `/openapi.json`.

## Check

```bash
npm run check
```

On 2026-11-05 an end-to-end check was also run through the official MCP SDK: `ListAgents` found two real API sessions, `SendMessage` delivered `PING-4272` from `mcp-worker-a` to `mcp-worker-b`, the recipient called its own MCP reply tool, and `GetMessages` confirmed `PONG-4272` at the sender.

## License

[MIT](LICENSE)

---

# Русская версия

MCP-сервер для обмена текстовыми сообщениями между сеансами Kimi Code через локальный REST API `kimi web`.

## Возможности

- `ListAgents` — список неархивированных сеансов с названием, ID, рабочим каталогом и занятостью.
- `SendMessage` — отправка текста по точному названию или `session_…` ID, с указанием отправителя и адреса ответа.
- `GetMessages` — чтение последних текстовых сообщений сеанса, включая ответы других сеансов.
- `ManageSession` — архивирование, восстановление, перезагрузка, перехват и удаление сеанса через colon-эндпоинты Kimi. Удаление необратимо и требует `confirm: true`.

Для доставки используется штатная очередь промптов Kimi. Параметр `steer=true` дополнительно позволяет активному ходу принять сообщение сразу. Собственный брокер и постоянный MCP-процесс не нужны: Kimi запускает сервер через stdio.

## Выбор между kimi-sessions и AgentMBX

Для живых локальных разговоров Kimi, включая параллельных workers в одном workspace, используй `kimi-sessions`. AgentMBX нужен для другой машины, offline-доставки, постоянных тредов и почтовых квитанций.

Kimi web 2.6.1 и AgentMBX 0.5.58 разделяют один `mbx` MCP-процесс между разговорами workspace. Не назначай отдельные AgentMBX identity параллельным hosted workers: новый разговор может унаследовать lease другого разговора. Это ограничение интеграции AgentMBX, а не `kimi-sessions`.

## Требования

- Node.js 22 или новее.
- Kimi Code с локальным сервером API (`kimi web --no-open`). Проверено на Kimi Code 2.4.1 и 2.6.1.
- Настроенная модель и авторизация Kimi Code.

## Установка

```bash
git clone https://github.com/KekcuHa/kimi-session-mcp.git
cd kimi-session-mcp
npm install
kimi web --no-open
```

Сервер API должен работать во время обмена. У desktop-приложения порт API динамический: если `KIMI_SESSION_MCP_BASE_URL` не задан, адрес определяется автоматически из `~/.kimi-code/server/instances/*.json` (экземпляр с самым свежим `heartbeat_at`, кеш 30 с; последний фолбэк — `http://127.0.0.1:58627`). Токен читается из `~/.kimi-code/server.token`. Токен не выводится в MCP-журнал.

## Подключение к Kimi Code

Добавь в пользовательский `~/.kimi-code/mcp.json` (или проектный `.kimi-code/mcp.json`):

```json
{
  "mcpServers": {
    "kimi-sessions": {
      "command": "node",
      "args": ["/полный/путь/kimi-session-mcp/src/index.js"],
      "startupTimeoutMs": 30000,
      "toolTimeoutMs": 30000
    }
  }
}
```

Конфигурация подхватывается **новыми** сеансами. В модели инструменты появятся как `mcp__kimi-sessions__ListAgents`, `mcp__kimi-sessions__SendMessage`, `mcp__kimi-sessions__GetMessages` и `mcp__kimi-sessions__ManageSession`.

## Использование

Задай сеансам понятные названия через `/title`, например `backend` и `frontend`. После этого можно писать:

```text
Покажи доступные сеансы через ListAgents.
```

```text
Отправь сеансу frontend от сеанса backend сообщение: схема API обновлена.
```

При прямом вызове `SendMessage` аргументы такие:

- `to` — точное название или ID получателя.
- `from` — точное название или ID отправителя.
- `text` — обычный текст без учётных данных.
- `steer` — внедрить сообщение в активный ход; по умолчанию `true`.

Аргументы `ManageSession`:

- `session` — точное название или ID; архивные сеансы тоже разрешаются.
- `action` — `archive`, `restore`, `reload`, `takeover`, `compact` или `delete`.
- `confirm` — обязательно `true` для необратимого `delete`.

`from` обязателен: stdio MCP не получает от Kimi ID вызвавшего сеанса, поэтому сервер не пытается угадывать его по каталогу или занятости.

`SendMessage` возвращает `accepted: true` после постановки промпта в Kimi. Это подтверждение принятия API, а не подтверждение прочтения моделью. Ответ проверяется через `GetMessages` либо приходит в исходный сеанс новым сообщением.

## Создание сеансов напрямую через REST

После `POST /api/v1/sessions` задай модель отдельно — созданный API-сеанс может не унаследовать глобальную модель автоматически:

```text
POST /api/v1/sessions/<session_id>/profile
{"agent_config":{"model":"<default_model>"}}
```

Актуальный `<default_model>` возвращает `GET /api/v1/config`. Без этого ход может завершиться ошибкой `Model not set`.

## Настройки окружения

- `KIMI_SESSION_MCP_BASE_URL` — адрес API; если не задан, определяется из `~/.kimi-code/server/instances/*.json` (фолбэк `http://127.0.0.1:58627`).
- `KIMI_SESSION_MCP_TOKEN` — явный токен вместо чтения файла.
- `KIMI_SESSION_MCP_TOKEN_PATH` — другой путь к файлу токена.
- `KIMI_SESSION_MCP_HTTP_TIMEOUT_MS` — таймаут REST-запроса, по умолчанию `15000`.
- `KIMI_CODE_HOME` — учитывается при поиске `server.token`.

## Управление сеансами через REST

Создание и удаление сеансов тоже делается через API (проверено 2026-11-13, Kimi Code 2.4.1):

- Создать: `POST /api/v1/sessions` с `{"workspace_id": "..."}` — ID workspace берётся из `GET /api/v1/sessions` у любого сеанса той же папки.
- Удалить: `POST /api/v1/sessions/{id}:delete` — обычного `DELETE /sessions/{id}` в API **нет** (404).
- Архивировать/восстановить: `POST /api/v1/sessions/{id}:archive`, пакетно — `POST /api/v2/sessions:archive` / `:restore`.
- Также есть `:reload` и `:takeover`. Полный список маршрутов: `GET /openapi.json`.

## Прямой доступ без MCP (запасной путь)

Если в текущем сеансе инструментов `mcp__kimi-sessions__*` нет (старая сессия, не
подхватившая `mcp.json`), те же вызовы можно выполнить curl'ом напрямую в локальный API
`kimi web` (проверено 15.11.2026, Kimi 2.6.1):

- адрес берётся из `~/.kimi-code/server/instances/*.json` (поля `host`/`port`; внимание:
  `host` может быть LAN-IP вроде 192.168.x.x, а не 127.0.0.1 — fallback
  `http://127.0.0.1:58627` тогда не сработает);
- токен — `~/.kimi-code/server.token`, заголовок `Authorization: Bearer …`;
- список сеансов: `GET /api/v1/sessions?limit=50` (ответ обёрнут: `{"data":{"items":[…]}}`);
- отправка сообщения: `POST /api/v1/sessions/<id>/prompts` — см. `src/kimi-api.js`.

## Ограничения

- Один экземпляр MCP работает с одним адресом `kimi web`; автоматического объединения нескольких API-серверов нет.
- MCP-конфигурация Kimi подхватывается только **новыми** сеансами: у сеансов, запущенных до появления `mcp.json`, инструментов `mcp__kimi-sessions__*` нет. Такой получатель примет сообщение, но ответит только в свой транскрипт — ответ забирать через `GetMessages`.
- `ListAgents` показывает все неархивированные сеансы API, включая выгруженные из памяти cold sessions, а не только открытые окна.
- Одинаковые названия неоднозначны: сервер попросит использовать `session_…` ID.
- Передаётся только текст. Файлы и история разговора не копируются.
- Сообщение не переносит разрешения и не подтверждает действия от имени пользователя.
- Локальный REST API Kimi экспериментальный; при обновлении Kimi сверяйся с его `/openapi.json`.

## Проверка

```bash
npm run check
```

05.11.2026 дополнительно выполнена сквозная проверка через официальный MCP SDK: `ListAgents` нашёл два реальных API-сеанса, `SendMessage` доставил `PING-4272` от `mcp-worker-a` к `mcp-worker-b`, получатель вызвал свой MCP-инструмент ответа, а `GetMessages` подтвердил `PONG-4272` у отправителя.

## Лицензия

[MIT](LICENSE)
