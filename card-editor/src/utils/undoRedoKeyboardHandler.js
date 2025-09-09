// Утиліта для керування клавіатурними скороченнями для undo/redo
export class UndoRedoKeyboardHandler {
  constructor(options = {}) {
    this.undoCallback = options.undo || (() => {});
    this.redoCallback = options.redo || (() => {});
    this.saveCallback = options.save || (() => {});
    this.isEnabled = options.enabled !== false;
    this.boundHandler = this.handleKeyDown.bind(this);
    
    // Платформо-специфічні модифікатори
    this.isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    this.ctrlKey = this.isMac ? 'metaKey' : 'ctrlKey';
  }

  // Обробник клавіатурних подій
  handleKeyDown(event) {
    if (!this.isEnabled) return;

    // Перевіряємо чи не в полі вводу
    const target = event.target;
    const isInputField = target.tagName === 'INPUT' || 
                        target.tagName === 'TEXTAREA' || 
                        target.isContentEditable;

    // Якщо у полі вводу, обробляємо тільки спеціальні комбінації
    if (isInputField) {
      // Дозволяємо Ctrl+Z/Cmd+Z та Ctrl+Y/Cmd+Shift+Z навіть у полях вводу
      // тільки якщо це не текстове редагування
      if (target.type === 'text' || target.type === 'search') {
        return; // Дозволяємо стандартну поведінку браузера
      }
    }

    const isCtrlPressed = event[this.ctrlKey];
    const isShiftPressed = event.shiftKey;

    // Undo: Ctrl+Z (Windows/Linux) або Cmd+Z (Mac)
    if (isCtrlPressed && event.key === 'z' && !isShiftPressed) {
      event.preventDefault();
      this.undoCallback();
      return;
    }

    // Redo: Ctrl+Y (Windows/Linux) або Cmd+Shift+Z (Mac)
    if ((isCtrlPressed && event.key === 'y' && !this.isMac) ||
        (isCtrlPressed && isShiftPressed && event.key === 'z' && this.isMac)) {
      event.preventDefault();
      this.redoCallback();
      return;
    }

    // Швидке збереження: Ctrl+S (Windows/Linux) або Cmd+S (Mac)
    if (isCtrlPressed && event.key === 's') {
      event.preventDefault();
      this.saveCallback();
      return;
    }
  }

  // Увімкнути обробник
  enable() {
    if (!this.isEnabled) {
      this.isEnabled = true;
      document.addEventListener('keydown', this.boundHandler);
    }
  }

  // Вимкнути обробник
  disable() {
    if (this.isEnabled) {
      this.isEnabled = false;
      document.removeEventListener('keydown', this.boundHandler);
    }
  }

  // Оновити callback функції
  updateCallbacks(callbacks) {
    if (callbacks.undo) this.undoCallback = callbacks.undo;
    if (callbacks.redo) this.redoCallback = callbacks.redo;
    if (callbacks.save) this.saveCallback = callbacks.save;
  }

  // Очистити обробники при знищенні
  destroy() {
    this.disable();
    this.undoCallback = null;
    this.redoCallback = null;
    this.saveCallback = null;
  }

  // Отримати інформацію про поточні скорочення
  getShortcuts() {
    const prefix = this.isMac ? 'Cmd' : 'Ctrl';
    return {
      undo: `${prefix}+Z`,
      redo: this.isMac ? `${prefix}+Shift+Z` : `${prefix}+Y`,
      save: `${prefix}+S`
    };
  }
}
