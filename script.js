// --- 1. ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ СОЗДАНИЯ DOM (Без innerHTML) ---
function createElement(tag, props = {}, ...children) {
  const element = document.createElement(tag);

  Object.entries(props).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else if (key === 'dataset') {
      Object.entries(value).forEach(([dataKey, dataValue]) => {
        element.dataset[dataKey] = dataValue;
      });
    } else if (key.toLowerCase().startsWith('on') && typeof value === 'function') {
      // Надежно выделяем название события (click, keydown и т.д.)
      const eventName = key.slice(2).toLowerCase();
      element.addEventListener(eventName, value);
    } else {
      element.setAttribute(key, value);
    }
  });

  children.forEach(child => {
    if (child !== null && child !== undefined) {
      if (typeof child === 'string' || typeof child === 'number') {
        element.appendChild(document.createTextNode(String(child)));
      } else if (child instanceof HTMLElement) {
        element.appendChild(child);
      }
    }
  });

  return element;
}

// --- 2. ЭМОДЗИ И СОСТОЯНИЕ ИГРЫ (STATE) ---
const CARD_ICONS = ['🍕', '☕', '🚀', '🎨', '🎸', '🎮', '⚽', '🧩'];

const STATE = {
  cards: [],            // Массив объектов карточек
  openedCards: [],      // Открытые карточки текущего хода (макс. 2)
  moves: 0,             // Число ходов
  matchedPairs: 0,      // Число найденных пар (из 8)
  isBoardLocked: false, // Блокировка кликов
  timerId: null,        // Таймер для несовпавшей пары
  leaderboard: JSON.parse(localStorage.getItem('memory_game_leaderboard')) || []
};

// Элементы UI для обновления
let movesElement;
let pairsElement;
let gridElement;

// --- 3. ИНИЦИАЛИЗАЦИЯ ИНТЕРФЕЙСА (ГЕНЕРАЦИЯ HTML) ---
function initApp() {
  const container = createElement('div', { className: 'container' });

  // Header
  const header = createElement('header', { className: 'header' },
    createElement('h1', { className: 'title' }, 'Memory Game'),
    createElement('div', { className: 'controls' },
      createElement('button', { 
        className: 'btn', 
        onClick: startNewGame 
      }, 'Новая игра'),
      createElement('button', { 
        className: 'btn', 
        onClick: showLeaderboardModal 
      }, 'Таблица лидеров')
    )
  );

  // Scoreboard
  movesElement = createElement('span', {}, '0');
  pairsElement = createElement('span', {}, '0 / 8');

  const scoreboard = createElement('div', { className: 'scoreboard' },
    createElement('div', { className: 'score-item' }, 'Ходы: ', movesElement),
    createElement('div', { className: 'score-item' }, 'Пары: ', pairsElement)
  );

  // Board Container
  gridElement = createElement('div', { className: 'grid' });

  container.appendChild(header);
  container.appendChild(scoreboard);
  container.appendChild(gridElement);

  document.body.appendChild(container);

  // Запуск первой игры при загрузке
  startNewGame();
}

// --- 4. ИГРОВАЯ ЛОГИКА ---

// Алгоритм перемешивания Тайтса-Фишера
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function startNewGame() {
  // Сброс таймера незавершенной пары
  if (STATE.timerId) {
    clearTimeout(STATE.timerId);
    STATE.timerId = null;
  }

  STATE.moves = 0;
  STATE.matchedPairs = 0;
  STATE.openedCards = [];
  STATE.isBoardLocked = false;

  updateScoreboard();

  // Дублируем 8 икон и перемешиваем (всего 16)
  const icons = shuffle([...CARD_ICONS, ...CARD_ICONS]);
  STATE.cards = icons.map((icon, index) => ({
    id: index,
    icon: icon,
    isFlipped: false,
    isMatched: false
  }));

  renderBoard();
}

function updateScoreboard() {
  movesElement.textContent = STATE.moves;
  pairsElement.textContent = `${STATE.matchedPairs} / 8`;
}

function renderBoard() {
  // Очистка сетки без innerHTML
  while (gridElement.firstChild) {
    gridElement.removeChild(gridElement.firstChild);
  }

  STATE.cards.forEach(cardData => {
    const cardEl = createElement('div', {
      className: `card ${cardData.isFlipped ? 'flipped' : ''} ${cardData.isMatched ? 'matched' : ''}`,
      onClick: () => handleCardClick(cardData, cardEl)
    },
      createElement('div', { className: 'card-front' }, cardData.icon),
      createElement('div', { className: 'card-back' }, '?')
    );

    gridElement.appendChild(cardEl);
  });
}

function handleCardClick(cardData, cardEl) {
  // Игнорируем клики, если поле заблокировано или карточка уже открыта
  if (
    STATE.isBoardLocked || 
    cardData.isFlipped || 
    cardData.isMatched || 
    STATE.openedCards.includes(cardData)
  ) {
    return;
  }

  // Открываем карточку
  cardData.isFlipped = true;
  cardEl.classList.add('flipped');
  STATE.openedCards.push({ data: cardData, el: cardEl });

  // Если это вторая открытая карточка за ход
  if (STATE.openedCards.length === 2) {
    STATE.moves++;
    updateScoreboard();
    checkMatch();
  }
}

