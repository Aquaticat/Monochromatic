function textOf(result) {
    return (result.content ?? [])
        .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");
}

export function toScriptValue(
  tool,
  outcome
) {
    const { result } = outcome;
    if (tool.outputSchema && (result.structuredContent !== undefined))
        return result.structuredContent;
    const text = textOf(result);
    if (outcome.isError)
        throw new Error(text || `Tool "${tool.name}" failed`);
    return text;
}
