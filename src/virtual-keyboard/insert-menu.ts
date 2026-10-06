/**
 * Kedyou: we hide the mathfield's menu toggle, so the "Insert Matrix" and
 * "Insert" menus are made available from a menu button in the virtual
 * keyboard toolbar instead.
 */
import type { InsertOptions } from '../public/core-types';
import { getStylesheet, getStylesheetContent } from '../common/stylesheet';
import { getInsertMenuItems } from '../editor/default-menu';
import { Menu } from '../ui/menu/menu';
import { keyboardModifiersFromEvent } from '../ui/events/utils';
import type { VirtualKeyboard } from './virtual-keyboard';

let gMenu: Menu | undefined;

function getMenu(keyboard: VirtualKeyboard): Menu {
  gMenu ??= new Menu(
    getInsertMenuItems({
      // The virtual keyboard is only connected to an editable mathfield
      isSelectionEditable: true,
      // The mathfield may be in another frame: go through the keyboard
      insert: (s: string, options?: InsertOptions) =>
        keyboard.executeCommand([
          'insert',
          s,
          { focus: true, scrollIntoView: true, ...options },
        ]),
    })
  );
  return gMenu;
}

/**
 * The menu stylesheets (and the CSS variables they use) are scoped to a
 * shadow root, as they are in the mathfield, so render the menu in a shadow
 * root attached to the keyboard element.
 */
function getMenuContainer(keyboard: VirtualKeyboard): HTMLElement | null {
  const keyboardElement = keyboard.element;
  if (!keyboardElement) return null;

  let host = keyboardElement.querySelector<HTMLElement>(
    ':scope > .MLK__menu-host'
  );
  if (!host) {
    host = document.createElement('div');
    host.className = 'MLK__menu-host';
    const shadowRoot = host.attachShadow({ mode: 'open' });
    if (shadowRoot.adoptedStyleSheets) {
      shadowRoot.adoptedStyleSheets = [
        getStylesheet('core'),
        getStylesheet('mathfield'),
        getStylesheet('ui'),
        getStylesheet('menu'),
      ];
    } else {
      const style = document.createElement('style');
      style.textContent =
        getStylesheetContent('core') +
        getStylesheetContent('mathfield') +
        getStylesheetContent('ui') +
        getStylesheetContent('menu');
      shadowRoot.append(style);
    }

    // The keyboard element lets pointer events through, but the scrim
    // and menu need them
    const container = document.createElement('div');
    container.style.pointerEvents = 'auto';
    shadowRoot.append(container);

    keyboardElement.append(host);
  }

  // Follow the theme of the page, as the keyboard does
  const theme = keyboard.container?.closest('[theme]')?.getAttribute('theme');
  if (theme) host.setAttribute('theme', theme);
  else host.removeAttribute('theme');

  return host.shadowRoot!.lastElementChild as HTMLElement;
}

export function showInsertMenu(
  keyboard: VirtualKeyboard,
  button: HTMLElement,
  ev: MouseEvent
): void {
  const menu = getMenu(keyboard);
  if (menu.state !== 'closed') return;

  const target = getMenuContainer(keyboard);
  if (!target) return;

  button.classList.add('is-active');
  const bounds = button.getBoundingClientRect();
  menu.show({
    target,
    location: { x: bounds.left, y: bounds.bottom },
    modifiers: keyboardModifiersFromEvent(ev),
    onDismiss: () => button.classList.remove('is-active'),
  });
}

export function hideInsertMenu(): void {
  gMenu?.hide();
}
