# Публикация

## GitHub Pages

Уже настроено: каждый push в ветку `main` обновляет игру на https://asmodeus7268.github.io/ember-swarm/ примерно через минуту.

Если когда-нибудь понадобится включить заново: **Settings → Pages → Source: Deploy from a branch → `main`, `/ (root)`**.

## itch.io

1. Собери архив:
   ```
   powershell -ExecutionPolicy Bypass -File build.ps1
   ```
   Появится `dist/ember-swarm.zip`: только файлы игры, `index.html` в корне архива.
2. На itch.io: **Create new project → Kind of project: HTML**, загрузи zip и отметь **This file will be played in the browser**.
3. Размер окна 1280 × 720, включи **Fullscreen button**.
4. Добавь ссылку на itch.io в README рядом с кнопкой «Играть».
