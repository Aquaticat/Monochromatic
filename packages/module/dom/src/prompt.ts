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
 * @returns Promise that resolves to the user's input or null if cancelled
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

    // Handle form submission
    form.addEventListener(
      'submit',
      function onSubmit(event,) {
        event.preventDefault();
        dialog.returnValue = input.value;
        dialog.close();
      },
    );

    // Handle cancel button
    cancelButton.addEventListener(
      'click',
      function onCancelClick() {
        dialog.returnValue = '';
        dialog.close();
      },
    );

    // Handle dialog close (ESC key or other close methods)
    dialog.addEventListener(
      'close',
      function onClose() {
        // Get the return value (empty string means cancelled)
        const result = dialog.returnValue || null;

        // Clean up
        dialog.remove();

        // Resolve the promise
        resolve(result === '' ? null : result,);
      },
    );

    // Handle backdrop click
    dialog.addEventListener(
      'click',
      function onBackdropClick(event,) {
        // Check if click was on the backdrop (dialog element itself, not its children)
        if (event.target === dialog) {
          const rect = dialog.getBoundingClientRect();
          const clickedInDialog = (event.clientX >= rect.left)
            && (event.clientX <= rect.right)
            && (event.clientY >= rect.top)
            && (event.clientY <= rect.bottom);

          if (!clickedInDialog) {
            dialog.returnValue = '';
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
