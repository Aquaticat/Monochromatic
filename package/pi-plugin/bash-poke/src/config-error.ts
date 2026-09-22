/**
 Bash-poke settings failure type.

 @module
 */

//region Error type

/**
 Failure naming the settings file and the offending key.
 
 A dedicated class keeps unreadable settings distinguishable from a filesystem
 fault, so the caller can report a fix the user can act on.
 
 @example
 ```ts
 throw new BashPokeConfigError('pi-bash-poke.json: unknown key "pokeHead"');
 ```
 */
class BashPokeConfigError extends Error {
  /**
   Builds a settings failure carrying a diagnostic name.
   
   @param message - text naming the file and the rejected key or value
   */
  constructor(message: string, ) {
    super(message,);
    this.name = 'BashPokeConfigError';
  }
}

//endregion Error type

export { BashPokeConfigError, };
