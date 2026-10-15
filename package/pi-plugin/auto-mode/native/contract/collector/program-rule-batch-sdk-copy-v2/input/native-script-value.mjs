function textOf(result) {
    return (result.content ?? [])
        .filter(function isTextBlock(block) { return (block.type === "text"); })
      .map(function readBlockText(block) { return (block.text); })
      .join("\n");
}

export function convertNativeOutcome({
  tool,
  outcome
}) {
    const { result } = outcome;
    if (tool.outputSchema && (result.structuredContent !== undefined))
        return result.structuredContent;
    const text = textOf(result);
    if (outcome.isError)
        throw new Error(text || `Tool "${tool.name}" failed`);
    return text;
}
