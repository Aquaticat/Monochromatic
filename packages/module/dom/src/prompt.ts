// Prompt Dialog Polyfill: Drop-in replacement for window.prompt using dialog element

/* oxlint-disable require-await -- exposed as async so callers can `await` even though the work is event-driven */
/**
 * Creates a modern prompt dialog using the HTML dialog element.
 * This serves as a polyfill for window.prompt with enhanced styling capabilities.
 *
 * @param message - Message to display to the user
 *
 * @param defaultValue - Default value for the input field
 *
 * @returns Promise that resolves to the entered string when OK is clicked
 *   (including `''` for an empty field), or `null` when the user cancels
 *   via the Cancel button, the Esc key, or a backdrop click. Mirrors the
 *   distinction native `window.prompt` makes between empty-OK and cancel.
 *
 * @example
 * ```ts
 * const name = await prompt({ message: 'What is your name?', },);
 * if (name !== null) {
 *   console.log(`Hello, ${name}!`,);
 * }
 * ```
 */
export async function prompt(
  {
    message,
    defaultValue = '',
  }: {
    message: string;
    defaultValue?: string;
  },
): Promise<string | null> {
  // oxlint-disable-next-line promise/avoid-new -- Required for dialog event handling
  return new Promise(function promptExecutor(resolve,) {
    // Tracks whether the dialog was closed via OK (false) or any cancel path (true).
    // Initialised to `true` so Esc, backdrop click, and the dialog being closed by
    // any other means default to "cancelled"; only the submit handler flips it.
    const state = { cancelled: true, };

    // Create dialog element
    const dialog = document.createElement('dialog',);
    dialog.className = 'prompt-polyfill-dialog';

    // Create form element
    const form = document.createElement('form',);
    form.method = 'dialog';

    // Create title element
    const titleElement = document.createElement('h2',);
    titleElement.textContent = message;

    // Create input element
    const input = document.createElement('input',);
    input.type = 'text';
    input.value = defaultValue;
    input.autofocus = true;

    // Create button container
    const buttonContainer = document.createElement('div',);

    // Create cancel button
    const cancelButton = document.createElement('button',);
    cancelButton.type = 'button';
    cancelButton.className = 'prompt-polyfill-cancel';
    cancelButton.textContent = 'Cancel';

    // Create OK button
    const okButton = document.createElement('button',);
    okButton.type = 'submit';
    okButton.className = 'prompt-polyfill-ok';
    okButton.textContent = 'OK';

    // Assemble the dialog
    buttonContainer.append(cancelButton,);
    buttonContainer.append(okButton,);
    form.append(titleElement,);
    form.append(input,);
    form.append(buttonContainer,);
    dialog.append(form,);
    document.body.append(dialog,);

    // Handle form submission (OK click or Enter key). This is the only path that
    // counts as a successful prompt; `state.cancelled` flips so the close handler
    // can resolve to the entered string instead of null, even when the string is empty.
    form.addEventListener(
      'submit',
      function onSubmit(event,) {
        event.preventDefault();
        state.cancelled = false;
        dialog.close();
      },
    );

    // Handle cancel button: leave state.cancelled = true and just close.
    cancelButton.addEventListener(
      'click',
      function onCancelClick() {
        dialog.close();
      },
    );

    // Handle dialog close (Esc key, programmatic close, or close after submit/cancel above).
    // `state.cancelled` decides between native-prompt's two return shapes:
    // entered string (including '') on OK, null on every cancel path.
    dialog.addEventListener(
      'close',
      function onClose() {
        const result = state.cancelled ? null : input.value;

        dialog.remove();

        resolve(result,);
      },
    );

    // Handle backdrop click: treat as cancellation, same as the Cancel button.
    dialog.addEventListener(
      'click',
      function onBackdropClick(event,) {
        // Check if click was on the backdrop (dialog element itself, not its children).
        if (event.target === dialog) {
          const rect = dialog.getBoundingClientRect();
          const clickedInDialog = (event.clientX >= rect.left)
            && (event.clientX <= rect.right)
            && (event.clientY >= rect.top)
            && (event.clientY <= rect.bottom);

          if (!clickedInDialog) {
            dialog.close();
          }
        }
      },
    );

    // Show the dialog
    dialog.showModal();

    // Select text in input for easy replacement
    input.select();
  },);
}
/* oxlint-enable require-await */
