import type Variables from './Variables.d.ts';

// side effects
const setVariables = (variables: Variables, document: Document): void => {
  {
    const { colors } = variables;

    colors.light
      && document.documentElement.style.setProperty('--light', colors.light);
    colors.dark
      && document.documentElement.style.setProperty('--dark', colors.dark);
  }

  const { title } = variables;

  document.title = title;
  document.body.querySelector(':scope header > hgroup > h1')!.textContent = title;
};

export default setVariables;
