export function readPageData<TData>(): TData {
  const element = document.getElementById("page-data");
  if (!(element instanceof HTMLScriptElement)) {
    throw new Error("Missing page data script element");
  }

  const text = element.textContent;
  if (text === null) {
    throw new Error("Page data element is empty");
  }

  return JSON.parse(text) as TData;
}
