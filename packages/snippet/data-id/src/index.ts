export const getElementByDataId = (dataId: string): HTMLElement | null => {
  const treeWalker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    (node) => {
      const htmlElement: HTMLElement = node as HTMLElement;
      for (const data in htmlElement.dataset) {
        if (/^id[A-Z0-9]/.test(data)) {
          if (htmlElement.dataset[data] === dataId) {
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      }
      return NodeFilter.FILTER_SKIP;
    },
  );
  return treeWalker.nextNode() as HTMLElement | null;
};

export default function onDomContentLoaded() {
  if (location.hash) {
    const potentialId = location.hash.slice(1);
    if (document.querySelector(`#${potentialId}`)) {
    } else {
      // TODO: Needs testing.
      const elementWithDataId = getElementByDataId(potentialId);
      if (elementWithDataId) {
        elementWithDataId.scrollIntoView();
        elementWithDataId.focus();
      }
    }
  }
}
