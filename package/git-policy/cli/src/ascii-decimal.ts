/**
 ASCII decimal-digit checks for numbers Git and the kernel print:
 PIDs,
 PID files,
 and `GIT_CONFIG_COUNT`.

 @module
 */

/**
 Reports whether every UTF-16 unit of a string is an ASCII digit.
 Index scanning is exact here because every accepted character is a single ASCII unit.

 @param text - text to check

 @returns whether the text is empty or all ASCII digits

 @example
 ```ts
 isAsciiDigits('42'); // true
 isAsciiDigits(''); // true
 isAsciiDigits('4a'); // false
 ```
 */
export function isAsciiDigits(text: string,): boolean {
  for (let index = 0; index < text.length; index += 1) {
    /**
     Current unit.
     */
    const character = text.charAt(index,);
    if ((character < '0') || (character > '9'))
      return false;
  }
  return true;
}
