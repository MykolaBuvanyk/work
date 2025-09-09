# Покращений функціонал Undo/Redo

## Огляд

Новий функціонал Undo/Redo забезпечує надійне збереження та відновлення змін на полотні з покращеною продуктивністю та зручністю використання.

## Основні функції

### 📚 Керування історією

- **Автоматичне збереження** всіх змін на полотні
- **Оптимізований розмір історії** (до 100 станів)
- **Розумне порівняння станів** для уникнення дублікатів
- **Метадані** для кожного стану (час, кількість об'єктів, viewport)

### ⌨️ Клавіатурні скорочення

- **Undo**: `Ctrl+Z` (Windows/Linux) або `Cmd+Z` (Mac)
- **Redo**: `Ctrl+Y` (Windows/Linux) або `Cmd+Shift+Z` (Mac)
- **Збереження**: `Ctrl+S` (Windows/Linux) або `Cmd+S` (Mac)

### 🎛️ Панель історії

- Візуальне відображення всіх станів
- Можливість переходу до будь-якого стану
- Пошук по історії
- Експорт/імпорт історії
- Метрики продуктивності

## Використання

### Базове використання

```jsx
import { useUndoRedo } from '../hooks/useUndoRedo';

const YourComponent = () => {
  const { 
    undo, 
    redo, 
    canUndo, 
    canRedo, 
    historyLength 
  } = useUndoRedo();

  return (
    <div>
      <button onClick={undo} disabled={!canUndo}>
        Undo
      </button>
      <button onClick={redo} disabled={!canRedo}>
        Redo
      </button>
      <span>History: {historyLength} states</span>
    </div>
  );
};
```

### Розширене використання

```jsx
import { useUndoRedo } from '../hooks/useUndoRedo';

const AdvancedComponent = () => {
  const { 
    undo, 
    redo, 
    canUndo, 
    canRedo,
    goToHistoryState,
    clearHistory,
    saveCurrentState,
    exportHistory,
    importHistory,
    history
  } = useUndoRedo();

  // Перехід до конкретного стану
  const jumpToState = (index) => {
    goToHistoryState(index);
  };

  // Ручне збереження поточного стану
  const saveNow = () => {
    saveCurrentState();
  };

  // Експорт історії у файл
  const handleExport = () => {
    const data = exportHistory();
    // Збереження у файл...
  };

  return (
    <div>
      {/* Ваш UI */}
    </div>
  );
};
```

### Панель історії

```jsx
import HistoryPanel from '../components/HistoryPanel';

const YourApp = () => {
  const [isHistoryOpen, setHistoryOpen] = useState(false);

  return (
    <div>
      <button onClick={() => setHistoryOpen(true)}>
        Show History
      </button>
      
      {isHistoryOpen && (
        <HistoryPanel 
          isOpen={isHistoryOpen}
          onClose={() => setHistoryOpen(false)}
        />
      )}
    </div>
  );
};
```

## API хука useUndoRedo

### Повертає

| Властивість | Тип | Опис |
|------------|-----|------|
| `undo` | `Function` | Відмінити останню операцію |
| `redo` | `Function` | Повторити відмінену операцію |
| `canUndo` | `Boolean` | Чи можна виконати undo |
| `canRedo` | `Boolean` | Чи можна виконати redo |
| `historyIndex` | `Number` | Поточний індекс в історії |
| `historyLength` | `Number` | Загальна кількість станів |
| `goToHistoryState` | `Function` | Перехід до конкретного стану |
| `clearHistory` | `Function` | Очищення всієї історії |
| `saveCurrentState` | `Function` | Ручне збереження поточного стану |
| `exportHistory` | `Function` | Експорт історії |
| `importHistory` | `Function` | Імпорт історії |
| `history` | `Array` | Повна історія (для дебагу) |

### Функції

#### `goToHistoryState(index)`
Переходить до конкретного стану в історії.

```jsx
goToHistoryState(5); // Перехід до 6-го стану
```

#### `clearHistory()`
Очищає всю історію.

```jsx
clearHistory(); // Видаляє всі збережені стани
```

#### `saveCurrentState()`
Ручне збереження поточного стану канвасу.

```jsx
saveCurrentState(); // Зберігає поточний стан негайно
```

#### `exportHistory()`
Експортує історію у форматі JSON.

```jsx
const historyData = exportHistory();
// { history: [...], currentIndex: 5, timestamp: 1234567890 }
```

#### `importHistory(historyData)`
Імпортує історію з JSON даних.

```jsx
importHistory(historyData); // Відновлює історію
```

## Налаштування

### Конфігурація в хуку

```jsx
// У файлі useUndoRedo.js
const MAX_HISTORY_SIZE = 100; // Максимальна кількість станів
const SAVE_DELAY = 200; // Затримка перед збереженням (мс)
```

### Клавіатурні скорочення

Клавіатурні скорочення автоматично налаштовуються для платформи:

- **Windows/Linux**: `Ctrl+Z`, `Ctrl+Y`
- **Mac**: `Cmd+Z`, `Cmd+Shift+Z`

## Події канвасу

Хук автоматично відстежує наступні події:

### Негайне збереження
- `object:added` - Додано об'єкт
- `object:removed` - Видалено об'єкт  
- `path:created` - Створено шлях (малювання)

### Збереження з затримкою
- `object:modified` - Змінено об'єкт
- `object:moving` - Переміщення об'єкта
- `object:scaling` - Масштабування об'єкта
- `object:rotating` - Обертання об'єкта
- `text:changed` - Зміна тексту
- `selection:created/updated/cleared` - Зміна виділення

## Оптимізація

### Збереження стану
- Видалення непотрібних властивостей
- Округлення числових значень
- Порівняння станів для уникнення дублікатів

### Продуктивність
- Дебаунс для частих операцій
- Обмеження розміру історії
- Кешування останнього стану

## Дебагування

### Консольні повідомлення
Хук виводить детальну інформацію в консоль:

```
History updated: 15 states, current index: 14
Undo: moving from index 14 to 13
Undo completed: restored state at index 13
```

### Доступ до історії
```jsx
const { history } = useUndoRedo();
console.log('Full history:', history);
```

## Компонент HistoryPanel

### Пропси

| Проп | Тип | Опис |
|------|-----|------|
| `isOpen` | `Boolean` | Чи відкрита панель |
| `onClose` | `Function` | Callback для закриття панелі |

### Функції панелі

- **Пошук** - Фільтрація станів за описом
- **Очищення** - Видалення всієї історії
- **Експорт** - Збереження історії у файл
- **Імпорт** - Завантаження історії з файлу
- **Метрики** - Статистика продуктивності

## Приклади використання

### Інтеграція з TopToolbar

```jsx
const TopToolbar = () => {
  const { undo, redo, canUndo, canRedo, historyLength } = useUndoRedo();
  
  return (
    <div>
      <button onClick={undo} disabled={!canUndo}>
        Undo
      </button>
      <button onClick={redo} disabled={!canRedo}>
        Redo
      </button>
      <span>States: {historyLength}</span>
    </div>
  );
};
```

### Автозбереження проекту

```jsx
const AutoSave = () => {
  const { saveCurrentState } = useUndoRedo();
  
  useEffect(() => {
    const interval = setInterval(() => {
      saveCurrentState(); // Автоматичне збереження кожні 30 секунд
    }, 30000);
    
    return () => clearInterval(interval);
  }, [saveCurrentState]);
  
  return null;
};
```

## Підтримувані формати

### Експорт/Імпорт
- **JSON** - Повна історія у форматі JSON
- **Метадані** - Час створення, індекс, розмір канвасу

### Збережені властивості
Всі користувацькі властивості об'єктів зберігаються:
- `shapeType`, `isCutElement`, `cutType`
- `customProperties`, `id`, `name`
- Стандартні властивості Fabric.js

## Обмеження

- Максимум 100 станів в історії
- Великі зображення можуть сповільнити збереження
- Деякі складні об'єкти можуть не відновлюватися повністю

## Поради з оптимізації

1. **Уникайте частих операцій** - Великі кількості швидких змін можуть сповільнити роботу
2. **Очищайте історію** - Періодично очищайте історію для економії пам'яті
3. **Використовуйте дебаунс** - Хук автоматично застосовує дебаунс для оптимізації
4. **Моніторте розмір історії** - Стежте за кількістю станів через `historyLength`

## Розробка

### Додавання нових подій

```jsx
// У useUndoRedo.js
const eventsToSave = [
  'object:added',
  'object:removed',
  'your:custom:event' // Додайте свою подію
];
```

### Розширення метаданих

```jsx
const stateWithMetadata = {
  ...currentState,
  timestamp: Date.now(),
  customData: {
    // Ваші додаткові дані
  }
};
```
