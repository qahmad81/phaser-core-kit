/**
 * Create a dialog UI primitive.
 * A dialog is rendered as a floating HTML element on top of the Phaser canvas.
 * It supports a title, text content and multiple options. Selecting an option
 * will emit a `dialog:choose` event on the provided EventBus with the option value.
 *
 * @param {HTMLElement} container The parent container to attach the dialog overlay.
 * @param {EventBus} bus Event bus for emitting dialog events.
 * @returns {import("../types").DialogAPI}
 */
export function createDialog(container, bus) {
  // Create overlay element lazily
  let overlay = null;
  let isOpen = false;
  let currentOnChoose = null;

  function ensureOverlay() {
    if (overlay) return;
    overlay = document.createElement('div');
    overlay.className = 'pcore-dialog-overlay';
    Object.assign(overlay.style, {
      position: 'absolute',
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      display: 'none',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
      zIndex: 1000,
    });
    container.appendChild(overlay);
  }

  /**
   * Open a dialog with the given model.
   *
   * @param {{title?:string,text:string,options?:{label:string,value:any}[]}} model
   * @param {(val:any)=>void} [onChoose]
   */
  function open(model, onChoose) {
    ensureOverlay();
    // Clear existing content
    overlay.innerHTML = '';
    overlay.style.display = 'flex';
    currentOnChoose = onChoose;
    // Create dialog container
    const dialog = document.createElement('div');
    Object.assign(dialog.style, {
      background: '#fff',
      padding: '1rem',
      borderRadius: '8px',
      minWidth: '300px',
      maxWidth: '80%',
      color: '#333',
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
      fontFamily: 'sans-serif',
    });
    if (model.title) {
      const titleEl = document.createElement('div');
      titleEl.textContent = model.title;
      titleEl.style.fontWeight = 'bold';
      titleEl.style.marginBottom = '0.5rem';
      dialog.appendChild(titleEl);
    }
    const textEl = document.createElement('div');
    textEl.textContent = model.text;
    textEl.style.marginBottom = '1rem';
    dialog.appendChild(textEl);
    if (model.options && model.options.length > 0) {
      const btnContainer = document.createElement('div');
      btnContainer.style.display = 'flex';
      btnContainer.style.flexDirection = 'column';
      btnContainer.style.gap = '0.5rem';
      model.options.forEach((opt) => {
        const btn = document.createElement('button');
        btn.textContent = opt.label;
        Object.assign(btn.style, {
          padding: '0.5rem 1rem',
          cursor: 'pointer',
          fontSize: '1rem',
        });
        btn.addEventListener('click', () => {
          bus.emit('dialog:choose', opt.value);
          if (typeof onChoose === 'function') {
            onChoose(opt.value);
          }
          close();
        });
        btnContainer.appendChild(btn);
      });
      dialog.appendChild(btnContainer);
    } else {
      // If no options, clicking dialog closes it
      dialog.addEventListener('click', () => close());
    }
    overlay.appendChild(dialog);
    isOpen = true;
    bus.emit('dialog:open', model);
  }

  /** Close the dialog if open. */
  function close() {
    if (!overlay || !isOpen) return;
    overlay.innerHTML = '';
    overlay.style.display = 'none';
    isOpen = false;
    bus.emit('dialog:close');
    bus.emit('dialog:ended');
  }

  function getIsOpen() {
    return isOpen;
  }

  return { open, close, isOpen: getIsOpen };
}