function checkMatch() {
  const [first, second] = STATE.openedCards;

  if (first.data.icon === second.data.icon) {
    // Совпали
    first.data.isMatched = true;
    second.data.isMatched = true;
    first.el.classList.add('matched');
    second.el.classList.add('matched');
    
    STATE.matchedPairs++;
    updateScoreboard();
    STATE.openedCards = [];

    // Проверка на победу
    if (STATE.matchedPairs === 8) {
      setTimeout(handleWin, 300);
    }
  } else {
    // Не совпали — блокируем клики и ждём ~1 сек
    STATE.isBoardLocked = true;
    STATE.timerId = setTimeout(() => {
      first.data.isFlipped = false;
      second.data.isFlipped = false;
      first.el.classList.remove('flipped');
      second.el.classList.remove('flipped');

      STATE.openedCards = [];
      STATE.isBoardLocked = false;
      STATE.timerId = null;
    }, 1000);
  }
}

// --- 5. ПОБЕДА И ЛИДЕРБОРД ---

function handleWin() {
  saveResult(STATE.moves);
  showWinModal(STATE.moves);
}

function saveResult(moves) {
  const dateStr = new Date().toLocaleDateString('ru-RU');
  
  STATE.leaderboard.push({
    moves: moves,
    date: dateStr
  });

  // Сортировка: меньше ходов выше, при равных ходах — ранние выше
  STATE.leaderboard.sort((a, b) => a.moves - b.moves);
  
  // Храним только топ-10
  STATE.leaderboard = STATE.leaderboard.slice(0, 10);
  localStorage.setItem('memory_game_leaderboard', JSON.stringify(STATE.leaderboard));
}

// --- 6. МОДАЛЬНЫЕ ОКНА (УНИВЕРСАЛЬНЫЙ КОМПОНЕНТ) ---

function createModal(contentElement) {
  const closeBtn = createElement('button', { 
    className: 'modal-close', 
    onclick: closeModal 
  }, '×');

  const modalBox = createElement('div', { 
    className: 'modal-box',
    onclick: (e) => e.stopPropagation()
  }, closeBtn, contentElement);

  const overlay = createElement('div', { 
    className: 'modal-overlay',
    onclick: closeModal 
  }, modalBox);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  overlay.dataset.hasKeydown = 'true';
  window._currentModalHandler = handleKeyDown;

  document.body.appendChild(overlay);
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) {
    if (window._currentModalHandler) {
      document.removeEventListener('keydown', window._currentModalHandler);
      window._currentModalHandler = null;
    }
    overlay.remove();
    document.body.style.overflow = '';
  }
}

function closeModal() {
  const overlay = document.querySelector('.modal-overlay');
  if (overlay) {
    if (overlay.dataset.keydownHandler) {
      document.removeEventListener('keydown', overlay.dataset.keydownHandler);
    }
    overlay.remove();
    document.body.style.overflow = '';
  }
}

function showWinModal(moves) {
  const content = createElement('div', { className: 'win-content' },
    createElement('h2', {}, '🎉 Победа!'),
    createElement('p', {}, `Вы нашли все пары за ${moves} ходов.`),
    createElement('div', { className: 'modal-actions' },
      createElement('button', { 
        className: 'btn', 
        onClick: () => { closeModal(); startNewGame(); } 
      }, 'Новая игра'),
      createElement('button', { 
        className: 'btn', 
        onClick: closeModal 
      }, 'Закрыть')
    )
  );

  createModal(content);
}

function showLeaderboardModal() {
  let listContent;

  if (STATE.leaderboard.length === 0) {
    listContent = createElement('p', {}, 'Пока нет результатов');
  } else {
    const tableRows = STATE.leaderboard.map((item, index) => 
      createElement('tr', {},
        createElement('td', {}, index + 1),
        createElement('td', {}, `${item.moves} ходов`),
        createElement('td', {}, item.date)
      )
    );

    listContent = createElement('table', { className: 'leaderboard-table' },
      createElement('thead', {},
        createElement('tr', {},
          createElement('th', {}, 'Место'),
          createElement('th', {}, 'Ходы'),
          createElement('th', {}, 'Дата')
        )
      ),
      createElement('tbody', {}, ...tableRows)
    );
  }

  const content = createElement('div', { className: 'leaderboard-content' },
    createElement('h2', {}, '🏆 Таблица лидеров'),
    listContent,
    createElement('button', { 
      className: 'btn', 
      onClick: closeModal,
      style: 'margin-top: 15px;' 
    }, 'Закрыть')
  );

  createModal(content);
}

// Запуск при загрузке DOM
document.addEventListener('DOMContentLoaded', initApp);