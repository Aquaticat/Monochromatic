/**
 * Reads server-provided page data from the `<script id="page-data" type="application/json">`
 * element that `renderPage()` (or the inline HTML shells) embed in every page.
 *
 * This is the bridge between server-side data and client-side rendering:
 * the server serializes query results as JSON into the HTML, and the client
 * deserializes them here to build the UI without an additional fetch.
 */
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
