# Glossary

### Context Window {#context-window}

The tokens a model can attend to in one request. Tool definitions are placed in
it before the first user turn, so a server with many tools costs something on
every request whether or not a tool is called. See
[MCP Context Cost](https://shuji-bonji.github.io/understanding-llm-through-claude-code/06-tool-context/mcp-context-cost).

### Harness {#harness}

The software around the model: the loop that sends requests, runs tools and
decides what the model sees next.

### Tool Search {#tool-search}

Loading a tool's definition only when it is about to be used, instead of on
every request. Related:
[MCP Context Cost](https://shuji-bonji.github.io/understanding-llm-through-claude-code/06-tool-context/mcp-context-cost),
[Deferred Loading](#deferred-loading).
