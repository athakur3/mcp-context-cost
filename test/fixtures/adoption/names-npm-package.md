# their-server

An MCP server for the things we do.

## Install

```bash
npm install -g their-server
```

## How much context does it cost?

We keep the tool list small and check it before every release:

```bash
npx -y mcp-context-cost audit --config .mcp.json --budget 20000
```
